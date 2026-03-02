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

export async function sendOtpEmail({ to, code, purpose }) {
  const appName = String(process.env.APP_NAME || "SENAF").trim() || "SENAF";

  const subject =
    purpose === "employee-login"
      ? `${appName} — Código de verificación (Empleado)`
      : `${appName} — Código de verificación`;

  const text = `Tu código de verificación es: ${code}\n\nEste código expira pronto.`;

  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.5">
      <h2>${esc(appName)}</h2>
      <p>Tu código de verificación es:</p>
      <div style="font-size:28px;font-weight:bold;letter-spacing:4px">${esc(code)}</div>
      <p style="color:#666">Este código expira pronto.</p>
    </div>
  `;

  const mailer = getMailer();
  return mailer.sendMail({ to, subject, text, html });
}