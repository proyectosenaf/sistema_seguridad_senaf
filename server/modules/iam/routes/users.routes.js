// modules/iam/routes/users.routes.js
import { Router } from "express";
import IamUser from "../models/IamUser.model.js";
import { devOr, requirePerm } from "../utils/rbac.util.js";
import { hashPassword } from "../utils/password.util.js";
// ⬇️ Mantén esta ruta según donde tengas tu helper:
import { writeAudit } from "../utils/audit.util.js";

const r = Router();

/* ===================== Helpers ===================== */
function normEmail(e) {
  return String(e || "").trim().toLowerCase();
}
function normBool(v, def = true) {
  if (v === undefined || v === null) return !!def;
  if (typeof v === "boolean") return v;
  if (typeof v === "string") return ["1", "true", "yes", "on"].includes(v.toLowerCase());
  return !!v;
}
function toStringArray(v) {
  if (Array.isArray(v)) return v.map((s) => String(s).trim()).filter(Boolean);
  if (typeof v === "string")
    return v
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  return [];
}
function nameFromEmail(email) {
  const local = String(email || "").split("@")[0];
  if (!local) return null;
  return local
    .replace(/[._-]+/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

// Detecta si un usuario tiene rol de guardia (convenciones: guardia, guard, rondasqr.guard)
function isGuardRole(u) {
  const NS = process.env.IAM_ROLES_NAMESPACE || "https://senaf.local/roles";
  const roles = [
    ...(Array.isArray(u?.roles) ? u.roles : []),
    ...(Array.isArray(u?.[NS]) ? u[NS] : []),
  ]
    .map((r) => String(r).toLowerCase().trim())
    .filter(Boolean);

  return roles.includes("guardia") || roles.includes("guard") || roles.includes("rondasqr.guard");
}

/* ===================== GET / (lista) ===================== */
/**
 * GET /api/iam/v1/users?q=&limit=&skip=
 * Devuelve { items: [...] }
 */
r.get("/", devOr(requirePerm("iam.users.manage")), async (req, res, next) => {
  try {
    const q = String(req.query.q || "").trim();
    const limit = Math.min(500, Math.max(1, Number(req.query.limit || 100)));
    const skip = Math.max(0, Number(req.query.skip || 0));

    const filter = q
      ? {
          $or: [
            { name: { $regex: q, $options: "i" } },
            { email: { $regex: q, $options: "i" } },
          ],
        }
      : {};

    const items = await IamUser.find(
      filter,
      {
        name: 1,
        email: 1,
        roles: 1,
        active: 1,
        perms: 1,
        createdAt: 1,
        updatedAt: 1,
        // Si tu modelo tiene sub / legacyId, también se pueden proyectar:
        sub: 1,
        legacyId: 1,
      }
    )
      .sort({ name: 1, email: 1 })
      .skip(skip)
      .limit(limit)
      .lean();

    res.json({ items });
  } catch (err) {
    next(err);
  }
});

/* ===================== GET /guards (lista de guardias) ===================== */
/**
 * GET /api/iam/v1/users/guards?q=&active=1
 * Devuelve { items: [{ _id, name, email, active, roles, opId }] }
 *   - opId = sub || legacyId || _id  (ID operativo para rooms de socket)
 */
r.get("/guards", devOr(requirePerm("iam.users.manage")), async (req, res, next) => {
  try {
    const q = String(req.query.q || "").trim();
    const onlyActive = normBool(req.query.active, true);

    const textFilter = q
      ? {
          $or: [
            { name: { $regex: q, $options: "i" } },
            { email: { $regex: q, $options: "i" } },
          ],
        }
      : {};

    const base = onlyActive ? { ...textFilter, active: true } : textFilter;

    // Traemos un set "amplio" y filtramos por rol en memoria (si la app usa múltiples namespaces)
    const raw = await IamUser.find(base, {
      name: 1,
      email: 1,
      roles: 1,
      active: 1,
      sub: 1,
      legacyId: 1,
      // por si guardaste roles en el namespace:
      [process.env.IAM_ROLES_NAMESPACE || "https://senaf.local/roles"]: 1,
    })
      .sort({ name: 1, email: 1 })
      .limit(1000)
      .lean();

    const guards = raw.filter(isGuardRole).map((u) => ({
      _id: u._id,
      name: u.name || nameFromEmail(u.email) || "(Sin nombre)",
      email: u.email || "",
      active: !!u.active,
      roles: u.roles || [],
      opId: u.sub || u.legacyId || String(u._id),
    }));

    res.json({ items: guards });
  } catch (err) {
    next(err);
  }
});

/* ===================== GET /:id ===================== */
/**
 * GET /api/iam/v1/users/:id
 * Devuelve { item }
 */
r.get("/:id", devOr(requirePerm("iam.users.manage")), async (req, res, next) => {
  try {
    const { id } = req.params;
    const item = await IamUser.findById(id).lean();
    if (!item) return res.status(404).json({ error: "No encontrado" });
    res.json({ item });
  } catch (err) {
    next(err);
  }
});

/* ===================== POST / (crear) ===================== */
/**
 * POST /api/iam/v1/users
 * Body: { name, email, roles=[], perms=[], active=true, password? }
 * Devuelve { item } | 409 si ya existe por email
 */
r.post("/", devOr(requirePerm("iam.users.manage")), async (req, res, next) => {
  try {
    let {
      name,
      email,
      roles = [],
      perms = [],
      active = true,
      password, // opcional
      provider, // opcional
    } = req.body || {};

    email = normEmail(email);
    if (!email) return res.status(400).json({ error: "email requerido" });

    const exists = await IamUser.findOne({ email }).lean();
    if (exists) return res.status(409).json({ error: "ya existe", item: exists });

    const doc = {
      email,
      name: String(name || "").trim() || nameFromEmail(email),
      roles: toStringArray(roles),
      perms: toStringArray(perms),
      active: normBool(active, true),
      provider: provider || (password ? "local" : "auth0"),
    };

    if (password && String(password).trim()) {
      doc.passwordHash = await hashPassword(String(password));
      doc.provider = "local";
    }

    const item = await IamUser.create(doc);

    // AUDIT: creación
    await writeAudit(req, {
      action: "create",
      entity: "user",
      entityId: item._id.toString(),
      before: null,
      after: { email: item.email, roles: item.roles, perms: item.perms, active: item.active },
    });

    res.status(201).json({
      item: {
        _id: item._id,
        email: item.email,
        name: item.name,
        roles: item.roles,
        perms: item.perms,
        active: item.active,
        provider: item.provider,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      },
    });
  } catch (err) {
    next(err);
  }
});

/* ===================== PATCH /:id (actualizar) ===================== */
/**
 * PATCH /api/iam/v1/users/:id
 * Body parcial. Normaliza email/roles/perms/active si vienen.
 * Devuelve { item }
 */
r.patch("/:id", devOr(requirePerm("iam.users.manage")), async (req, res, next) => {
  try {
    const { id } = req.params;
    const patch = { ...(req.body || {}) };

    if (patch.email !== undefined) patch.email = normEmail(patch.email);
    if (patch.name !== undefined) patch.name = String(patch.name || "").trim();
    if (patch.roles !== undefined) patch.roles = toStringArray(patch.roles);
    if (patch.perms !== undefined) patch.perms = toStringArray(patch.perms);
    if (patch.active !== undefined) patch.active = normBool(patch.active);

    // AUDIT: estado anterior
    const before = await IamUser.findById(id).lean();

    const item = await IamUser.findByIdAndUpdate(id, { $set: patch }, { new: true }).lean();
    if (!item) return res.status(404).json({ error: "No encontrado" });

    // AUDIT: actualización
    await writeAudit(req, {
      action: "update",
      entity: "user",
      entityId: id,
      before: before
        ? { email: before.email, roles: before.roles, perms: before.perms, active: before.active }
        : null,
      after: { email: item.email, roles: item.roles, perms: item.perms, active: item.active },
    });

    res.json({ item });
  } catch (err) {
    next(err);
  }
});

/* ===================== ENABLE/DISABLE ===================== */
r.post("/:id/enable", devOr(requirePerm("iam.users.manage")), async (req, res, next) => {
  try {
    const { id } = req.params;

    const before = await IamUser.findById(id).lean();

    const item = await IamUser.findByIdAndUpdate(id, { $set: { active: true } }, { new: true }).lean();
    if (!item) return res.status(404).json({ error: "No encontrado" });

    await writeAudit(req, {
      action: "activate",
      entity: "user",
      entityId: id,
      before: before ? { active: before.active } : null,
      after: { active: true },
    });

    res.json({ item });
  } catch (err) {
    next(err);
  }
});

r.post("/:id/disable", devOr(requirePerm("iam.users.manage")), async (req, res, next) => {
  try {
    const { id } = req.params;

    const before = await IamUser.findById(id).lean();

    const item = await IamUser.findByIdAndUpdate(id, { $set: { active: false } }, { new: true }).lean();
    if (!item) return res.status(404).json({ error: "No encontrado" });

    await writeAudit(req, {
      action: "deactivate",
      entity: "user",
      entityId: id,
      before: before ? { active: before.active } : null,
      after: { active: false },
    });

    res.json({ item });
  } catch (err) {
    next(err);
  }
});

/* ===================== PASSWORD (crear/cambiar) ===================== */
/**
 * POST /api/iam/v1/users/:id/password
 * Body: { password }
 * No guarda el password en auditoría, solo marca el cambio.
 */
r.post("/:id/password", devOr(requirePerm("iam.users.manage")), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { password } = req.body || {};
    const pwd = String(password || "").trim();
    if (!pwd) return res.status(400).json({ error: "password requerido" });

    const before = await IamUser.findById(id).lean();
    if (!before) return res.status(404).json({ error: "No encontrado" });

    const passwordHash = await hashPassword(pwd);
    const item = await IamUser.findByIdAndUpdate(
      id,
      { $set: { passwordHash, provider: "local" } },
      { new: true }
    ).lean();

    await writeAudit(req, {
      action: "update",
      entity: "user",
      entityId: id,
      // No guardamos password ni hash:
      before: { hasPassword: !!before?.passwordHash },
      after:  { hasPassword: !!item?.passwordHash },
      // Si tu helper soporta meta, podrías incluir: meta:{ changed:["passwordHash"] }
    });

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

/* ===================== DELETE /:id ===================== */
/**
 * DELETE /api/iam/v1/users/:id
 */
r.delete("/:id", devOr(requirePerm("iam.users.manage")), async (req, res, next) => {
  try {
    const { id } = req.params;
    const before = await IamUser.findById(id).lean();
    if (!before) return res.status(404).json({ error: "No encontrado" });

    await IamUser.findByIdAndDelete(id);

    await writeAudit(req, {
      action: "delete",
      entity: "user",
      entityId: id,
      before: { email: before.email, roles: before.roles, perms: before.perms, active: before.active },
      after: null,
    });

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default r;
