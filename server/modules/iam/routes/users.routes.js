// server/modules/iam/routes/users.routes.js
import { Router } from "express";
import IamUser from "../models/IamUser.model.js";
import { devOr, requirePerm } from "../utils/rbac.util.js";
import { hashPassword } from "../utils/password.util.js";
import { writeAudit } from "../utils/audit.util.js";
import axios from "axios";

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

function toStringArray(v, { lower = false } = {}) {
  let arr = [];
  if (Array.isArray(v)) arr = v;
  else if (typeof v === "string") arr = v.split(",");
  else arr = [];

  return arr
    .map((s) => String(s || "").trim())
    .filter(Boolean)
    .map((s) => (lower ? s.toLowerCase() : s));
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

/* =========================
   Auth0 Management helpers
   ========================= */
function normalizeDomain(d) {
  return String(d || "")
    .replace(/^https?:\/\//i, "")
    .replace(/\/+$/g, "")
    .trim();
}

let _mgmtToken = null;
let _mgmtTokenExp = 0;

async function getMgmtToken() {
  const domain = normalizeDomain(process.env.AUTH0_MGMT_DOMAIN);
  const client_id = process.env.AUTH0_MGMT_CLIENT_ID;
  const client_secret = process.env.AUTH0_MGMT_CLIENT_SECRET;

  if (!domain || !client_id || !client_secret) return null;

  const now = Date.now();
  if (_mgmtToken && now < _mgmtTokenExp - 30_000) return _mgmtToken;

  const url = `https://${domain}/oauth/token`;
  const r = await axios.post(url, {
    grant_type: "client_credentials",
    client_id,
    client_secret,
    audience: `https://${domain}/api/v2/`,
  });

  const token = r?.data?.access_token || null;
  const expiresIn = Number(r?.data?.expires_in || 3600);
  if (!token) return null;

  _mgmtToken = token;
  _mgmtTokenExp = now + expiresIn * 1000;
  return token;
}

async function createAuth0DbUser({ email, tempPassword, roles, perms }) {
  const domain = normalizeDomain(process.env.AUTH0_MGMT_DOMAIN);
  const connection = String(process.env.AUTH0_DB_CONNECTION || "").trim();

  if (!domain) throw new Error("missing AUTH0_MGMT_DOMAIN");
  if (!connection) throw new Error("missing AUTH0_DB_CONNECTION (nombre exacto de Database connection)");

  const token = await getMgmtToken();
  if (!token) throw new Error("missing_auth0_mgmt_token (revisa AUTH0_MGMT_CLIENT_ID/SECRET)");

  // ✅ Create user in Auth0 DB connection.
  // ✅ Important: must_reset=true => Action Post-Login debe DENEGAR hasta que cambie password por link.
  const createRes = await axios.post(
    `https://${domain}/api/v2/users`,
    {
      email,
      password: tempPassword, // cualquier cosa; el usuario NO la usará
      connection,
      email_verified: false,
      verify_email: false, // no dependas de verify_email aquí (puedes activarlo después si quieres)
      app_metadata: {
        createdByAdmin: true,
        must_reset: true, // ✅ clave "vencida" conceptualmente (bloquea login)
        roles,
        permissions: perms,
        email_normalized: email,
      },
    },
    { headers: { Authorization: `Bearer ${token}` } }
  );

  return createRes?.data; // contiene user_id
}

async function createPasswordChangeTicket({ user_id, ttlSec = 86400 }) {
  const domain = normalizeDomain(process.env.AUTH0_MGMT_DOMAIN);
  if (!domain) throw new Error("missing AUTH0_MGMT_DOMAIN");

  const token = await getMgmtToken();
  if (!token) throw new Error("missing_auth0_mgmt_token");

  const result_url = String(process.env.SENAF_FORCE_PW_CHANGE_URL || "").trim();
  if (!result_url) throw new Error("missing SENAF_FORCE_PW_CHANGE_URL");

  const r = await axios.post(
    `https://${domain}/api/v2/tickets/password-change`,
    {
      user_id,
      result_url,
      ttl_sec: Number(ttlSec || 86400), // 24h por defecto
    },
    { headers: { Authorization: `Bearer ${token}` } }
  );

  const ticket = r?.data?.ticket;
  if (!ticket) throw new Error("ticket_not_returned");
  return ticket;
}

/* ===================== GET / (lista admin) ===================== */
r.get("/", devOr(requirePerm("iam.users.manage")), async (req, res, next) => {
  try {
    const q = String(req.query.q || "").trim();
    const limit = Math.min(500, Math.max(1, Number(req.query.limit || 100)));
    const skip = Math.max(0, Number(req.query.skip || 0));

    const filter = q
      ? { $or: [{ name: { $regex: q, $options: "i" } }, { email: { $regex: q, $options: "i" } }] }
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
        sub: 1,
        legacyId: 1,
        auth0Sub: 1,
        provider: 1,
      }
    )
      .sort({ name: 1, email: 1 })
      .skip(skip)
      .limit(limit)
      .lean();

    res.json({ ok: true, items, count: items.length, limit, skip });
  } catch (err) {
    next(err);
  }
});

