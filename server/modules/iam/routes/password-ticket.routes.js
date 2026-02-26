// server/modules/iam/routes/password-change-ticket.routes.js
import { Router } from "express";
import crypto from "node:crypto";
import IamUser from "../models/IamUser.model.js";

const r = Router();

function normEmail(v) {
  return String(v || "").trim().toLowerCase();
}

function isProd() {
  return String(process.env.NODE_ENV || "").toLowerCase() === "production";
}

function makeToken() {
  // 6 bytes => 12 hex chars (simple, suficiente para ticket temporal)
  return crypto.randomBytes(6).toString("hex").toUpperCase();
}

function hashToken(token) {
  const pepper = String(process.env.IAM_RESET_PEPPER || "").trim() || "dev_pepper";
  return crypto.createHash("sha256").update(`${pepper}:${token}`).digest("hex");
}

function pickAppBaseUrl() {
  // Debe apuntar a tu FRONTEND (donde existe /force-change-password)
  // Ej: https://urchin-app-fuirh.ondigitalocean.app
  const fromEnv =
    String(process.env.APP_BASE_URL || "").trim() ||
    String(process.env.VERIFY_BASE_URL || "").trim();

  return fromEnv.replace(/\/+$/g, "");
}

function buildTicketUrl({ email, token }) {
  const base = pickAppBaseUrl();
  // fallback seguro si no configuras env
  const fallback = "http://localhost:5173"; // ajusta si tu vite usa otro puerto
  const host = base || fallback;

  const qs = new URLSearchParams({
    email,
    token,
  });

  return `${host}/force-change-password?${qs.toString()}`;
}

/**
 * POST /api/iam/v1/auth/password-change-ticket
 * Body: { email }
 *
 * Devuelve: { ok:true, ticket:"https://.../force-change-password?email=...&token=..." }
 *
 * ✅ Sin Auth0:
 * - Genera token temporal y lo guarda hasheado (tempPassHash) con expiración.
 * - Recomendado: solo permitir si user.mustChangePassword === true (flujo admin-created).
 *
 * Seguridad:
 * - En PROD responde genérico si no existe / no aplica (evita enumeración).
 * - Puedes agregar rate-limit global (nginx/traefik) o middleware.
 */
r.post("/password-change-ticket", async (req, res) => {
  try {
    const email = normEmail(req.body?.email);
    if (!email) return res.status(400).json({ ok: false, error: "email_required" });

    const generic = () =>
      res.json({
        ok: true,
        ticket: null,
        message:
          "Si el usuario existe y aplica, se generó un enlace para cambiar la contraseña.",
      });

    const u = await IamUser.findOne({ email });
    if (!u) {
      // En PROD: genérico para no filtrar usuarios
      return isProd() ? generic() : res.status(404).json({ ok: false, error: "not_found" });
    }

    // Solo usuarios locales (ya que quitaste Auth0)
    if (u.provider !== "local") {
      return isProd()
        ? generic()
        : res.status(409).json({
            ok: false,
            error: "user_not_local",
            message: "Este usuario no es local (provider != local).",
          });
    }

    if (!u.active) {
      return isProd()
        ? generic()
        : res.status(403).json({ ok: false, error: "user_inactive" });
    }

    // ✅ Política: solo si debe cambiar contraseña (flujo admin-created / force reset)
    if (!u.mustChangePassword) {
      return isProd()
        ? generic()
        : res.status(409).json({
            ok: false,
            error: "not_required",
            message: "El usuario no está marcado para cambio forzoso (mustChangePassword=false).",
          });
    }

    // Token temporal
    const token = makeToken();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 15 * 60 * 1000); // 15 min

    u.tempPassHash = hashToken(token);
    u.tempPassExpiresAt = expiresAt;
    u.tempPassUsedAt = null;
    u.tempPassAttempts = 0;

    await u.save();

    // Ticket URL hacia el frontend
    const ticket = buildTicketUrl({ email: u.email, token });

    // ✅ En PROD, puedes decidir si devolver ticket o solo ok:true.
    // Como tu frontend espera "ticket", lo devolvemos.
    return res.json({
      ok: true,
      ticket,
      expiresAt: expiresAt.toISOString(),
    });
  } catch (e) {
    return res
      .status(500)
      .json({ ok: false, error: "server_error", message: e?.message || String(e) });
  }
});

export default r;