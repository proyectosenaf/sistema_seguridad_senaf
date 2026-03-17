// server/src/core/mailer/mailer.js
import nodemailer from "nodemailer";

const IS_PROD = process.env.NODE_ENV === "production";

function envStr(name) {
  const v = String(process.env[name] || "").trim();
  return v || null;
}

function envBool(name, def = false) {
  const v = String(process.env[name] ?? "").trim().toLowerCase();
  if (!v) return def;
  return ["1", "true", "yes", "on"].includes(v);
}

function envNum(name, def) {
  const n = Number(process.env[name]);
  return Number.isFinite(n) ? n : def;
}

/**
 * Mailer SMTP robusto (centralizado)
 * Vars:
 * - MAIL_HOST, MAIL_PORT, MAIL_USER, MAIL_PASS
 * - MAIL_FROM (opcional; si no, usa MAIL_USER)
 * - MAIL_SECURE (opcional: 1/0; si no, infiere por puerto 465)
 * - MAIL_TLS_REJECT_UNAUTHORIZED (opcional, default true)
 * - MAIL_REQUIRE_TLS (opcional; default true si puerto 587)
 * - MAIL_DEV_FALLBACK (opcional; default true en dev, false en prod)
 * - MAIL_DEBUG (opcional; logs nodemailer)
 * - MAIL_CONNECTION_TIMEOUT_MS
 * - MAIL_GREETING_TIMEOUT_MS
 * - MAIL_SOCKET_TIMEOUT_MS
 * - MAIL_POOL
 * - MAIL_MAX_CONNECTIONS
 * - MAIL_MAX_MESSAGES
 */
export function makeMailer() {
  const host = envStr("MAIL_HOST");
  const port = envNum("MAIL_PORT", 587);

  const secure =
    process.env.MAIL_SECURE === undefined
      ? port === 465
      : envBool("MAIL_SECURE", false);

  const user = envStr("MAIL_USER");
  const pass = envStr("MAIL_PASS");
  const from = envStr("MAIL_FROM") || user;

  const rejectUnauthorized = envBool("MAIL_TLS_REJECT_UNAUTHORIZED", true);

  // En 587 muchas veces conviene forzar STARTTLS
  const requireTLS =
    process.env.MAIL_REQUIRE_TLS === undefined
      ? port === 587
      : envBool("MAIL_REQUIRE_TLS", false);

  // En dev simula si falta config; en prod NO.
  const DEV_FALLBACK = envBool("MAIL_DEV_FALLBACK", !IS_PROD);
  const DEBUG = envBool("MAIL_DEBUG", false);

  // Si falta config SMTP
  if (!host || !user || !pass || !from) {
    return {
      async sendMail({ to, subject, text, html }) {
        if (DEV_FALLBACK) {
          console.warn("[mailer] SMTP no configurado. (DEV_FALLBACK) Simulando envío:", {
            to,
            subject,
            hasText: !!text,
            hasHtml: !!html,
          });

          return {
            ok: true,
            dev: true,
            simulated: true,
          };
        }

        return {
          ok: false,
          error: "mail_not_configured",
          message:
            "SMTP no configurado. Define MAIL_HOST, MAIL_PORT, MAIL_USER, MAIL_PASS (y opcional MAIL_FROM).",
        };
      },
    };
  }

  const transport = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },

    requireTLS,
    tls: { rejectUnauthorized },

    connectionTimeout: envNum("MAIL_CONNECTION_TIMEOUT_MS", 15000),
    greetingTimeout: envNum("MAIL_GREETING_TIMEOUT_MS", 15000),
    socketTimeout: envNum("MAIL_SOCKET_TIMEOUT_MS", 20000),

    pool: envBool("MAIL_POOL", true),
    maxConnections: envNum("MAIL_MAX_CONNECTIONS", 3),
    maxMessages: envNum("MAIL_MAX_MESSAGES", 100),

    logger: DEBUG,
    debug: DEBUG,
  });

  let verified = false;

  async function verifyOnce() {
    if (verified) return;

    try {
      await transport.verify();
      verified = true;

      console.log("[mailer] SMTP verify OK:", {
        host,
        port,
        secure,
        requireTLS,
        user,
      });
    } catch (e) {
      console.error("[mailer] SMTP verify FAILED:", e?.message || e, {
        host,
        port,
        secure,
        requireTLS,
        user,
      });
      // No matamos el proceso; sendMail también fallará con detalle.
    }
  }

  return {
    async sendMail({ to, subject, text, html }) {
      await verifyOnce();

      try {
        const info = await transport.sendMail({
          from,
          to,
          subject,
          text,
          html,
        });

        const accepted = Array.isArray(info.accepted) ? info.accepted : [];
        const rejected = Array.isArray(info.rejected) ? info.rejected : [];

        if (rejected.length > 0 && accepted.length === 0) {
          console.error("[mailer] rejected by provider:", {
            rejected,
            response: info.response,
          });

          return {
            ok: false,
            error: "mail_rejected",
            message: info.response || "Proveedor rechazó el envío",
          };
        }

        return {
          ok: true,
          messageId: info.messageId,
          accepted,
          rejected,
          response: info.response,
        };
      } catch (e) {
        console.error("[mailer] sendMail FAILED:", e?.message || e);

        return {
          ok: false,
          error: "mail_send_failed",
          message: e?.message || String(e),
        };
      }
    },
  };
}