/* ===================== GET /guards/picker (SAFE) ===================== */
r.get("/guards/picker", devOr(requirePerm("incidents.create")), async (req, res, next) => {
  try {
    const q = String(req.query.q || "").trim();
    const onlyActive = normBool(req.query.active, true);

    const textFilter = q
      ? { $or: [{ name: { $regex: q, $options: "i" } }, { email: { $regex: q, $options: "i" } }] }
      : {};

    const base = onlyActive ? { ...textFilter, active: true } : textFilter;

    const raw = await IamUser.find(base, {
      name: 1,
      email: 1,
      roles: 1,
      active: 1,
      sub: 1,
      legacyId: 1,
      [process.env.IAM_ROLES_NAMESPACE || "https://senaf.local/roles"]: 1,
    })
      .sort({ name: 1, email: 1 })
      .limit(2000)
      .lean();

    const guards = raw
      .filter((u) => isGuardRole(u))
      .map((u) => ({
        _id: u._id,
        name: u.name || nameFromEmail(u.email) || "(Sin nombre)",
        email: u.email || "",
        opId: u.sub || u.legacyId || String(u._id),
        active: !!u.active,
      }));

    res.json({ ok: true, items: guards, count: guards.length });
  } catch (err) {
    next(err);
  }
});

/* ===================== GET /guards (admin) ===================== */
r.get("/guards", devOr(requirePerm("iam.users.manage")), async (req, res, next) => {
  try {
    const q = String(req.query.q || "").trim();
    const onlyActive = normBool(req.query.active, true);

    const textFilter = q
      ? { $or: [{ name: { $regex: q, $options: "i" } }, { email: { $regex: q, $options: "i" } }] }
      : {};

    const base = onlyActive ? { ...textFilter, active: true } : textFilter;

    const raw = await IamUser.find(base, {
      name: 1,
      email: 1,
      roles: 1,
      active: 1,
      sub: 1,
      legacyId: 1,
      [process.env.IAM_ROLES_NAMESPACE || "https://senaf.local/roles"]: 1,
    })
      .sort({ name: 1, email: 1 })
      .limit(1000)
      .lean();

    const guards = raw
      .map((u) => ({
        _id: u._id,
        name: u.name || nameFromEmail(u.email) || "(Sin nombre)",
        email: u.email || "",
        active: !!u.active,
        roles: u.roles || [],
        opId: u.sub || u.legacyId || String(u._id),
        isGuard: isGuardRole(u),
      }))
      .filter((u) => u.isGuard);

    res.json({ ok: true, items: guards, count: guards.length });
  } catch (err) {
    next(err);
  }
});

/* ===================== GET /:id ===================== */
r.get("/:id", devOr(requirePerm("iam.users.manage")), async (req, res, next) => {
  try {
    const { id } = req.params;
    const item = await IamUser.findById(id).lean();
    if (!item) return res.status(404).json({ ok: false, error: "No encontrado" });
    res.json({ ok: true, item });
  } catch (err) {
    next(err);
  }
});

/* ===================== POST / (crear) ===================== */
/**
 * POST /api/iam/v1/users
 *
 * ✅ Caso local:
 *  - si viene password => crea usuario local (Mongo)
 *
 * ✅ Caso Auth0 (creado por admin):
 *  - si provider === "auth0" y NO viene password:
 *      1) crea usuario en Auth0 DB Connection (Management API)
 *      2) app_metadata.must_reset=true (Action Post-Login lo bloquea)
 *      3) genera link de password reset (24h)
 *      4) crea usuario en Mongo con auth0Sub = user_id
 *
 * Nota: tempPassword es solo para cumplir requisito de Auth0 al crear usuario DB.
 */
