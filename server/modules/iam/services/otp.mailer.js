// server/modules/iam/services/otp.mailer.js
import { makeMailer } from "../../../src/core/mailer/mailer.js";

let _mailer = null;

function getMailer() {
  if (!_mailer) _mailer = makeMailer();
  return _mailer;
}

function esc(s) {
  return String(s || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function getOtpTtlMinutes() {
  const raw = Number(process.env.OTP_TTL_SECONDS);
  const ttlSeconds = Number.isFinite(raw) && raw > 0 ? raw : 300;
  return Math.max(1, Math.ceil(ttlSeconds / 60));
}

export async function sendOtpEmail({ to, code, purpose }) {
  const appName = String(process.env.APP_NAME || "SENAF").trim() || "SENAF";
  const email = String(to || "").trim().toLowerCase();
  const otpCode = String(code || "").trim();
  const ttlMinutes = getOtpTtlMinutes();

  if (!email) {
    return {
      ok: false,
      error: "mail_to_required",
      message: "No se proporcionó destinatario para el OTP.",
    };
  }

  if (!otpCode) {
    return {
      ok: false,
      error: "mail_code_required",
      message: "No se proporcionó código OTP para enviar.",
    };
  }

  const isEmployee = purpose === "employee-login";

  const subject = isEmployee
    ? `${appName} — Código de verificación (Empleado)`
    : `${appName} — Código de verificación`;

  const text = [
    `Tu código de verificación es: ${otpCode}`,
    "",
    `Este código expira en aproximadamente ${ttlMinutes} minuto${ttlMinutes === 1 ? "" : "s"}.`,
    "",
    "Si no solicitaste este acceso, puedes ignorar este mensaje.",
  ].join("\n");

  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.5;color:#0f172a">
      <h2 style="margin:0 0 12px 0;">${esc(appName)}</h2>
      <p style="margin:0 0 12px 0;">
        Tu código de verificación es:
      </p>
      <div style="
        display:inline-block;
        font-size:28px;
        font-weight:700;
        letter-spacing:4px;
        padding:12px 18px;
        border-radius:10px;
        background:#f8fafc;
        border:1px solid #e2e8f0;
        color:#0f172a;
        margin-bottom:12px;
      ">
        ${esc(otpCode)}
      </div>
      <p style="margin:0 0 8px 0;color:#475569;">
        Este código expira en aproximadamente ${ttlMinutes} minuto${ttlMinutes === 1 ? "" : "s"}.
      </p>
      <p style="margin:0;color:#64748b;font-size:13px;">
        Si no solicitaste este acceso, puedes ignorar este mensaje.
      </p>
    </div>
  `;

  const mailer = getMailer();
  return mailer.sendMail({
    to: email,
    subject,
    text,
    html,
  });
}