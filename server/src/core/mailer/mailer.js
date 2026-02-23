export function makeMailer() {
  return {
    async sendMail({ to, subject, text, html }) {
      // TODO: conecta SES/SendGrid/SMTP aquí.
      // Por ahora, no rompe: log controlado.
      console.log("[mailer] sendMail ->", { to, subject, text: !!text, html: !!html });
      return { ok: true };
    },
  };
}