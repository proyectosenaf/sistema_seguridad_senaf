import { Router } from "express";
import mongoose from "mongoose";
import IamUser from "../models/IamUser.model.js";
import {
  devOr,
  requirePerm,
  parseList,
  buildContextFrom,
} from "../utils/rbac.util.js";
import { writeAudit } from "../utils/audit.util.js";
import { hashPassword } from "../utils/password.util.js";
import { logBitacoraEvent } from "../../bitacora/services/bitacora.service.js";

const r = Router();

/* ===================== Middlewares ===================== */

const MW_USERS_MANAGE = devOr(
  requirePerm(["iam.users.write", "iam.users.manage"])
);

const MW_USERS_VIEW = devOr(async (req, res, next) => {
  try {
    const ctx = req.iam || (await buildContextFrom(req));
    req.iam = ctx;

    if (!ctx?.email) {
      return res.status(401).json({ ok: false, message: "No autenticado" });
    }

    const canView =
      ctx.has("iam.users.read") ||
      ctx.has("iam.users.view") ||
      ctx.has("iam.users.write") ||
      ctx.has("iam.users.manage");

    if (!canView) {
      return res.status(403).json({
        ok: false,
        message: "forbidden",
        need: [
          "iam.users.read",
          "iam.users.view",
          "iam.users.write",
          "iam.users.manage",
        ],
        email: ctx.email,
        roles: ctx.roles || [],
        perms: ctx.permissions || [],
      });
    }

    next();
  } catch (e) {
    next(e);
  }
});

/* ===================== Helpers ===================== */

const SUPERADMIN_EMAIL = String(
  process.env.SUPERADMIN_EMAIL || "proyectosenaf@gmail.com"
)
  .trim()
  .toLowerCase();

const ROOT_ADMINS = [
  ...parseList(process.env.ROOT_ADMINS || ""),
  process.env.VITE_SUPERADMIN_EMAIL || "",
  "proyectosenaf@gmail.com",
]
  .map((x) => String(x || "").toLowerCase().trim())
  .filter(Boolean)
  .filter((v, i, arr) => arr.indexOf(v) === i);

function isProtectedAdminEmail(email) {
  const e = String(email || "").trim().toLowerCase();
  if (!e) return false;
  if (SUPERADMIN_EMAIL && e === SUPERADMIN_EMAIL) return true;
  return ROOT_ADMINS.includes(e);
}

function getProtectedAdminRoles() {
  return ["superadmin", "admin"];
}

function getProtectedAdminPerms() {
  return ["*"];
}

function isValidObjectId(id) {
  return mongoose.Types.ObjectId.isValid(String(id || ""));
}

function normEmail(e) {
  return String(e || "").trim().toLowerCase();
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
  const wanted = String(role || "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "_");

  return rr
    .map((x) => String(x || "").toLowerCase().trim().replace(/\s+/g, "_"))
    .includes(wanted);
}

function normalizeRoleValue(role) {
  if (!role) return "";

  if (typeof role === "string") return role.trim();

  if (typeof role === "object") {
    return String(
      role.name ||
        role.slug ||
        role.code ||
        role.key ||
        role.nombre ||
        role.label ||
        ""
    ).trim();
  }

  return String(role).trim();
}

function getPrimaryRole(userLike) {
  const roles = Array.isArray(userLike?.roles) ? userLike.roles : [];
  return normalizeRoleValue(roles[0] || "");
}

function clientIp(req) {
  return (
    req.ip ||
    req.headers["x-forwarded-for"] ||
    req.connection?.remoteAddress ||
    ""
  );
}

function auditSafe(req, payload, label) {
  return writeAudit(req, payload).catch((e) => {
    console.warn(`[IAM][AUDIT ${label}] error (no bloquea):`, e?.message || e);
  });
}

async function bitacoraSafe(req, payload, label) {
  try {
    await logBitacoraEvent({
      modulo: "IAM",
      tipo: "IAM",
      prioridad: payload.prioridad || "Media",
      estado: payload.estado || "Registrado",
      source: payload.source || "iam-users",
      agente:
        req?.user?.email ||
        req?.user?.name ||
        payload.agente ||
        "Sistema IAM",
      actorId:
        req?.user?.sub ||
        req?.user?._id ||
        req?.user?.id ||
        payload.actorId ||
        "",
      actorEmail: req?.user?.email || payload.actorEmail || "",
      actorRol: getPrimaryRole(req?.user) || payload.actorRol || "",
      ip: clientIp(req),
      userAgent: req?.get?.("user-agent") || "",
      ...payload,
    });
  } catch (e) {
    console.warn(
      `[IAM][BITACORA ${label}] error (no bloquea):`,
      e?.message || e
    );
  }
}

function toStringArray(v) {
  const normOne = (x) => {
    if (x == null) return "";
    if (
      typeof x === "string" ||
      typeof x === "number" ||
      typeof x === "boolean"
    ) {
      return String(x).trim();
    }
    if (typeof x === "object") {
      const cand =
        x.code ??
        x.value ??
        x.key ??
        x.id ??
        x._id ??
        x.slug ??
        x.name;
      return cand != null ? String(cand).trim() : "";
    }
    return String(x).trim();
  };

  if (Array.isArray(v)) {
    const out = v.map(normOne).filter(Boolean);
    return [...new Set(out.map((s) => s.toLowerCase().replace(/\s+/g, "_")))];
  }

  if (typeof v === "string") {
    const out = v
      .split(",")
      .map((s) => String(s).trim())
      .filter(Boolean)
      .map((s) => s.toLowerCase().replace(/\s+/g, "_"));
    return [...new Set(out)];
  }

  return [];
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
    nombreCompleto: u.name || "",
    correoPersona: u.email || "",
  };
}

