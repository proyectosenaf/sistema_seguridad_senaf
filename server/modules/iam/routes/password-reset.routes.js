// server/modules/iam/routes/password-reset.routes.js
import { Router } from "express";

const r = Router();

function normEmail(v) {
  return String(v || "").trim().toLowerCase();
}

/**
 * POST /api/iam/v1/auth/request-password-reset
 * Body: { email }
 *
 * Env requeridas:
 * - AUTH0_DOMAIN            (ej: dev-xxxx.us.auth0.com)  -> sin https://
 * - AUTH0_CLIENT_ID         (client id de tu app o una app M2M si prefieres)
 *
 * Nota:
 * - Esto dispara el email de reset de Auth0 (no cambia password aquí)
 */
r.post("/request-password-reset", async (req, res) => {
  try {
    const email = normEmail(req.body?.email);
    if (!email) return res.status(400).json({ ok: false, error: "email_required" });

    const domainRaw = String(process.env.AUTH0_DOMAIN || "").trim();
    const domain = domainRaw.replace(/^https?:\/\//i, "").replace(/\/+$/g, "");
    const clientId = String(process.env.AUTH0_CLIENT_ID || "").trim();

    if (!domain || !clientId) {
      return res.status(500).json({
        ok: false,
        error: "missing_auth0_env",
        message: "Falta AUTH0_DOMAIN o AUTH0_CLIENT_ID en el backend.",
      });
    }

    // ✅ Connection exacta (según tu captura)
    const connection = "Autenticación de usuario-contraseña";

    const url = `https://${domain}/dbconnections/change_password`;

    // Node 18+ tiene fetch global
    if (typeof fetch !== "function") {
      return res.status(500).json({
        ok: false,
        error: "fetch_not_available",
        message: "Tu Node no tiene fetch global. Usa Node 18+ o instala node-fetch.",
      });
    }

    const response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        client_id: clientId,
        email,
        connection,
      }),
    });

    const text = await response.text().catch(() => "");

    if (!response.ok) {
      return res.status(502).json({
        ok: false,
        error: "auth0_change_password_failed",
        status: response.status,
        details: text,
      });
    }

    return res.json({
      ok: true,
      message: "Reset email enviado (Auth0). Revisa tu correo.",
      raw: text, // Auth0 suele devolver un string tipo "We've just sent you an email..."
    });
  } catch (e) {
    return res.status(500).json({ ok: false, error: "server_error", message: e?.message || String(e) });
  }
});

export default r;