r.post("/", devOr(requirePerm("iam.users.manage")), async (req, res, next) => {
  try {
    let { name, email, roles = [], perms = [], active = true, password, provider } = req.body || {};

    email = normEmail(email);
    if (!email) return res.status(400).json({ ok: false, error: "email requerido" });

    const exists = await IamUser.findOne({ email }).lean();
    if (exists) return res.status(409).json({ ok: false, error: "ya existe", item: exists });

    const rolesNorm = toStringArray(roles, { lower: true });
    const permsNorm = toStringArray(perms, { lower: false });

    // Decide provider
    const wantLocal = !!(password && String(password).trim());
    const finalProvider = provider || (wantLocal ? "local" : "auth0");

    // Base doc Mongo
    const doc = {
      email,
      name: String(name || "").trim() || nameFromEmail(email),
      roles: rolesNorm,
      perms: permsNorm,
      active: normBool(active, true),
      provider: finalProvider,
    };

    // Local: guarda hash (si todavía lo usas)
    if (wantLocal) {
      doc.passwordHash = await hashPassword(String(password));
      doc.provider = "local";
    }

    let auth0User = null;
    let resetTicketUrl = null;

    // Auth0 creado por admin
    if (!wantLocal && doc.provider === "auth0") {
      const tempPassword =
        "Tmp!" + Math.random().toString(36).slice(2) + "A9*" + Math.random().toString(36).slice(2);

      auth0User = await createAuth0DbUser({
        email,
        tempPassword,
        roles: rolesNorm.length ? rolesNorm : ["visita"],
        perms: permsNorm,
      });

      const auth0Sub = String(auth0User?.user_id || "").trim();
      if (auth0Sub) doc.auth0Sub = auth0Sub;

      // ✅ Link 24h para que el usuario establezca su contraseña
      resetTicketUrl = await createPasswordChangeTicket({ user_id: auth0Sub, ttlSec: 86400 });
    }

    const item = await IamUser.create(doc);

    await writeAudit(req, {
      action: "create",
      entity: "user",
      entityId: item._id.toString(),
      before: null,
      after: {
        email: item.email,
        roles: item.roles,
        perms: item.perms,
        active: item.active,
        provider: item.provider,
        auth0Sub: item.auth0Sub || null,
        auth0MustReset: doc.provider === "auth0" ? true : null,
        resetTicketTtlSec: resetTicketUrl ? 86400 : null,
      },
    });

    res.status(201).json({
      ok: true,
      item: {
        _id: item._id,
        email: item.email,
        name: item.name,
        roles: item.roles,
        perms: item.perms,
        active: item.active,
        provider: item.provider,
        auth0Sub: item.auth0Sub || null,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      },
      auth0: auth0User
        ? { created: true, user_id: auth0User.user_id, email: auth0User.email }
        : { created: false },
      reset: resetTicketUrl ? { ticketUrl: resetTicketUrl, ttlSec: 86400 } : null,
    });
  } catch (err) {
    next(err);
  }
});

/* ===================== PATCH /:id ===================== */
r.patch("/:id", devOr(requirePerm("iam.users.manage")), async (req, res, next) => {
  try {
    const { id } = req.params;
    const patch = { ...(req.body || {}) };

    if (patch.email !== undefined) patch.email = normEmail(patch.email);
    if (patch.name !== undefined) patch.name = String(patch.name || "").trim();
    if (patch.roles !== undefined) patch.roles = toStringArray(patch.roles, { lower: true });
    if (patch.perms !== undefined) patch.perms = toStringArray(patch.perms, { lower: false });
    if (patch.active !== undefined) patch.active = normBool(patch.active);

    const before = await IamUser.findById(id).lean();

    const item = await IamUser.findByIdAndUpdate(id, { $set: patch }, { new: true }).lean();
    if (!item) return res.status(404).json({ ok: false, error: "No encontrado" });

    await writeAudit(req, {
      action: "update",
      entity: "user",
      entityId: id,
      before: before
        ? { email: before.email, roles: before.roles, perms: before.perms, active: before.active }
        : null,
      after: { email: item.email, roles: item.roles, perms: item.perms, active: item.active },
    });

    res.json({ ok: true, item });
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
    if (!item) return res.status(404).json({ ok: false, error: "No encontrado" });

    await writeAudit(req, {
      action: "activate",
      entity: "user",
      entityId: id,
      before: before ? { active: before.active } : null,
      after: { active: true },
    });

    res.json({ ok: true, item });
  } catch (err) {
    next(err);
  }
});

r.post("/:id/disable", devOr(requirePerm("iam.users.manage")), async (req, res, next) => {
  try {
    const { id } = req.params;

    const before = await IamUser.findById(id).lean();

    const item = await IamUser.findByIdAndUpdate(id, { $set: { active: false } }, { new: true }).lean();
    if (!item) return res.status(404).json({ ok: false, error: "No encontrado" });

    await writeAudit(req, {
      action: "deactivate",
      entity: "user",
      entityId: id,
      before: before ? { active: before.active } : null,
      after: { active: false },
    });

    res.json({ ok: true, item });
  } catch (err) {
    next(err);
  }
});

/* ===================== PASSWORD (LOCAL) ===================== */
r.post("/:id/password", devOr(requirePerm("iam.users.manage")), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { password } = req.body || {};
    const pwd = String(password || "").trim();
    if (!pwd) return res.status(400).json({ ok: false, error: "password requerido" });

    const before = await IamUser.findById(id).select("+passwordHash").lean();
    if (!before) return res.status(404).json({ ok: false, error: "No encontrado" });

    const passwordHash = await hashPassword(pwd);
    const item = await IamUser.findByIdAndUpdate(
      id,
      { $set: { passwordHash, provider: "local" } },
      { new: true }
    )
      .select("+passwordHash")
      .lean();

    await writeAudit(req, {
      action: "update",
      entity: "user",
      entityId: id,
      before: { hasPassword: !!before?.passwordHash },
      after: { hasPassword: !!item?.passwordHash },
    });

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

/* ===================== DELETE /:id ===================== */
r.delete("/:id", devOr(requirePerm("iam.users.manage")), async (req, res, next) => {
  try {
    const { id } = req.params;

    const before = await IamUser.findById(id).lean();
    if (!before) return res.status(404).json({ ok: false, error: "No encontrado" });

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