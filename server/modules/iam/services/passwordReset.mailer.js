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

function formatExpiry(expiresAt) {
  if (!expiresAt) return "15 minutos";

  const d = new Date(expiresAt);
  if (Number.isNaN(d.getTime())) return "15 minutos";

  try {
    return d.toLocaleString("es-HN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    });
  } catch {
    return d.toISOString();
  }
}

export async function sendResetEmail({ email, token, expiresAt }) {
  const safeEmail = String(email || "").trim().toLowerCase();
  const safeToken = String(token || "").trim().toUpperCase();

  if (!safeEmail) {
    const err = new Error("Email requerido para envío de recuperación.");
    err.code = "missing_email";
    throw err;
  }

  if (!safeToken) {
    const err = new Error("Token requerido para envío de recuperación.");
    err.code = "missing_token";
    throw err;
  }

  const mailer = getMailer();
  const subject = "Recuperación de contraseña - SENAF";
  const expiryText = formatExpiry(expiresAt);

  const html = `
    <div style="font-family:Arial,Helvetica,sans-serif;color:#0f172a;line-height:1.5">
      <h2>Recuperación de contraseña - SENAF</h2>
      <p>Se solicitó restablecer la contraseña de tu cuenta.</p>
      <p>Tu código temporal es:</p>
      <div style="font-size:32px;font-weight:700;letter-spacing:6px;margin:16px 0;color:#2563eb">
        ${esc(safeToken)}
      </div>
      <p>Este código vence el: <strong>${esc(expiryText)}</strong></p>
      <p>Si no solicitaste este cambio, ignora este mensaje.</p>
    </div>
  `;

  const text = `
Recuperación de contraseña - SENAF

Se solicitó restablecer la contraseña de tu cuenta.

Tu código temporal es: ${safeToken}

Vence: ${expiryText}

Si no solicitaste este cambio, ignora este mensaje.
  `.trim();

  try {
    console.log(
      `[password-reset] Intentando enviar correo a ${safeEmail}. NODE_ENV=${process.env.NODE_ENV || "undefined"} | prod=${isProd()}`
    );

    const result = await mailer.sendMail({
      to: safeEmail,
      subject,
      text,
      html,
    });

    console.log("[password-reset] Correo enviado correctamente a:", safeEmail);

    return {
      ok: true,
      email: safeEmail,
      subject,
      expiresAt: expiresAt || null,
      ...(result && typeof result === "object" ? result : {}),
    };
  } catch (error) {
    console.error(
      "[password-reset] Error enviando correo a",
      safeEmail,
      "|",
      error?.response || error?.code || error?.message || error
    );

    throw error;
  }
}