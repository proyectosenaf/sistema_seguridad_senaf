import { Router } from "express";
import jwt from "jsonwebtoken";
import { getIamSettings } from "../../iam/services/settings.service.js";
import { createOtp, verifyOtp } from "../../iam/services/otp.service.js";
import { sendOtpEmail } from "../../iam/services/otp.mailer.js";
import { normEmail } from "../../iam/utils/otp.util.js";

const r = Router();

function signVisitorToken({ email, role }) {
  const secret = process.env.JWT_SECRET || "dev_jwt_secret";
  const payload = {
    typ: "visitor",
    email,
    role,
    permissions: ["agenda.read", "agenda.create"], // luego lo parametrizas vía roles/perms
  };
  return jwt.sign(payload, secret, { expiresIn: "8h" });
}

r.post("/start", async (req, res, next) => {
  try {
    const settings = await getIamSettings();
    if (!settings?.visitor?.enabled) return res.status(403).json({ ok: false, error: "Registro público deshabilitado" });

    const email = normEmail(req.body?.email);
    if (!email) return res.status(400).json({ ok: false, error: "Email requerido" });

    const { otpId, code, expiresAt } = await createOtp({ email, purpose: "visitor-login" });
    await sendOtpEmail({ to: email, code, purpose: "visitor-login" });

    res.json({ ok: true, step: "OTP_REQUIRED", otpId, expiresAt, channel: "email" });
  } catch (e) { next(e); }
});

r.post("/verify", async (req, res, next) => {
  try {
    const settings = await getIamSettings();
    const email = normEmail(req.body?.email);
    const otpId = String(req.body?.otpId || "").trim();
    const code = String(req.body?.code || "").trim();

    if (!email || !otpId || !code) return res.status(400).json({ ok: false, error: "email, otpId y code son requeridos" });

    await verifyOtp({ otpId, email, code, purpose: "visitor-login" });

    const role = settings?.visitor?.role || "visita";
    const token = signVisitorToken({ email, role });

    const home = settings?.visitor?.redirect || settings?.redirectsByRole?.[role] || "/agenda-citas";

    res.json({ ok: true, token, role, home, mustChangePassword: false });
  } catch (e) { next(e); }
});

export default r;