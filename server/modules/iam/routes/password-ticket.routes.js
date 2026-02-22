import { Router } from "express";
import IamUser from "../models/IamUser.model.js";
import { devOr, requirePerm } from "../utils/rbac.util.js";
import { auth0CreatePasswordChangeTicket } from "../utils/auth0-mgmt.util.js";

const r = Router();

function normEmail(v) {
  return String(v || "").trim().toLowerCase();
}

/**
 * POST /api/iam/v1/auth/password-change-ticket
 * Body: { email }
 *
 * Devuelve: { ok:true, ticket:"https://..." }
 *
 * - No requiere login del usuario final (porque se usará desde /force-change-password),
 *   pero para seguridad, puedes protegerlo con un secret temporal o con rate-limit.
 * - Recomendado: permitir solo si el usuario tiene createdByAdmin/forcePwReset en Mongo
 */
r.post("/password-change-ticket", async (req, res) => {
  try {
    const email = normEmail(req.body?.email);
    if (!email) return res.status(400).json({ ok: false, error: "email_required" });

    const u = await IamUser.findOne({ email }).lean();
    if (!u) return res.status(404).json({ ok: false, error: "not_found" });

    if (!u.auth0Sub) {
      return res.status(409).json({
        ok: false,
        error: "missing_auth0Sub",
        message: "Este usuario no está vinculado a Auth0 (auth0Sub).",
      });
    }

    // URL a donde vuelve después del cambio
    const resultUrl =
      process.env.VERIFY_BASE_URL
        ? String(process.env.VERIFY_BASE_URL).replace(/\/verify\/?$/, "/")
        : undefined;

    const data = await auth0CreatePasswordChangeTicket({
      user_id: u.auth0Sub,
      result_url: resultUrl || "https://urchin-app-fuirh.ondigitalocean.app/",
    });

    return res.json({ ok: true, ticket: data?.ticket || null });
  } catch (e) {
    return res.status(500).json({ ok: false, error: "server_error", message: e?.message || String(e) });
  }
});

export default r;