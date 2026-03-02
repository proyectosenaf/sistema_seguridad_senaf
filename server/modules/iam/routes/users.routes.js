// server/modules/iam/routes/users.routes.js
import { Router } from "express";
import mongoose from "mongoose";
import IamUser from "../models/IamUser.model.js";
import { devOr, requirePerm } from "../utils/rbac.util.js";
import { writeAudit } from "../utils/audit.util.js";
import { hashPassword } from "../utils/password.util.js";

const r = Router();

/* ===================== Middlewares ===================== */

const MW_USERS_MANAGE = devOr(requirePerm("iam.users.manage"));
const MW_USERS_VIEW = devOr(requirePerm("iam.users.view")); // si no lo tienes, usa manage en ambos

/* ===================== Helpers ===================== */

function isValidObjectId(id) {
  return mongoose.Types.ObjectId.isValid(String(id || ""));
}

function auditSafe(req, payload, label) {
  return writeAudit(req, payload).catch((e) => {
    console.warn(`[IAM][AUDIT ${label}] error (no bloquea):`, e?.message || e);
  });
}

function normEmail(e) {
  return String(e || "").trim().toLowerCase();
}

function toStringArray(v) {
  if (Array.isArray(v)) return v.map(String).map((s) => s.trim()).filter(Boolean);
  if (typeof v === "string") return v.split(",").map((s) => s.trim()).filter(Boolean);
  return [];
}

function escapeRegex(s = "") {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function parseBool(v, def = false) {
  if (v === undefined || v === null) return def;
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v === 1;
  const s = String(v).trim().toLowerCase();
  if (["1", "true", "yes", "y", "on"].includes(s)) return true;
  if (["0", "false", "no", "n", "off"].includes(s)) return false;
  return def;
}

function hasRole(roles, role) {
  const rr = Array.isArray(roles) ? roles : [];
  return rr.map((x) => String(x).toLowerCase()).includes(String(role).toLowerCase());
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

    // compat UI
    nombreCompleto: u.name || "",
    correoPersona: u.email || "",
  };
}

/**
 * Input del UsersPage (form) -> schema real
 */
function mapBodyToIamUser(body = {}) {
  const email = normEmail(body.email || body.correoPersona);
  const name = String(body.name || body.nombreCompleto || "").trim();

  const roles = toStringArray(body.roles);
  const active = body.active === false ? false : true;

  // checkbox del UI
  const mustChangePasswordRaw = body.mustChangePassword ?? body.forcePwChange;

  // password sanitizado
  const password = body.password != null ? String(body.password).trim() : "";

  return { email, name, roles, active, mustChangePasswordRaw, password };
}

/**
 * Fechas desde inputs type="date" (YYYY-MM-DD):
 * - from => inicio del día (incluyente)
 * - to   => fin del rango (EXCLUSIVO) = inicio del día siguiente
 *
 * Esto arregla el bug donde "Hasta 2026-03-01" se convertía a 2026-03-01T00:00Z
 * y excluía todo lo creado durante ese día.
 */
function isDateOnlyString(s) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(s || "").trim());
}