function mapBodyToIamUser(body = {}) {
  const email = normEmail(body.email || body.correoPersona);
  const name = String(body.name || body.nombreCompleto || "").trim();

  const roles = toStringArray(body.roles);
  const perms = toStringArray(body.perms);
  const active = body.active === false ? false : true;

  const mustChangePasswordRaw = body.mustChangePassword ?? body.forcePwChange;

  const rawPwd =
    body.password ??
    body.newPassword ??
    body.pass ??
    body.contrasena ??
    body.contraseña ??
    "";

  const password = rawPwd != null ? String(rawPwd).trim() : "";

  return { email, name, roles, perms, active, mustChangePasswordRaw, password };
}

function isDateOnlyString(s) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(s || "").trim());
}

function parseDateFromStart(s) {
  const raw = String(s || "").trim();
  if (!raw) return null;

  if (isDateOnlyString(raw)) {
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
    const base = new Date(`${raw}T00:00:00.000Z`);
    if (Number.isNaN(base.getTime())) return null;
    return new Date(base.getTime() + 24 * 60 * 60 * 1000);
  }

  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

/* ===================== Routes ===================== */

r.get("/", MW_USERS_VIEW, async (req, res, next) => {
  try {
    const q = String(req.query.q || "").trim();
    const onlyActive =
      parseBool(req.query.onlyActive, true) ||
      String(req.query.active || "") === "1";

    const createdFromRaw = String(
      req.query.createdFrom || req.query.from || ""
    ).trim();
    const createdToRaw = String(req.query.createdTo || req.query.to || "").trim();

    const createdFrom = parseDateFromStart(createdFromRaw);
    const createdToExcl = parseDateToExclusive(createdToRaw);

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
        query.createdAt[isDateOnlyString(createdToRaw) ? "$lt" : "$lte"] =
          createdToExcl;
      }
    }

    const hasFilters = !!q || !!query.createdAt;

    const limitParam = Number(req.query.limit || 0);
    const skipParam = Number(req.query.skip || 0);

    const limit =
      Number.isFinite(limitParam) && limitParam > 0
        ? Math.min(limitParam, 2000)
        : hasFilters
        ? 2000
        : 5;

    const skip =
      Number.isFinite(skipParam) && skipParam > 0 ? Math.max(0, skipParam) : 0;

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

    const items = await IamUser.find(query)
      .sort({ createdAt: -1 })
      .limit(500)
      .lean();

    return res.json({ ok: true, items: items.map(pickUser) });
  } catch (e) {
    next(e);
  }
});

