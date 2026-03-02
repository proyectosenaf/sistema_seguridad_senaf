// server/modules/iam/services/otp.service.js
import AuthOtp from "../models/AuthOtp.model.js";
import { getSecuritySettings } from "./settings.service.js";
import { makeOtp, hashOtp, normEmail } from "../utils/otp.util.js";

/* =========================
   Helpers
========================= */

function getOtpSettings() {
  const s = getSecuritySettings?.() || {};
  const otp = s.otp || {};
  const features = s.features || {};
  const password = s.password || {};

  return {
    ttlSeconds: Number.isFinite(Number(otp.ttlSeconds)) ? Number(otp.ttlSeconds) : 300,
    maxAttempts: Number.isFinite(Number(otp.maxAttempts)) ? Number(otp.maxAttempts) : 5,
    resendCooldownSeconds: Number.isFinite(Number(otp.resendCooldownSeconds))
      ? Number(otp.resendCooldownSeconds)
      : 30,
    features,
    password,
  };
}

function isExpiredDoc(doc) {
  if (!doc?.expiresAt) return true;
  const exp = new Date(doc.expiresAt);
  if (Number.isNaN(exp.getTime())) return true;
  return new Date() > exp;
}

function canResendDoc(doc) {
  if (!doc?.resendAfter) return true;
  const ra = new Date(doc.resendAfter);
  if (Number.isNaN(ra.getTime())) return true;
  return new Date() >= ra;
}

async function findActiveOtp({ email, purpose }) {
  const e = normEmail(email);
  const q = { email: e, consumedAt: null };
  if (purpose) q.purpose = purpose;

  return AuthOtp.findOne(q).sort({ createdAt: -1 }).exec();
}

/* =========================
   API del servicio
========================= */

/**
 * Crea un OTP nuevo para (email,purpose), reemplazando el activo (si existe).
 * Retorna { otpId, code, expiresAt, resendAfter, ttlSeconds, resendCooldownSeconds }
 */
export async function createOtp({ email, purpose, meta = {} }) {
  const settings = getOtpSettings();

  const e = normEmail(email);
  if (!e) throw Object.assign(new Error("email_required"), { code: "email_required" });
  if (!purpose) throw Object.assign(new Error("purpose_required"), { code: "purpose_required" });

  // Flags
  if (purpose === "employee-login" && !settings.features?.enableEmployeeOtp) {
    throw Object.assign(new Error("employee_otp_disabled"), { code: "employee_otp_disabled" });
  }
  if (purpose === "visitor-login" && !settings.features?.enablePublicOtp) {
    throw Object.assign(new Error("public_otp_disabled"), { code: "public_otp_disabled" });
  }

  const code = makeOtp(6);
  const codeHash = hashOtp(e, code);

  const now = new Date();

  const expiresAt = new Date(now);
  expiresAt.setSeconds(expiresAt.getSeconds() + settings.ttlSeconds);

  const resendAfter = new Date(now);
  resendAfter.setSeconds(resendAfter.getSeconds() + settings.resendCooldownSeconds);

  // Solo 1 OTP activo por (email,purpose)
  await AuthOtp.deleteMany({ email: e, purpose, consumedAt: null });

  const doc = await AuthOtp.create({
    email: e,
    purpose,
    codeHash,
    expiresAt,
    attempts: 0,
    maxAttempts: settings.maxAttempts,
    resendAfter,
    consumedAt: null,
    meta,
  });

  return {
    otpId: String(doc._id),
    code,
    expiresAt,
    resendAfter,
    ttlSeconds: settings.ttlSeconds,
    resendCooldownSeconds: settings.resendCooldownSeconds,
  };
}

/**
 * Reenvía OTP si cooldown lo permite.
 * Si no existe OTP activo, crea uno nuevo.
 */
export async function resendOtp({ email, purpose, meta = {} }) {
  const settings = getOtpSettings();
  const e = normEmail(email);

  if (!e) throw Object.assign(new Error("email_required"), { code: "email_required" });

  // flags (si viene purpose)
  if (purpose === "employee-login" && !settings.features?.enableEmployeeOtp) {
    throw Object.assign(new Error("employee_otp_disabled"), { code: "employee_otp_disabled" });
  }
  if (purpose === "visitor-login" && !settings.features?.enablePublicOtp) {
    throw Object.assign(new Error("public_otp_disabled"), { code: "public_otp_disabled" });
  }

  const active = await findActiveOtp({ email: e, purpose });

  if (active && !isExpiredDoc(active) && !canResendDoc(active)) {
    throw Object.assign(new Error("otp_resend_cooldown"), {
      code: "otp_resend_cooldown",
      cooldownSeconds: settings.resendCooldownSeconds,
    });
  }

  const chosenPurpose = purpose || active?.purpose || "employee-login";
  return createOtp({ email: e, purpose: chosenPurpose, meta });
}

/**
 * Verifica OTP sin requerir otpId (tu cliente manda solo email+otp).
 * - Busca OTP activo por email (y purpose si viene)
 * - Si no viene purpose, toma el OTP activo más reciente (cualquier purpose)
 */
export async function verifyOtpByEmail({ email, code, purpose }) {
  const settings = getOtpSettings();
  const e = normEmail(email);
  const otp = String(code || "").trim();

  if (!e || !otp) {
    throw Object.assign(new Error("email_and_otp_required"), { code: "email_and_otp_required" });
  }

  // flags (si viene purpose)
  if (purpose === "employee-login" && !settings.features?.enableEmployeeOtp) {
    throw Object.assign(new Error("employee_otp_disabled"), { code: "employee_otp_disabled" });
  }
  if (purpose === "visitor-login" && !settings.features?.enablePublicOtp) {
    throw Object.assign(new Error("public_otp_disabled"), { code: "public_otp_disabled" });
  }

  let doc = await findActiveOtp({ email: e, purpose });

  // Si no viene purpose o no encontró, intenta con cualquiera activo (más reciente)
  if (!doc && !purpose) {
    doc = await AuthOtp.findOne({ email: e, consumedAt: null }).sort({ createdAt: -1 }).exec();
  }

  if (!doc) throw Object.assign(new Error("otp_not_found"), { code: "otp_not_found" });

  if (isExpiredDoc(doc)) {
    await AuthOtp.deleteMany({ email: e, consumedAt: null });
    throw Object.assign(new Error("otp_expired"), { code: "otp_expired" });
  }

  const maxAttempts = Number.isFinite(Number(doc.maxAttempts))
    ? Number(doc.maxAttempts)
    : settings.maxAttempts;

  if (Number(doc.attempts || 0) >= maxAttempts) {
    await AuthOtp.deleteMany({ email: e, consumedAt: null });
    throw Object.assign(new Error("otp_max_attempts"), { code: "otp_max_attempts" });
  }

  const expected = hashOtp(e, otp);
  if (expected !== String(doc.codeHash || "")) {
    doc.attempts = Number(doc.attempts || 0) + 1;
    await doc.save();
    throw Object.assign(new Error("otp_invalid"), { code: "otp_invalid" });
  }

  // OTP correcto => consumir + limpiar otros activos
  doc.consumedAt = new Date();
  await doc.save();

  await AuthOtp.deleteMany({ email: e, consumedAt: null });

  return { ok: true, purpose: doc.purpose, meta: doc.meta || {} };
}