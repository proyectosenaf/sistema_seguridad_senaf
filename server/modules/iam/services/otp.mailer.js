// server/modules/iam/services/otp.mailer.js
import { makeMailer } from "../../../src/core/mailer/mailer.js";

const mailer = makeMailer();

function envStr(name, def = null) {
  const v = String(process.env[name] || "").trim();
  return v || def;
}

export async function sendOtpEmail({ to, code, purpose }) {
  const appName = envStr("APP_NAME", "SENAF");

  const subject =
    purpose === "employee-login"
      ? `${appName} — Código de verificación (Empleado)`
      : `${appName} — Código de verificación`;

  const text = `Tu código de verificación es: ${code}\n\nEste código expira pronto.`;

  const html = `
    <div style="font-family:Arial,sans-serif">
      <h2>${appName}</h2>
      <p>Tu código de verificación es:</p>
      <div style="font-size:28px;font-weight:bold;letter-spacing:4px">${code}</div>
      <p style="color:#666">Este código expira pronto.</p>
    </div>
  `;

  const result = await mailer.sendMail({ to, subject, text, html });

  if (!result?.ok) {
    // Log útil para producción (sin exponer secretos)
    console.error("[otp.mailer] sendOtpEmail FAILED:", {
      to,
      purpose,
      error: result?.error,
      message: result?.message,
    });
  }

  return result;
}