r.get("/:id", MW_USERS_VIEW, async (req, res, next) => {
  try {
    const id = String(req.params.id || "").trim();
    if (!isValidObjectId(id)) {
      return res.status(400).json({ ok: false, message: "ID inválido" });
    }

    const u = await IamUser.findById(id).lean();
    if (!u) {
      return res
        .status(404)
        .json({ ok: false, message: "Usuario no encontrado" });
    }

    return res.json({ ok: true, item: pickUser(u) });
  } catch (e) {
    next(e);
  }
});

/**
 * POST /api/iam/v1/users
 */
r.post("/", MW_USERS_MANAGE, async (req, res, next) => {
  try {
    const {
      email,
      name,
      roles,
      perms,
      active,
      mustChangePasswordRaw,
      password,
    } = mapBodyToIamUser(req.body || {});

    if (!email) {
      return res
        .status(400)
        .json({ ok: false, message: "email/correoPersona requerido" });
    }
    if (!name) {
      return res
        .status(400)
        .json({ ok: false, message: "name/nombreCompleto requerido" });
    }

    let effectiveRoles = roles;
    let effectivePerms = perms;

    if (isProtectedAdminEmail(email)) {
      effectiveRoles = getProtectedAdminRoles();
      effectivePerms = getProtectedAdminPerms();
    }

    if (!effectiveRoles.length) {
      return res.status(400).json({
        ok: false,
        message: "roles requerido (al menos 1)",
      });
    }

    const isVisitor = hasRole(effectiveRoles, "visita");

    if (!isProtectedAdminEmail(email) && !isVisitor && !password) {
      return res.status(400).json({
        ok: false,
        message: "password requerido para usuarios internos (no visitantes).",
      });
    }

    const exists = await IamUser.findOne({ email }).lean();
    if (exists) {
      return res.status(409).json({
        ok: false,
        message: "Ya existe un usuario con ese correo",
      });
    }

    const mustChangePassword = isProtectedAdminEmail(email)
      ? false
      : isVisitor
      ? false
      : parseBool(mustChangePasswordRaw, true);

    const passwordHash =
      !isProtectedAdminEmail(email) && password ? await hashPassword(password) : "";

    const doc = await IamUser.create({
      email,
      name,
      roles: effectiveRoles,
      perms: effectivePerms,
      active: isProtectedAdminEmail(email) ? true : active,
      provider: "local",
      mustChangePassword,
      passwordHash,
      passwordChangedAt: passwordHash ? new Date() : null,
      tempPassHash: "",
      tempPassExpiresAt: null,
      tempPassUsedAt: null,
      tempPassAttempts: 0,
      otpVerifiedAt: null,
    });

    const after = {
      email: doc.email,
      name: doc.name,
      roles: doc.roles || [],
      perms: doc.perms || [],
      active: doc.active !== false,
      mustChangePassword: !!doc.mustChangePassword,
    };

    await auditSafe(
      req,
      {
        action: "create",
        entity: "user",
        entityId: doc._id.toString(),
        before: null,
        after,
      },
      "create user"
    );

    await bitacoraSafe(
      req,
      {
        accion: "USER_CREATE",
        entidad: "IamUser",
        entidadId: doc._id.toString(),
        titulo: `Usuario creado: ${doc.email}`,
        descripcion: `Se creó el usuario ${doc.email}.`,
        before: null,
        after,
        estado: "Exitoso",
        prioridad: "Media",
        nombre: doc.name || doc.email,
        meta: {
          provider: doc.provider || "local",
          visitor: isVisitor,
          protectedAdmin: isProtectedAdminEmail(doc.email),
        },
      },
      "create user"
    );

    return res.status(201).json({
      ok: true,
      item: pickUser(doc.toObject ? doc.toObject() : doc),
    });
  } catch (e) {
    if (e?.code === 11000) {
      return res.status(409).json({
        ok: false,
        message: "Ya existe un usuario con ese correo",
      });
    }
    next(e);
  }
});

