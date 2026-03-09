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

function uniq(arr) {
  return Array.from(new Set((arr || []).filter(Boolean)));
}

function normalizeRolesArr(arr) {
  return uniq(asArr(arr).map(normalizeRole).filter(Boolean));
}

function normalizePermsArr(arr) {
  return uniq(asArr(arr).map(normalizePerm).filter(Boolean));
}

function isVisitorByRoles(roles = []) {
  const R = new Set(normalizeRolesArr(roles));
  return R.has("visita") || R.has("visitor");
}

function getSuperadminEmails() {
  return uniq(
    [
      process.env.SUPERADMIN_EMAIL,
      process.env.VITE_SUPERADMIN_EMAIL,
      "proyectosenaf@gmail.com",
    ]
      .flatMap((v) =>
        String(v || "")
          .split(",")
          .map((x) => x.trim().toLowerCase())
      )
      .filter(Boolean)
  );
}

function isSuperadminEmail(email) {
  const e = String(email || "").trim().toLowerCase();
  if (!e) return false;
  return getSuperadminEmails().includes(e);
}

function buildEvaluator({ roles = [], perms = [] }) {
  const roleSet = new Set(normalizeRolesArr(roles));
  const normalizedPerms = normalizePermsArr(perms);
  const permSet = new Set(normalizedPerms);
  const permSetLower = new Set(normalizedPerms.map((p) => p.toLowerCase()));

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
    "nav.accesos": {
      anyOf: [
        "accesos.records.read",
        "accesos.records.write",
        "accesos.reports.export",
        "accesos.read",
        "accesos.write",
        "accesos.export",
        "accesos",
        "*",
      ],
    },

    "nav.rondas": {
      anyOf: [
        "rondasqr.scan.execute",
        "rondasqr.scan.manual",
        "rondasqr.checks.write",
        "rondasqr.panic.read",
        "rondasqr.panic.write",
        "rondasqr.offline.read",
        "rondasqr.offline.write",
        "rondasqr.reports.read",
        "rondasqr.reports.query",
        "rondasqr.reports.export",
        "rondasqr.reports.print",
        "rondasqr.reports.map",
        "rondasqr.reports.highlight",
        "rondasqr.assignments.read",
        "rondasqr.assignments.write",
        "rondasqr.rounds.read",
        "rondasqr.rounds.write",
        "rondasqr.checkpoints.read",
        "rondasqr.checkpoints.write",
        "rondasqr.sites.read",
        "rondasqr.sites.write",
        "rondasqr.qr.read",
        "rondasqr.qr.generate",
        "rondasqr.qr.export",
        "rondas.scan",
        "rondas.reports",
        "rondas.admin",
        "rondasqr.scan",
        "rondasqr.reports",
        "rondasqr.admin",
        "guardia",
        "supervisor",
        "administrador_it",
        "ti",
        "*",
      ],
    },

    "nav.incidentes": {
      anyOf: [
        "incidentes.records.read",
        "incidentes.records.write",
        "incidentes.records.delete",
        "incidentes.records.close",
        "incidentes.evidences.write",
        "incidentes.reports.read",
        "incidentes.reports.export",
        "incidentes.read",
        "incidentes.create",
        "incidentes.edit",
        "incidentes.delete",
        "incidentes.close",
        "incidentes.attach",
        "incidentes.reports",
        "incidentes.export",
        "incidentes.list",
        "incidentes.ver",
        "incidentes",
        "*",
      ],
    },

    "nav.visitas": {
      anyOf: [
        "visitas.records.read",
        "visitas.records.write",
        "visitas.records.close",
        "visitas.reports.export",
        "visitas.read",
        "visitas.write",
        "visitas.close",
        "visitas.export",
        "visitas.manage",
        "visitas.control",
        "visitas",
        "*",
      ],
    },

    "nav.bitacora": {
      anyOf: [
        "bitacora.records.read",
        "bitacora.records.write",
        "bitacora.reports.export",
        "bitacora.read",
        "bitacora.write",
        "bitacora.export",
        "bitacora.ver",
        "bitacora",
        "*",
      ],
    },

    "nav.iam": {
      anyOf: [
        "iam.users.read",
        "iam.users.write",
        "iam.roles.read",
        "iam.roles.write",
        "iam.audit.read",
        "iam.users.view",
        "iam.users.manage",
        "iam.roles.manage",
        "iam.audit.view",
        "iam.usuarios.gestionar",
        "iam.roles.gestionar",
        "iam.admin",
        "*",
      ],
    },

    "iam.admin": {
      anyOf: [
        "iam.users.read",
        "iam.users.write",
        "iam.roles.read",
        "iam.roles.write",
        "iam.audit.read",
        "iam.users.manage",
        "iam.roles.manage",
        "iam.usuarios.gestionar",
        "iam.roles.gestionar",
        "*",
      ],
    },

    incidentes: {
      anyOf: [
        "incidentes.records.read",
        "incidentes.reports.read",
        "incidentes.read",
        "incidentes.list",
        "incidentes.ver",
        "incidentes",
        "*",
      ],
    },

    "incidentes.create": {
      anyOf: [
        "incidentes.records.write",
        "incidentes.create",
        "incidentes.crear",
        "*",
      ],
    },

    accesos: {
      anyOf: [
        "accesos.records.read",
        "accesos.records.write",
        "accesos.read",
        "accesos.ver",
        "accesos",
        "*",
      ],
    },

    bitacora: {
      anyOf: [
        "bitacora.records.read",
        "bitacora.records.write",
        "bitacora.read",
        "bitacora.ver",
        "bitacora",
        "*",
      ],
    },

    "visitas.control": {
      anyOf: [
        "visitas.records.read",
        "visitas.records.write",
        "visitas.records.close",
        "visitas.manage",
        "visitas.control",
        "visitas",
        "*",
      ],
    },

    "rondasqr.scan": {
      anyOf: [
        "rondasqr.scan.execute",
        "rondasqr.scan.manual",
        "rondasqr.checks.write",
        "rondas.scan",
        "rondasqr.scan",
        "guardia",
        "*",
      ],
    },

    "rondasqr.reports": {
      anyOf: [
        "rondasqr.reports.read",
        "rondasqr.reports.query",
        "rondasqr.reports.export",
        "rondasqr.reports.print",
        "rondasqr.reports.map",
        "rondasqr.reports.highlight",
        "rondas.reports",
        "rondasqr.reports",
        "supervisor",
        "*",
      ],
    },

    "rondasqr.admin": {
      anyOf: [
        "rondasqr.assignments.read",
        "rondasqr.assignments.write",
        "rondasqr.rounds.read",
        "rondasqr.rounds.write",
        "rondasqr.checkpoints.read",
        "rondasqr.checkpoints.write",
        "rondasqr.sites.read",
        "rondasqr.sites.write",
        "rondasqr.qr.read",
        "rondasqr.qr.generate",
        "rondasqr.qr.export",
        "rondas.admin",
        "rondasqr.admin",
        "ti",
        "administrador_it",
        "*",
      ],
    },

    "rondas.panel": {
      anyOf: [
        "rondasqr.scan.execute",
        "rondasqr.scan.manual",
        "rondasqr.checks.write",
        "rondasqr.panic.read",
        "rondasqr.panic.write",
        "rondasqr.offline.read",
        "rondasqr.offline.write",
        "rondasqr.reports.read",
        "rondasqr.assignments.read",
        "rondasqr.rounds.read",
        "rondas.scan",
        "rondas.reports",
        "rondas.admin",
        "rondasqr.scan",
        "rondasqr.reports",
        "rondasqr.admin",
        "guardia",
        "supervisor",
        "administrador_it",
        "ti",
        "*",
      ],
    },

    "rondas.admin": {
      anyOf: [
        "rondasqr.assignments.read",
        "rondasqr.assignments.write",
        "rondasqr.rounds.read",
        "rondasqr.rounds.write",
        "rondasqr.checkpoints.read",
        "rondasqr.checkpoints.write",
        "rondasqr.sites.read",
        "rondasqr.sites.write",
        "rondasqr.qr.read",
        "rondasqr.qr.generate",
        "rondasqr.qr.export",
        "rondas.admin",
        "rondasqr.admin",
        "supervisor",
        "administrador_it",
        "ti",
        "*",
      ],
    },

    "rondas.reports": {
      anyOf: [
        "rondasqr.reports.read",
        "rondasqr.reports.query",
        "rondasqr.reports.export",
        "rondasqr.reports.print",
        "rondasqr.reports.map",
        "rondasqr.reports.highlight",
        "rondas.reports",
        "rondasqr.reports",
        "supervisor",
        "administrador_it",
        "ti",
        "*",
      ],
    },
  };
}

