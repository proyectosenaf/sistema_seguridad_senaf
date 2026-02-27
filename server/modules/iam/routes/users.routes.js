// server/modules/iam/routes/users.routes.js
import { Router } from "express";
import IamUser from "../models/IamUser.model.js";

const r = Router();

/* ===================== Helpers ===================== */
function normEmail(e) {
  return String(e || "").trim().toLowerCase();
}

function toStringArray(v) {
  if (Array.isArray(v)) return v.map(String).map((s) => s.trim()).filter(Boolean);
  if (typeof v === "string") return v.split(",").map((s) => s.trim()).filter(Boolean);
  return [];
}

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function pickUser(u) {
  if (!u) return null;
  return {
    _id: u._id,
    email: u.email,
    name: u.name || "",
    active: u.active !== false,
    roles: Array.isArray(u.roles) ? u.roles : [],
    perms: Array.isArray(u.perms) ? u.perms : [],

    mustChangePassword: !!u.mustChangePassword,
    passwordChangedAt: u.passwordChangedAt || null,
    passwordExpiresAt: u.passwordExpiresAt || null,

    lastLoginAt: u.lastLoginAt || null,
    lastLoginIp: u.lastLoginIp || "",

    createdAt: u.createdAt,
    updatedAt: u.updatedAt,

    // compat UI (por si tu tabla espera nombreCompleto/correoPersona)
    nombreCompleto: u.name || "",
    correoPersona: u.email || "",
  };
}

/**
 * Input del UsersPage (form) -> schema real
 * - correoPersona -> email
 * - nombreCompleto -> name
 * - roles, active -> direct
 */
function mapBodyToIamUser(body = {}) {
  const email = normEmail(body.email || body.correoPersona);
  const name = String(body.name || body.nombreCompleto || "").trim();

  const roles = toStringArray(body.roles);
  const active = body.active === false ? false : true;

  // flags opcionales
  const mustChangePassword =
    body.mustChangePassword === true ||
    String(body.mustChangePassword || "").toLowerCase() === "true" ||
    String(body.mustChangePassword || "") === "1";

  return { email, name, roles, active, mustChangePassword };
}

/* ===================== Routes ===================== */

/**
 * GET /api/iam/v1/users?q=
 */
r.get("/", async (req, res, next) => {
  try {
    const q = String(req.query.q || "").trim();
    const query = {};

    if (q) {
      const rx = new RegExp(escapeRegex(q), "i");
      query.$or = [{ name: rx }, { email: rx }];
    }

    const items = await IamUser.find(query).sort({ createdAt: -1 }).limit(500).lean();
    res.json({ ok: true, items: items.map(pickUser) });
  } catch (e) {
    next(e);
  }
});

/**
 * GET /api/iam/v1/users/guards?active=1&q=
 */
r.get("/guards", async (req, res, next) => {
  try {
    const q = String(req.query.q || "").trim();
    const onlyActive = String(req.query.active || "") === "1";

    const query = {
      roles: { $in: ["guardia", "guard", "security_guard"] },
    };

    if (onlyActive) query.active = { $ne: false };

    if (q) {
      const rx = new RegExp(escapeRegex(q), "i");
      query.$or = [{ name: rx }, { email: rx }];
    }

    const items = await IamUser.find(query).sort({ createdAt: -1 }).limit(500).lean();
    res.json({ ok: true, items: items.map(pickUser) });
  } catch (e) {
    next(e);
  }
});

/**
 * GET /api/iam/v1/users/:id
 */
r.get("/:id", async (req, res, next) => {
  try {
    const id = String(req.params.id || "").trim();
    const u = await IamUser.findById(id).lean();
    if (!u) return res.status(404).json({ ok: false, message: "Usuario no encontrado" });
    res.json({ ok: true, item: pickUser(u) });
  } catch (e) {
    next(e);
  }
});

/**
 * POST /api/iam/v1/users
 * Crea usuario (NO setea passwordHash aquí)
 * Body: { correoPersona/email, nombreCompleto/name, roles[], active }
 */
r.post("/", async (req, res, next) => {
  try {
    const body = req.body || {};
    const { email, name, roles, active, mustChangePassword } = mapBodyToIamUser(body);

    if (!email) return res.status(400).json({ ok: false, message: "email/correoPersona requerido" });
    if (!name) return res.status(400).json({ ok: false, message: "name/nombreCompleto requerido" });
    if (!roles.length) return res.status(400).json({ ok: false, message: "roles requerido (al menos 1)" });

    const exists = await IamUser.findOne({ email }).lean();
    if (exists) return res.status(409).json({ ok: false, message: "Ya existe un usuario con ese correo" });

    const doc = await IamUser.create({
      email,
      name,
      roles,
      active,
      mustChangePassword: !!mustChangePassword,
      // passwordHash se gestiona en /auth (login/crear temp password) en tu flujo real
    });

    res.status(201).json({ ok: true, item: pickUser(doc.toObject ? doc.toObject() : doc) });
  } catch (e) {
    // error típico por índice unique email
    if (e?.code === 11000) {
      return res.status(409).json({ ok: false, message: "Ya existe un usuario con ese correo" });
    }
    next(e);
  }
});

/**
 * PATCH /api/iam/v1/users/:id
 * Actualiza usuario (name/email/roles/active/mustChangePassword)
 */
r.patch("/:id", async (req, res, next) => {
  try {
    const id = String(req.params.id || "").trim();
    const body = req.body || {};

    const update = {};
    if (body.email != null || body.correoPersona != null) update.email = normEmail(body.email || body.correoPersona);
    if (body.name != null || body.nombreCompleto != null)
      update.name = String(body.name || body.nombreCompleto || "").trim();
    if (body.roles != null) update.roles = toStringArray(body.roles);
    if (body.active != null) update.active = body.active === false ? false : true;
    if (body.mustChangePassword != null) update.mustChangePassword = !!body.mustChangePassword;

    const u = await IamUser.findByIdAndUpdate(id, update, { new: true }).lean();
    if (!u) return res.status(404).json({ ok: false, message: "Usuario no encontrado" });

    res.json({ ok: true, item: pickUser(u) });
  } catch (e) {
    if (e?.code === 11000) {
      return res.status(409).json({ ok: false, message: "Ya existe un usuario con ese correo" });
    }
    next(e);
  }
});

/**
 * POST /api/iam/v1/users/:id/enable
 */
r.post("/:id/enable", async (req, res, next) => {
  try {
    const id = String(req.params.id || "").trim();
    const u = await IamUser.findByIdAndUpdate(id, { active: true }, { new: true }).lean();
    if (!u) return res.status(404).json({ ok: false, message: "Usuario no encontrado" });
    res.json({ ok: true, item: pickUser(u) });
  } catch (e) {
    next(e);
  }
});

/**
 * POST /api/iam/v1/users/:id/disable
 */
r.post("/:id/disable", async (req, res, next) => {
  try {
    const id = String(req.params.id || "").trim();
    const u = await IamUser.findByIdAndUpdate(id, { active: false }, { new: true }).lean();
    if (!u) return res.status(404).json({ ok: false, message: "Usuario no encontrado" });
    res.json({ ok: true, item: pickUser(u) });
  } catch (e) {
    next(e);
  }
});

/**
 * DELETE /api/iam/v1/users/:id
 */
r.delete("/:id", async (req, res, next) => {
  try {
    const id = String(req.params.id || "").trim();
    const u = await IamUser.findByIdAndDelete(id).lean();
    if (!u) return res.status(404).json({ ok: false, message: "Usuario no encontrado" });
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

export default r;