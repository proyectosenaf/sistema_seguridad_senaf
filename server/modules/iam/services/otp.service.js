import AuthOtp from "../models/AuthOtp.model.js";
import { getIamSettings } from "./settings.service.js";
import { makeOtp, hashOtp, normEmail } from "../utils/otp.util.js";

export async function createOtp({ email, purpose, meta = {} }) {
  const settings = await getIamSettings();
  if (!settings?.auth?.otpEnabled) throw new Error("OTP deshabilitado por configuración");

  const e = normEmail(email);
  const len = settings.auth.otpLength || 6;
  const ttl = settings.auth.otpTtlSeconds || 600;

  const code = makeOtp(len);
  const codeHash = hashOtp(e, code);
  const expiresAt = new Date(Date.now() + ttl * 1000);

  const doc = await AuthOtp.create({
    email: e,
    purpose,
    codeHash,
    expiresAt,
    attempts: 0,
    consumedAt: null,
    meta,
  });

  return { otpId: String(doc._id), code, expiresAt };
}

export async function verifyOtp({ otpId, email, code, purpose }) {
  const settings = await getIamSettings();
  const e = normEmail(email);

  const doc = await AuthOtp.findById(otpId);
  if (!doc) throw new Error("OTP no encontrado");
  if (doc.consumedAt) throw new Error("OTP ya fue usado");
  if (doc.purpose !== purpose) throw new Error("OTP no corresponde a este flujo");
  if (doc.email !== e) throw new Error("OTP no corresponde al email");
  if (doc.expiresAt.getTime() < Date.now()) throw new Error("OTP expirado");

  const maxAttempts = settings?.auth?.otpMaxAttempts ?? 5;
  if (doc.attempts >= maxAttempts) throw new Error("OTP bloqueado por demasiados intentos");

  const expected = hashOtp(e, code);
  if (expected !== doc.codeHash) {
    doc.attempts += 1;
    await doc.save();
    throw new Error("Código inválido");
  }

  doc.consumedAt = new Date();
  await doc.save();

  return { ok: true, meta: doc.meta || {} };
}