function parseDateFromStart(s) {
  const raw = String(s || "").trim();
  if (!raw) return null;

  if (isDateOnlyString(raw)) {
    // interpretamos como "inicio del día" en UTC (lo importante es consistencia)
    // 2026-03-01 => 2026-03-01T00:00:00.000Z
    const d = new Date(`${raw}T00:00:00.000Z`);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

function parseDateToExclusive(s) {
  const raw = String(s || "").trim();
  if (!raw) return null;

  if (isDateOnlyString(raw)) {
    // "hasta" inclusivo por día => usamos límite exclusivo del día siguiente
    const base = new Date(`${raw}T00:00:00.000Z`);
    if (Number.isNaN(base.getTime())) return null;
    const next = new Date(base.getTime() + 24 * 60 * 60 * 1000);
    return next;
  }

  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

/* ===================== Routes ===================== */

/**
 * GET /api/iam/v1/users
 *
 * Query params:
 * - q
 * - onlyActive=1|0  (default: true)
 * - createdFrom=YYYY-MM-DD
 * - createdTo=YYYY-MM-DD   (incluye todo el día)
 * - limit (default: 5 sin filtros; 2000 con filtros)
 * - skip (default: 0)
 *
 * Response:
 * { ok, items, meta: { total, limit, skip, hasMore, hasFilters, onlyActive } }
 */
r.get("/", MW_USERS_VIEW, async (req, res, next) => {
  try {
    const q = String(req.query.q || "").trim();

    // default recomendado: solo activos
    const onlyActive = parseBool(req.query.onlyActive, true) || String(req.query.active || "") === "1";

    const createdFromRaw = String(req.query.createdFrom || req.query.from || "").trim();
    const createdToRaw = String(req.query.createdTo || req.query.to || "").trim();

    const createdFrom = parseDateFromStart(createdFromRaw);      // incluyente
    const createdToExcl = parseDateToExclusive(createdToRaw);    // EXCLUSIVO (si es date-only)

    const query = {};

    if (onlyActive) query.active = { $ne: false };

    if (q) {
      const rx = new RegExp(escapeRegex(q), "i");
      query.$or = [{ name: rx }, { email: rx }];
    }

    if (createdFrom || createdToExcl) {
      query.createdAt = {};
      if (createdFrom) query.createdAt.$gte = createdFrom;
      if (createdToExcl) {
        // si era date-only => usamos $lt nextDay
        // si era datetime => usamos $lte exacto
        query.createdAt[isDateOnlyString(createdToRaw) ? "$lt" : "$lte"] = createdToExcl;
      }
    }

    // hasFilters SOLO cuando hay q o fechas (onlyActive es default)
    const hasFilters = !!q || !!query.createdAt;

    const limitParam = Number(req.query.limit || 0);
    const skipParam = Number(req.query.skip || 0);

    const limit =
      Number.isFinite(limitParam) && limitParam > 0
        ? Math.min(limitParam, 2000)
        : hasFilters
        ? 2000
        : 5;

    const skip = Number.isFinite(skipParam) && skipParam > 0 ? Math.max(0, skipParam) : 0;

    const [total, items] = await Promise.all([
      IamUser.countDocuments(query),
      IamUser.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    ]);

    const hasMore = skip + items.length < total;

    return res.json({
      ok: true,
      items: items.map(pickUser),
      meta: { total, limit, skip, hasMore, hasFilters, onlyActive },
    });
  } catch (e) {
    next(e);
  }
});

r.get("/guards", MW_USERS_VIEW, async (req, res, next) => {
  try {
    const q = String(req.query.q || "").trim();
    const onlyActive = String(req.query.active || "") === "1";

    const query = { roles: { $in: ["guardia", "guard", "security_guard"] } };
    if (onlyActive) query.active = { $ne: false };

    if (q) {
      const rx = new RegExp(escapeRegex(q), "i");
      query.$or = [{ name: rx }, { email: rx }];
    }

    const items = await IamUser.find(query).sort({ createdAt: -1 }).limit(500).lean();
    return res.json({ ok: true, items: items.map(pickUser) });
  } catch (e) {
    next(e);
  }
});

r.get("/:id", MW_USERS_VIEW, async (req, res, next) => {
  try {
    const id = String(req.params.id || "").trim();
    if (!isValidObjectId(id)) return res.status(400).json({ ok: false, message: "ID inválido" });

    const u = await IamUser.findById(id).lean();
    if (!u) return res.status(404).json({ ok: false, message: "Usuario no encontrado" });

    return res.json({ ok: true, item: pickUser(u) });
  } catch (e) {
    next(e);
  }
});

/**
 * POST /api/iam/v1/users  (crear por ADMIN)
 */
r.post("/", MW_USERS_MANAGE, async (req, res, next) => {
  try {
    const { email, name, roles, active, mustChangePasswordRaw, password } = mapBodyToIamUser(req.body || {});

    if (!email) return res.status(400).json({ ok: false, message: "email/correoPersona requerido" });
    if (!name) return res.status(400).json({ ok: false, message: "name/nombreCompleto requerido" });
    if (!roles.length) return res.status(400).json({ ok: false, message: "roles requerido (al menos 1)" });

    const isVisitor = hasRole(roles, "visita");

    if (!isVisitor && !password) {
      return res.status(400).json({
        ok: false,
        message: "password requerido para usuarios internos (no visitantes).",
      });
    }

    const exists = await IamUser.findOne({ email }).lean();
    if (exists) return res.status(409).json({ ok: false, message: "Ya existe un usuario con ese correo" });

    const mustChangePassword = isVisitor ? false : parseBool(mustChangePasswordRaw, true);
    const passwordHash = password ? await hashPassword(password) : "";

    const doc = await IamUser.create({
      email,
      name,
      roles,
      active,
      provider: "local",
      mustChangePassword,
      passwordHash,
      passwordChangedAt: password ? new Date() : null,

      tempPassHash: "",
      tempPassExpiresAt: null,
      tempPassUsedAt: null,
      tempPassAttempts: 0,

      otpVerifiedAt: null,
    });

    await auditSafe(
      req,
      {
        action: "create",
        entity: "user",
        entityId: doc._id.toString(),
        before: null,
        after: {
          email: doc.email,
          name: doc.name,
          roles: doc.roles || [],
          active: doc.active !== false,
          mustChangePassword: !!doc.mustChangePassword,
        },
      },
      "create user"
    );

    return res.status(201).json({ ok: true, item: pickUser(doc.toObject ? doc.toObject() : doc) });
  } catch (e) {
    if (e?.code === 11000) return res.status(409).json({ ok: false, message: "Ya existe un usuario con ese correo" });
    next(e);
  }
});

r.patch("/:id", MW_USERS_MANAGE, async (req, res, next) => {
  try {
    const id = String(req.params.id || "").trim();
    if (!isValidObjectId(id)) return res.status(400).json({ ok: false, message: "ID inválido" });

    const body = req.body || {};
    const update = {};

    if (body.email != null || body.correoPersona != null) update.email = normEmail(body.email || body.correoPersona);
    if (body.name != null || body.nombreCompleto != null) update.name = String(body.name || body.nombreCompleto || "").trim();

    let newRoles = null;
    if (body.roles != null) {
      const roles = toStringArray(body.roles);
      if (!roles.length) return res.status(400).json({ ok: false, message: "roles requerido (al menos 1)" });
      newRoles = roles;
      update.roles = roles;
    }

    if (body.active != null) update.active = body.active === false ? false : true;

    if (body.mustChangePassword != null || body.forcePwChange != null) {
      update.mustChangePassword = parseBool(body.mustChangePassword ?? body.forcePwChange, false);
    }

    if (body.password != null) {
      const pwd = String(body.password).trim();
      if (pwd.length > 0) {
        update.passwordHash = await hashPassword(pwd);
        update.passwordChangedAt = new Date();

        update.tempPassHash = "";
        update.tempPassExpiresAt = null;
        update.tempPassUsedAt = null;
        update.tempPassAttempts = 0;
      }
    }

    const before = await IamUser.findById(id).lean();
    if (!before) return res.status(404).json({ ok: false, message: "Usuario no encontrado" });

    const effectiveRoles = newRoles || before.roles || [];
    const isVisitor = hasRole(effectiveRoles, "visita");
    if (isVisitor) update.mustChangePassword = false;

    const u = await IamUser.findByIdAndUpdate(id, { $set: update }, { new: true, runValidators: true }).lean();
    if (!u) return res.status(404).json({ ok: false, message: "Usuario no encontrado" });

    await auditSafe(
      req,
      {
        action: "update",
        entity: "user",
        entityId: id,
        before: {
          email: before.email,
          name: before.name,
          roles: before.roles || [],
          active: before.active !== false,
          mustChangePassword: !!before.mustChangePassword,
        },
        after: {
          email: u.email,
          name: u.name,
          roles: u.roles || [],
          active: u.active !== false,
          mustChangePassword: !!u.mustChangePassword,
        },
      },
      "update user"
    );

    return res.json({ ok: true, item: pickUser(u) });
  } catch (e) {
    if (e?.code === 11000) return res.status(409).json({ ok: false, message: "Ya existe un usuario con ese correo" });
    next(e);
  }
});

r.post("/:id/enable", MW_USERS_MANAGE, async (req, res, next) => {
  try {
    const id = String(req.params.id || "").trim();
    if (!isValidObjectId(id)) return res.status(400).json({ ok: false, message: "ID inválido" });

    const before = await IamUser.findById(id).lean();
    if (!before) return res.status(404).json({ ok: false, message: "Usuario no encontrado" });

    const u = await IamUser.findByIdAndUpdate(id, { $set: { active: true } }, { new: true }).lean();
    if (!u) return res.status(404).json({ ok: false, message: "Usuario no encontrado" });

    await auditSafe(req, { action: "update", entity: "user", entityId: id, before: { active: before.active !== false }, after: { active: true } }, "enable user");
    return res.json({ ok: true, item: pickUser(u) });
  } catch (e) {
    next(e);
  }
});

r.post("/:id/disable", MW_USERS_MANAGE, async (req, res, next) => {
  try {
    const id = String(req.params.id || "").trim();
    if (!isValidObjectId(id)) return res.status(400).json({ ok: false, message: "ID inválido" });

    const before = await IamUser.findById(id).lean();
    if (!before) return res.status(404).json({ ok: false, message: "Usuario no encontrado" });

    const u = await IamUser.findByIdAndUpdate(id, { $set: { active: false } }, { new: true }).lean();
    if (!u) return res.status(404).json({ ok: false, message: "Usuario no encontrado" });

    await auditSafe(req, { action: "update", entity: "user", entityId: id, before: { active: before.active !== false }, after: { active: false } }, "disable user");
    return res.json({ ok: true, item: pickUser(u) });
  } catch (e) {
    next(e);
  }
});

r.delete("/:id", MW_USERS_MANAGE, async (req, res, next) => {
  try {
    const id = String(req.params.id || "").trim();
    if (!isValidObjectId(id)) return res.status(400).json({ ok: false, message: "ID inválido" });

    const before = await IamUser.findById(id).lean();
    if (!before) return res.status(404).json({ ok: false, message: "Usuario no encontrado" });

    await IamUser.deleteOne({ _id: id });

    await auditSafe(
      req,
      {
        action: "delete",
        entity: "user",
        entityId: id,
        before: { email: before.email, name: before.name, roles: before.roles || [], active: before.active !== false },
        after: null,
      },
      "delete user"
    );

    return res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

export default r;