r.patch("/:id", MW_USERS_MANAGE, async (req, res, next) => {
  try {
    const id = String(req.params.id || "").trim();
    if (!isValidObjectId(id)) {
      return res.status(400).json({ ok: false, message: "ID inválido" });
    }

    const before = await IamUser.findById(id).lean();
    if (!before) {
      return res
        .status(404)
        .json({ ok: false, message: "Usuario no encontrado" });
    }

    const protectedUser = isProtectedAdminEmail(before.email);
    const body = req.body || {};
    const update = {};

    if (!protectedUser) {
      if (body.email != null || body.correoPersona != null) {
        update.email = normEmail(body.email || body.correoPersona);
      }

      let newRoles = null;
      if (body.roles != null) {
        const roles = toStringArray(body.roles);
        if (!roles.length) {
          return res.status(400).json({
            ok: false,
            message: "roles requerido (al menos 1)",
          });
        }
        newRoles = roles;
        update.roles = roles;
      }

      if (body.perms != null) {
        update.perms = toStringArray(body.perms);
      }

      if (body.active != null) {
        update.active = body.active === false ? false : true;
      }

      const effectiveRoles = newRoles || before.roles || [];
      const isVisitor = hasRole(effectiveRoles, "visita");
      if (isVisitor) update.mustChangePassword = false;
    }

    if (protectedUser) {
      update.email = before.email;
      update.roles = getProtectedAdminRoles();
      update.perms = getProtectedAdminPerms();
      update.active = true;
      update.provider = "local";
      update.mustChangePassword = false;
    }

    if (body.name != null || body.nombreCompleto != null) {
      update.name = String(body.name || body.nombreCompleto || "").trim();
    }

    if (!protectedUser && (body.mustChangePassword != null || body.forcePwChange != null)) {
      update.mustChangePassword = parseBool(
        body.mustChangePassword ?? body.forcePwChange,
        false
      );
    }

    if (!protectedUser && body.password != null) {
      const pwd = String(body.password).trim();
      if (pwd.length > 0) {
        update.passwordHash = await hashPassword(pwd);
        update.passwordChangedAt = new Date();
        update.tempPassHash = "";
        update.tempPassExpiresAt = null;
        update.tempPassUsedAt = null;
        update.tempPassAttempts = 0;

        if (body.mustChangePassword == null && body.forcePwChange == null) {
          update.mustChangePassword = false;
        }
      }
    }

    const u = await IamUser.findByIdAndUpdate(
      id,
      { $set: update },
      { new: true, runValidators: true }
    ).lean();

    if (!u) {
      return res
        .status(404)
        .json({ ok: false, message: "Usuario no encontrado" });
    }

    const beforeData = {
      email: before.email,
      name: before.name,
      roles: before.roles || [],
      perms: before.perms || [],
      active: before.active !== false,
      mustChangePassword: !!before.mustChangePassword,
      passwordChangedAt: before.passwordChangedAt || null,
      passwordExpiresAt: before.passwordExpiresAt || null,
    };

    const afterData = {
      email: u.email,
      name: u.name,
      roles: u.roles || [],
      perms: u.perms || [],
      active: u.active !== false,
      mustChangePassword: !!u.mustChangePassword,
      passwordChangedAt: u.passwordChangedAt || null,
      passwordExpiresAt: u.passwordExpiresAt || null,
    };

    await auditSafe(
      req,
      {
        action: "update",
        entity: "user",
        entityId: id,
        before: beforeData,
        after: afterData,
      },
      "update user"
    );

    await bitacoraSafe(
      req,
      {
        accion: "USER_UPDATE",
        entidad: "IamUser",
        entidadId: id,
        titulo: `Usuario actualizado: ${u.email}`,
        descripcion: `Se actualizó el usuario ${u.email}.`,
        before: beforeData,
        after: afterData,
        estado: "Exitoso",
        prioridad: "Media",
        nombre: u.name || u.email,
      },
      "update user"
    );

    return res.json({ ok: true, item: pickUser(u) });
  } catch (e) {
    if (e?.code === 11000) {
      return res.status(409).json({
        ok: false,
        message: "Ya existe un usuario con ese correo",
      });
    }
    next(e);
  }
});