/* =========================
   DefaultRoute desde backend
========================= */
function pickDefaultRoute({ visitor, roles = [], perms = [], isSuperAdmin = false }) {
  if (isSuperAdmin) return "/iam/admin";

  const R = new Set(normalizeRolesArr(roles));
  const Praw = normalizePermsArr(perms);
  const P = new Set(Praw);
  const Plow = new Set(Praw.map((p) => p.toLowerCase()));

  const hasWildcard = P.has("*") || Plow.has("*") || R.has("admin") || R.has("administrador");

  if (visitor) return "/visitas/agenda";

  if (hasWildcard || R.has("ti") || R.has("administrador_it")) return "/iam/admin";
  if (R.has("guardia")) return "/rondasqr";
  if (R.has("supervisor")) return "/rondasqr";
  if (R.has("recepcion")) return "/visitas/control";
  return "/";
}

/* =========================
   Admin-like (nunca visitor)
========================= */
function isAdminLike({ roles = [], perms = [], isSuperAdmin = false }) {
  if (isSuperAdmin) return true;

  const R = new Set(normalizeRolesArr(roles));
  const Praw = normalizePermsArr(perms);
  const Plow = new Set(Praw.map((p) => p.toLowerCase()));

  if (Plow.has("*")) return true;

  if (R.has("admin") || R.has("administrador") || R.has("ti") || R.has("administrador_it")) {
    return true;
  }

  return false;
}

