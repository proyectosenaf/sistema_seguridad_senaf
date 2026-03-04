// server/modules/iam/routes/me.routes.js
import { Router } from "express";
import { buildContextFrom } from "../utils/rbac.util.js";

const r = Router();

/** Timeout helper (evita pending infinito si DB se cuelga) */
function withTimeout(promise, ms, label = "op") {
  return Promise.race([
    promise,
    new Promise((_, rej) =>
      setTimeout(() => rej(new Error(`[timeout] ${label} > ${ms}ms`)), ms)
    ),
  ]);
}

/* =========================
   Helpers de autorización
========================= */
function asArr(v) {
  if (!v) return [];
  return Array.isArray(v) ? v : [v];
}

function normalizeRole(r) {
  return String(r || "").trim().toLowerCase();
}
function normalizePerm(p) {
  return String(p || "").trim();
}

function isVisitorByRoles(roles = []) {
  const R = new Set((roles || []).map(normalizeRole).filter(Boolean));
  return R.has("visita") || R.has("visitor");
}

function buildEvaluator({ roles = [], perms = [] }) {
  const roleSet = new Set((roles || []).map(normalizeRole).filter(Boolean));
  const permSet = new Set((perms || []).map(normalizePerm).filter(Boolean));
  const permSetLower = new Set(
    (perms || []).map((p) => normalizePerm(p).toLowerCase()).filter(Boolean)
  );

  const hasWildcard =
    permSet.has("*") ||
    permSetLower.has("*") ||
    roleSet.has("admin") ||
    roleSet.has("administrador");

  const tokenMatches = (k) => {
    if (!k) return false;
    if (hasWildcard) return true;

    const raw = String(k).trim();
    const low = raw.toLowerCase();

    return permSet.has(raw) || permSetLower.has(low) || roleSet.has(low);
  };

  const hasPerm = (p) => (!p ? true : tokenMatches(p));

  const hasAny = (arr) => {
    const A = asArr(arr);
    if (!A.length) return true;
    return A.some(tokenMatches);
  };

  const hasAll = (arr) => {
    const A = asArr(arr);
    if (!A.length) return true;
    return A.every(tokenMatches);
  };

  const canAccess = (rules) => {
    if (!rules) return true;
    let ok = true;
    if (rules.requirePerm) ok = ok && hasPerm(rules.requirePerm);
    if (asArr(rules.anyOf).length) ok = ok && hasAny(rules.anyOf);
    if (asArr(rules.allOf).length) ok = ok && hasAll(rules.allOf);
    if (asArr(rules.requireRole).length) ok = ok && hasAny(rules.requireRole);
    return ok;
  };

  return { roleSet, permSet, permSetLower, hasWildcard, canAccess, tokenMatches };
}

/* =========================
   Route rules centralizadas
========================= */
function buildRouteRules() {
  return {
    "iam.admin": {
      anyOf: [
        "iam.users.manage",
        "iam.roles.manage",
        "iam.usuarios.gestionar",
        "iam.roles.gestionar",
        "*",
      ],
    },

    incidentes: {
      anyOf: ["incidentes.read", "incidentes.list", "incidentes.ver", "incidentes", "*"],
    },
    "incidentes.create": {
      anyOf: ["incidentes.create", "incidentes.crear", "*"],
    },

    accesos: { anyOf: ["accesos.read", "accesos.ver", "accesos", "*"] },
    bitacora: { anyOf: ["bitacora.read", "bitacora.ver", "bitacora", "*"] },
    supervision: { anyOf: ["supervision.read", "supervision.ver", "supervision", "*"] },

    "visitas.control": { anyOf: ["visitas.manage", "visitas.control", "visitas", "*"] },

    "rondasqr.scan": { anyOf: ["rondas.scan", "rondasqr.scan", "guardia", "*"] },
    "rondasqr.reports": { anyOf: ["rondas.reports", "rondasqr.reports", "supervisor", "*"] },
    "rondasqr.admin": {
      anyOf: ["rondas.admin", "rondasqr.admin", "ti", "administrador_it", "*"],
    },
  };
}

/* =========================
   DefaultRoute desde backend
========================= */
function pickDefaultRoute({ visitor, roles = [], perms = [], isSuperAdmin = false }) {
  if (isSuperAdmin) return "/iam/admin";

  const R = new Set((roles || []).map(normalizeRole).filter(Boolean));
  const Praw = Array.isArray(perms) ? perms : [];
  const P = new Set(Praw.map(normalizePerm).filter(Boolean));
  const Plow = new Set(Praw.map((p) => normalizePerm(p).toLowerCase()).filter(Boolean));

  const hasWildcard = P.has("*") || Plow.has("*") || R.has("admin") || R.has("administrador");

  // ✅ FIX CRÍTICO:
  // NO mandes a visitas por "roles/perms vacíos". Solo si visitor=true.
  if (visitor) return "/visitas/agenda";

  if (hasWildcard || R.has("ti") || R.has("administrador_it")) return "/iam/admin";
  if (R.has("guardia")) return "/rondasqr/scan";
  if (R.has("supervisor")) return "/rondasqr/reports";
  if (R.has("recepcion")) return "/visitas/control";
  return "/";
}