r.post("/:id/enable", MW_USERS_MANAGE, async (req, res, next) => {
  try {
    const id = String(req.params.id || "").trim();
    if (!isValidObjectId(id)) {
      return res.status(400).json({ ok: false, message: "ID inválido" });
    }

    const before = await IamUser.findById(id).lean();
    if (!before) {
      return res
        .status(404)
        .json({ ok: false, message: "Usuario no encontrado" });
    }

    const update = isProtectedAdminEmail(before.email)
      ? {
          active: true,
          roles: getProtectedAdminRoles(),
          perms: getProtectedAdminPerms(),
          provider: "local",
          mustChangePassword: false,
        }
      : { active: true };

    const u = await IamUser.findByIdAndUpdate(
      id,
      { $set: update },
      { new: true }
    ).lean();

    if (!u) {
      return res
        .status(404)
        .json({ ok: false, message: "Usuario no encontrado" });
    }

    await auditSafe(
      req,
      {
        action: "update",
        entity: "user",
        entityId: id,
        before: { active: before.active !== false },
        after: { active: true },
      },
      "enable user"
    );

    await bitacoraSafe(
      req,
      {
        accion: "USER_ENABLE",
        entidad: "IamUser",
        entidadId: id,
        titulo: `Usuario habilitado: ${u.email}`,
        descripcion: `Se habilitó el usuario ${u.email}.`,
        before: { active: before.active !== false },
        after: { active: true },
        estado: "Exitoso",
        prioridad: "Media",
        nombre: u.name || u.email,
      },
      "enable user"
    );

    return res.json({ ok: true, item: pickUser(u) });
  } catch (e) {
    next(e);
  }
});

r.post("/:id/disable", MW_USERS_MANAGE, async (req, res, next) => {
  try {
    const id = String(req.params.id || "").trim();
    if (!isValidObjectId(id)) {
      return res.status(400).json({ ok: false, message: "ID inválido" });
    }

    const before = await IamUser.findById(id).lean();
    if (!before) {
      return res
        .status(404)
        .json({ ok: false, message: "Usuario no encontrado" });
    }

    if (isProtectedAdminEmail(before.email)) {
      return res.status(400).json({
        ok: false,
        message: "No puedes desactivar un admin protegido.",
      });
    }

    const u = await IamUser.findByIdAndUpdate(
      id,
      { $set: { active: false } },
      { new: true }
    ).lean();

    if (!u) {
      return res
        .status(404)
        .json({ ok: false, message: "Usuario no encontrado" });
    }

    await auditSafe(
      req,
      {
        action: "update",
        entity: "user",
        entityId: id,
        before: { active: before.active !== false },
        after: { active: false },
      },
      "disable user"
    );

    await bitacoraSafe(
      req,
      {
        accion: "USER_DISABLE",
        entidad: "IamUser",
        entidadId: id,
        titulo: `Usuario deshabilitado: ${u.email}`,
        descripcion: `Se deshabilitó el usuario ${u.email}.`,
        before: { active: before.active !== false },
        after: { active: false },
        estado: "Exitoso",
        prioridad: "Alta",
        nombre: u.name || u.email,
      },
      "disable user"
    );

    return res.json({ ok: true, item: pickUser(u) });
  } catch (e) {
    next(e);
  }
});

r.delete("/:id", MW_USERS_MANAGE, async (req, res, next) => {
  try {
    const id = String(req.params.id || "").trim();
    if (!isValidObjectId(id)) {
      return res.status(400).json({ ok: false, message: "ID inválido" });
    }

    const before = await IamUser.findById(id).lean();
    if (!before) {
      return res
        .status(404)
        .json({ ok: false, message: "Usuario no encontrado" });
    }

    if (isProtectedAdminEmail(before.email)) {
      return res.status(400).json({
        ok: false,
        message: "No puedes eliminar un admin protegido.",
      });
    }

    await IamUser.deleteOne({ _id: id });

    const beforeData = {
      email: before.email,
      name: before.name,
      roles: before.roles || [],
      perms: before.perms || [],
      active: before.active !== false,
      mustChangePassword: !!before.mustChangePassword,
    };

    await auditSafe(
      req,
      {
        action: "delete",
        entity: "user",
        entityId: id,
        before: beforeData,
        after: null,
      },
      "delete user"
    );

    await bitacoraSafe(
      req,
      {
        accion: "USER_DELETE",
        entidad: "IamUser",
        entidadId: id,
        titulo: `Usuario eliminado: ${before.email}`,
        descripcion: `Se eliminó el usuario ${before.email}.`,
        before: beforeData,
        after: null,
        estado: "Exitoso",
        prioridad: "Alta",
        nombre: before.name || before.email,
      },
      "delete user"
    );

    return res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

export default r;