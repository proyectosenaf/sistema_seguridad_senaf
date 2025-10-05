// server/modules/iam/utils/rbac.util.js
import IamUser from "../models/IamUser.model.js";
import IamRole from "../models/IamRole.model.js";

/**
 * Si defines IAM_DEFAULT_ROLE=visitor en .env, al primer ingreso
 * (cuando no existe el usuario en BD) se le asigna automáticamente ese rol
 * si existe entre los IamRole.name.
 */
const DEFAULT_ROLE_NAME = process.env.IAM_DEFAULT_ROLE || "visitor";

// Util para parsear headers tipo "admin, supervisor"
function parseList(v) {
  if (!v) return [];
  return String(v)
    .split(/[,\s]+/)
    .map(s => s.trim())
    .filter(Boolean);
}

/**
 * Enriquecedor de request:
 * - Detecta identidad desde JWT (si existe) o desde headers DEV (x-user-*)
 * - Autoprovisiona un IamUser (activo) si no existe, opcionalmente con rol por defecto
 * - Vincula externalId si faltaba
 * - Calcula roles/permisos efectivos (roles de BD + x-roles/x-perms DEV)
 *
 * No lanza errores: siempre hace next().
 */
export async function iamEnrich(req, _res, next) {
  try {
    // Identidad desde JWT (si existe) o desde headers de desarrollo
    const uid   = req.user?._id || req.user?.id || req.user?.sub || req.headers["x-user-id"] || null;
    const email = req.user?.email || req.headers["x-user-email"] || null;
    const name  = req.user?.name  || req.headers["x-user-name"]  || null;

    // Roles/permisos inyectados por headers DEV (útiles en entorno sin Auth0)
    const devRoles = parseList(req.headers["x-roles"]);
    const devPerms = parseList(req.headers["x-perms"]);

    // Estado base en req.iam
    req.iam = { userId: uid, email, roles: [], permissions: [] };

    // 1) Buscar/crear usuario
    let user =
      (uid && (await IamUser.findOne({ externalId: uid }).lean())) ||
      (email && (await IamUser.findOne({ email }).lean())) ||
      null;

    if (!user && (uid || email)) {
      // Autoprovisión con rol por defecto si existe
      let roles = [];
      if (DEFAULT_ROLE_NAME) {
        const def = await IamRole.findOne({ name: DEFAULT_ROLE_NAME }).lean();
        if (def) roles.push(DEFAULT_ROLE_NAME);
      }
      const created = await IamUser.create({
        externalId: uid || undefined,
        email: email || undefined,
        name: name || undefined,
        active: true,
        roles,
      });
      user = created.toObject();
    }

    // 2) Vincular externalId si el usuario existía sin link
    if (user && uid && !user.externalId) {
      await IamUser.updateOne({ _id: user._id }, { $set: { externalId: uid } });
      user.externalId = uid;
    }

    // 3) Construir roles/permisos efectivos
    const roleNames = new Set([
      ...(Array.isArray(user?.roles) ? user.roles : []),
      ...devRoles, // headers DEV suman
    ]);

    const permSet = new Set(devPerms); // headers DEV también suman permisos directos

    if (roleNames.size) {
      const roleDocs = await IamRole.find({ name: { $in: [...roleNames] } }).lean();
      roleDocs.forEach(r => (r.permissions || []).forEach(p => permSet.add(p)));
    }

    req.iam.roles = [...roleNames];
    req.iam.permissions = [...permSet];
  } catch (e) {
    // No bloquear la request por errores de enriquecimiento
    console.warn("[iamEnrich] fallo no crítico:", e?.message || e);
    req.iam = req.iam || { roles: [], permissions: [] };
  }
  next();
}

/**
 * Cerrojo “decorativo”: ahora mismo dejas pasar todo porque ya usas tu auth propio.
 * Déjalo así para no romper flujos.
 */
export function iamRequireAuth(_req, _res, next) {
  next();
}

/**
 * Middleware de permiso simple basado en req.iam.permissions.
 * Úsalo en rutas internas si quieres un chequeo rápido.
 */
export function iamAllowPerm(perm) {
  return (req, res, next) => {
    const perms = req.iam?.permissions || [];
    if (perms.includes("*") || perms.includes(perm)) return next();
    return res.status(403).json({ ok: false, error: "forbidden", need: perm });
  };
}