/* =========================
   Admin-like (nunca visitor)
========================= */
function isAdminLike({ roles = [], perms = [], isSuperAdmin = false }) {
  if (isSuperAdmin) return true;

  const R = new Set((roles || []).map(normalizeRole).filter(Boolean));
  const Praw = Array.isArray(perms) ? perms : [];
  const Plow = new Set(Praw.map((p) => String(p || "").trim().toLowerCase()).filter(Boolean));

  if (Plow.has("*")) return true;

  if (R.has("admin") || R.has("administrador") || R.has("ti") || R.has("administrador_it")) {
    return true;
  }

  return false;
}

/**
 * GET /api/iam/v1/me
 */
r.get("/", async (req, res, next) => {
  try {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    res.setHeader("Pragma", "no-cache");

    const ctx = await withTimeout(buildContextFrom(req), 7000, "buildContextFrom");

    const routeRules = buildRouteRules();

    const email = String(ctx.email || "").toLowerCase().trim() || null;
    const isSuperAdmin = !!ctx.isSuperAdmin;

    // 1) Sin identidad real => se considera VISITA (deny-by-default)
    if (!email) {
      const visitor = true;

      const roles = ["visita"];
      const permissions = [];

      const canBase = Object.fromEntries(Object.keys(routeRules).map((k) => [k, false]));

      return res.json({
        ok: true,
        user: null,

        roles,
        permissions,
        perms: permissions,

        visitor,
        isVisitor: visitor,
        email: null,

        isSuperAdmin,
        superadmin: isSuperAdmin,

        mustChangePassword: false,

        routeRules,
        can: canBase,

        defaultRoute: pickDefaultRoute({ visitor, roles, perms: permissions, isSuperAdmin }),
      });
    }

    // 2) Hay email pero no se resolvió usuario
    if (!ctx.user) {
      const visitor = true;
      const roles = ["visita"];
      const permissions = [];
      const canBase = Object.fromEntries(Object.keys(routeRules).map((k) => [k, false]));

      return res.status(401).json({
        ok: false,
        error: "user_not_resolved",
        message:
          "Token válido (email presente) pero no se pudo resolver el usuario en IAM. Revisa Mongo o auto-provision en buildContextFrom.",
        email,

        user: null,
        roles,
        permissions,
        perms: permissions,

        visitor,
        isVisitor: visitor,

        isSuperAdmin,
        superadmin: isSuperAdmin,

        mustChangePassword: false,
        routeRules,
        can: canBase,
        defaultRoute: "/login",
      });
    }

    const u = ctx.user;

    // roles/perms desde ctx o desde user
    let roles = Array.isArray(ctx.roles) ? ctx.roles : Array.isArray(u.roles) ? u.roles : [];

    let permissions = Array.isArray(ctx.permissions)
      ? ctx.permissions
      : Array.isArray(u.perms)
      ? u.perms
      : [];

    // superadmin hard-pass: inyecta wildcard para can/defaultRoute
    if (isSuperAdmin) {
      if (!permissions.includes("*")) permissions = ["*", ...permissions];
    }

    // mustChangePassword (si usas expiración también)
    let mustChangePassword = !!u.mustChangePassword;
    try {
      if (u.passwordExpiresAt && new Date() > new Date(u.passwordExpiresAt)) {
        mustChangePassword = true;
      }
    } catch {
      // ignore
    }

    // visitor real: por flags/rol, pero NUNCA si es admin-like
    const adminLike = isAdminLike({ roles, perms: permissions, isSuperAdmin });
    const visitorRaw = !!u.visitor || !!u.isVisitor || isVisitorByRoles(roles);
    const visitor = adminLike ? false : visitorRaw;

    const evalr = buildEvaluator({ roles, perms: permissions });

    // can por reglas
    let can = Object.fromEntries(
      Object.entries(routeRules).map(([k, rules]) => [k, !!evalr.canAccess(rules)])
    );

    // ✅ FIX: adminLike debe ver el sistema aunque temporalmente falten roles/perms expandidos.
    if (adminLike) {
      can = Object.fromEntries(Object.keys(routeRules).map((k) => [k, true]));
    }

    // si es visitante, deny-by-default excepto visitas
    if (visitor && !isSuperAdmin) {
      can = Object.fromEntries(Object.keys(routeRules).map((k) => [k, false]));
      can["visitas.control"] = true;
    }

    // si es superadmin => todo true
    if (isSuperAdmin) {
      can = Object.fromEntries(Object.keys(routeRules).map((k) => [k, true]));
    }

    return res.json({
      ok: true,

      user: {
        id: String(u._id || u.id || ""),
        email: u.email,
        name: u.name || "",
      },

      roles,
      permissions,
      perms: permissions,

      visitor,
      isVisitor: visitor,

      email: u.email,

      isSuperAdmin,
      superadmin: isSuperAdmin,

      mustChangePassword,

      routeRules,
      can,

      defaultRoute: pickDefaultRoute({ visitor, roles, perms: permissions, isSuperAdmin }),
    });
  } catch (e) {
    if (String(e?.message || "").startsWith("[timeout]")) {
      return res.status(503).json({
        ok: false,
        error: "iam_timeout",
        message: e.message,
      });
    }
    next(e);
  }
});

export default r;