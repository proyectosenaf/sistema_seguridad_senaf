import { Router } from "express";
import jwt from "jsonwebtoken";
import IamUser from "./../models/IamUser.model.js";
import { getIamSettings } from "../services/settings.service.js";
import { createOtp, verifyOtp } from "../services/otp.service.js";
import { sendOtpEmail } from "../services/otp.mailer.js";
import { normEmail } from "../utils/otp.util.js";
import { verifyPassword, hashPassword } from "../utils/password.util.js"; // ajusta si tu util tiene otros nombres

const r = Router();

function signEmployeeToken({ email, role, mustChangePassword }) {
  const secret = process.env.JWT_SECRET || "dev_jwt_secret";
  const payload = {
    typ: "employee",
    email,
    role,
    pwd_change_required: !!mustChangePassword,
    // permissions se integra luego con tu módulo de roles/perms
  };
  return jwt.sign(payload, secret, { expiresIn: "8h" });
}

/**
 * POST /api/iam/v1/auth/login-otp
 * - valida password (empleado)
 * - manda OTP por email
 */
r.post("/login-otp", async (req, res, next) => {
  try {
    const settings = await getIamSettings();
    if (!settings?.employee?.enabled) return res.status(403).json({ ok: false, error: "Login empleado deshabilitado" });

    const email = normEmail(req.body?.email);
    const password = String(req.body?.password || "");

    if (!email || !password) return res.status(400).json({ ok: false, error: "Email y password requeridos" });

    const user = await IamUser.findOne({ email });
    if (!user) return res.status(404).json({ ok: false, error: "Usuario no existe" });

    const ok = await verifyPassword(password, user.passwordHash || user.password || "");
    if (!ok) return res.status(401).json({ ok: false, error: "Credenciales inválidas" });

    const { otpId, code, expiresAt } = await createOtp({
      email,
      purpose: "employee-login",
      meta: { userId: String(user._id) },
    });

    await sendOtpEmail({ to: email, code, purpose: "employee-login" });

    res.json({
      ok: true,
      step: "OTP_REQUIRED",
      otpId,
      expiresAt,
      mustChangePassword: !!user.mustChangePassword,
      channel: "email",
    });
  } catch (e) { next(e); }
});

/**
 * POST /api/iam/v1/auth/verify-otp
 */
r.post("/verify-otp", async (req, res, next) => {
  try {
    const settings = await getIamSettings();

    const email = normEmail(req.body?.email);
    const otpId = String(req.body?.otpId || "").trim();
    const code = String(req.body?.code || "").trim();
    if (!email || !otpId || !code) return res.status(400).json({ ok: false, error: "email, otpId y code son requeridos" });

    const { meta } = await verifyOtp({ otpId, email, code, purpose: "employee-login" });

    const user = await IamUser.findOne({ email });
    if (!user) return res.status(404).json({ ok: false, error: "Usuario no existe" });

    const role = String(user.role || "guardia");
    const token = signEmployeeToken({ email, role, mustChangePassword: !!user.mustChangePassword });

    const home =
      (settings?.redirectsByRole && settings.redirectsByRole[role]) ||
      "/";

    res.json({
      ok: true,
      token,
      role,
      home,
      mustChangePassword: !!user.mustChangePassword,
    });
  } catch (e) { next(e); }
});

/**
 * POST /api/iam/v1/auth/change-password
 * - requiere token (lo conectamos luego con tu middleware real)
 * - por ahora, lo dejamos simple (luego lo amarramos a tu requireAuth/makeAuthMw)
 */
r.post("/change-password", async (req, res, next) => {
  try {
    const settings = await getIamSettings();
    if (!settings?.employee?.requirePasswordResetIfExpired) {
      return res.status(403).json({ ok: false, error: "Cambio de contraseña deshabilitado" });
    }

    // En integración final: sacar email del token (req.iam.email / req.auth.payload.email)
    const email = normEmail(req.body?.email);
    const currentPassword = String(req.body?.currentPassword || "");
    const newPassword = String(req.body?.newPassword || "");

    if (!email || !currentPassword || !newPassword) {
      return res.status(400).json({ ok: false, error: "email, currentPassword y newPassword son requeridos" });
    }

    const user = await IamUser.findOne({ email });
    if (!user) return res.status(404).json({ ok: false, error: "Usuario no existe" });

    const ok = await verifyPassword(currentPassword, user.passwordHash || user.password || "");
    if (!ok) return res.status(401).json({ ok: false, error: "Password actual incorrecto" });

    const newHash = await hashPassword(newPassword);
    user.passwordHash = newHash;
    user.mustChangePassword = false;
    await user.save();

    res.json({ ok: true });
  } catch (e) { next(e); }
});

export default r;