function buildAllFalseCan(routeRules) {
  return Object.fromEntries(Object.keys(routeRules).map((k) => [k, false]));
}

function buildAllTrueCan(routeRules) {
  return Object.fromEntries(Object.keys(routeRules).map((k) => [k, true]));
}

function shapeUser({ id = "", email = null, name = "", roles = [], perms = [], can = {}, superadmin = false }) {
  return {
    id: String(id || ""),
    email,
    name: String(name || "").trim(),
    roles,
    perms,
    permissions: perms,
    can,
    superadmin: !!superadmin,
    isSuperAdmin: !!superadmin,
  };
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

    const ctxEmail = String(ctx?.email || "").toLowerCase().trim() || null;
    const ctxUserEmail = String(ctx?.user?.email || "").toLowerCase().trim() || null;
    const resolvedEmail = ctxUserEmail || ctxEmail || null;

    // ✅ HARD-PASS real por correo superadmin
    const forcedSuperadmin = isSuperadminEmail(resolvedEmail);
    const isSuperAdmin = !!ctx?.isSuperAdmin || forcedSuperadmin;

    // 1) Sin identidad real => visitante
    if (!resolvedEmail) {
      const visitor = true;
      const roles = ["visita"];
      const permissions = [];
      const can = buildAllFalseCan(routeRules);

      can["nav.visitas"] = true;
      can["visitas.control"] = true;

      return res.json({
        ok: true,
        user: shapeUser({
          id: "",
          email: null,
          name: "",
          roles,
          perms: permissions,
          can,
          superadmin: false,
        }),
        roles,
        permissions,
        perms: permissions,
        visitor,
        isVisitor: visitor,
        email: null,
        isSuperAdmin: false,
        superadmin: false,
        mustChangePassword: false,
        routeRules,
        can,
        defaultRoute: pickDefaultRoute({ visitor, roles, perms: permissions, isSuperAdmin: false }),
      });
    }

    // ✅ Si es el correo superadmin, no importa si ctx.user falló
    if (!ctx?.user && forcedSuperadmin) {
      const roles = ["admin"];
      const permissions = ["*"];
      const can = buildAllTrueCan(routeRules);

      return res.json({
        ok: true,
        user: shapeUser({
          id: "superadmin-email",
          email: resolvedEmail,
          name: resolvedEmail,
          roles,
          perms: permissions,
          can,
          superadmin: true,
        }),
        roles,
        permissions,
        perms: permissions,
        visitor: false,
        isVisitor: false,
        email: resolvedEmail,
        isSuperAdmin: true,
        superadmin: true,
        mustChangePassword: false,
        routeRules,
        can,
        defaultRoute: "/iam/admin",
      });
    }

    // 2) Hay email pero no se resolvió usuario
    if (!ctx?.user) {
      const visitor = true;
      const roles = ["visita"];
      const permissions = [];
      const can = buildAllFalseCan(routeRules);

      can["nav.visitas"] = true;
      can["visitas.control"] = true;

      return res.status(401).json({
        ok: false,
        error: "user_not_resolved",
        message:
          "Token válido (email presente) pero no se pudo resolver el usuario en IAM. Revisa Mongo o auto-provision en buildContextFrom.",
        email: resolvedEmail,
        user: shapeUser({
          id: "",
          email: resolvedEmail,
          name: "",
          roles,
          perms: permissions,
          can,
          superadmin: isSuperAdmin,
        }),
        roles,
        permissions,
        perms: permissions,
        visitor,
        isVisitor: visitor,
        isSuperAdmin,
        superadmin: isSuperAdmin,
        mustChangePassword: false,
        routeRules,
        can,
        defaultRoute: "/login",
      });
    }

    const u = ctx.user;

    const ctxRoles =
      Array.isArray(ctx?.roles) && ctx.roles.filter(Boolean).length
        ? ctx.roles.filter(Boolean)
        : null;

    const userRoles = Array.isArray(u?.roles) ? u.roles.filter(Boolean) : [];
    let roles = ctxRoles && ctxRoles.length ? ctxRoles : userRoles;

    const ctxPerms =
      Array.isArray(ctx?.permissions) && ctx.permissions.filter(Boolean).length
        ? ctx.permissions.filter(Boolean)
        : null;

    const userPerms = Array.isArray(u?.perms) ? u.perms.filter(Boolean) : [];
    let permissions = ctxPerms && ctxPerms.length ? ctxPerms : userPerms;

    roles = normalizeRolesArr(roles);
    permissions = normalizePermsArr(permissions);

    // ✅ hard-pass definitivo superadmin
    if (isSuperAdmin) {
      roles = ["admin"];
      permissions = ["*"];
    }

    let mustChangePassword = !!u?.mustChangePassword;
    try {
      if (u?.passwordExpiresAt && new Date() > new Date(u.passwordExpiresAt)) {
        mustChangePassword = true;
      }
    } catch {
      // ignore
    }

    const adminLike = isAdminLike({ roles, perms: permissions, isSuperAdmin });
    const visitorRaw = !!u?.visitor || !!u?.isVisitor || isVisitorByRoles(roles);
    const visitor = adminLike ? false : visitorRaw;

    const evalr = buildEvaluator({ roles, perms: permissions });

    let can = Object.fromEntries(
      Object.entries(routeRules).map(([k, rules]) => [k, !!evalr.canAccess(rules)])
    );

    if (adminLike || isSuperAdmin) {
      can = buildAllTrueCan(routeRules);
    }

    if (visitor && !isSuperAdmin) {
      can = buildAllFalseCan(routeRules);
      can["nav.visitas"] = true;
      can["visitas.control"] = true;
    }

    const responseUser = shapeUser({
      id: String(u?._id || u?.id || ""),
      email: u?.email || resolvedEmail,
      name: u?.name || u?.email || resolvedEmail || "",
      roles,
      perms: permissions,
      can,
      superadmin: isSuperAdmin,
    });

    return res.json({
      ok: true,
      user: responseUser,
      roles,
      permissions,
      perms: permissions,
      visitor,
      isVisitor: visitor,
      email: responseUser.email,
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