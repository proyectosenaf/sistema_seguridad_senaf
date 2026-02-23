import { makeMailer } from "../../../src/core/mailer/mailer.js";

const mailer = makeMailer();

export async function sendOtpEmail({ to, code, purpose }) {
  const subject = purpose === "employee-login"
    ? "Código de verificación SENAF (Empleado)"
    : "Código de verificación SENAF";

  const text = `Tu código de verificación es: ${code}\nEste código expira pronto.`;
  const html = `<p>Tu código de verificación es:</p><h2>${code}</h2><p>Este código expira pronto.</p>`;

  return mailer.sendMail({ to, subject, text, html });
}