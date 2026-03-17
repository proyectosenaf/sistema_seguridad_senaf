// server/modules/iam/services/passwordReset.mailer.js
import { makeMailer } from "../../../src/core/mailer/mailer.js";

let _mailer = null;

function getMailer() {
  if (!_mailer) _mailer = makeMailer();
  return _mailer;
}

function isProd() {
  return process.env.NODE_ENV === "production";
}

function esc(s) {
  return String(s || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export async function sendResetEmail({ email, token, expiresAt }) {
  if (!email) {
    return {
      ok: false,
      error: "missing_email",
      message: "Email requerido para envío de recuperación",
    };
  }

  if (!isProd()) {
    console.log(
      "[password-reset] DEV token for",
      email,
      "=>",
      token,
      "expires:",
      expiresAt
    );

    return {
      ok: true,
      dev: true,
      simulated: true,
    };
  }

  const mailer = getMailer();
  const subject = "Recuperación de contraseña - SENAF";

  const expiryText = expiresAt
    ? new Date(expiresAt).toLocaleString("es-HN")
    : "15 minutos";

  const html = `
    <div style="font-family:Arial,Helvetica,sans-serif;color:#0f172a;line-height:1.5">
      <h2>Recuperación de contraseña - SENAF</h2>
      <p>Se solicitó restablecer la contraseña de tu cuenta.</p>
      <p>Tu código temporal es:</p>
      <div style="font-size:32px;font-weight:700;letter-spacing:6px;margin:16px 0;color:#2563eb">
        ${esc(token)}
      </div>
      <p>Este código vence el: <strong>${esc(expiryText)}</strong></p>
      <p>Si no solicitaste este cambio, ignora este mensaje.</p>
    </div>
  `;

  const text = `
Recuperación de contraseña - SENAF

Se solicitó restablecer la contraseña de tu cuenta.

Tu código temporal es: ${token}

Vence: ${expiryText}

Si no solicitaste este cambio, ignora este mensaje.
  `.trim();

  return await mailer.sendMail({
    to: email,
    subject,
    text,
    html,
  });
}