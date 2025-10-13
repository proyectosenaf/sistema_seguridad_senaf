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
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Enriquecedor de request:
 * - Detecta identidad desde JWT (si existe) o desde headers DEV (x-user-*)
 * - Busca usuario primero en IamUser y si no existe en colección "usuarios"
 * - Autoprovisiona IamUser (activo) si no existía y tenemos email/uid (opcional)
 * - Calcula roles/permisos efectivos:
 *    * roles de BD + x-roles DEV
 *    * permisos directos en el doc (perms) + x-perms DEV + permisos de roles
 *
 * Nunca bloquea la request; siempre hace next().
 */
export async function iamEnrich(req, _res, next) {
  try {
    // Identidad desde JWT (si existe) o desde headers de desarrollo
    const uid =
      req.auth?.payload?.sub ||
      req.user?._id ||
      req.user?.id ||
      req.user?.sub ||
      req.headers["x-user-id"] ||
      null;

    const email =
      req.auth?.payload?.email ||
      req.user?.email ||
      req.headers["x-user-email"] ||
      null;

    const name = req.user?.name || req.headers["x-user-name"] || null;

    // Roles/permisos inyectados por headers DEV (útiles en entorno sin Auth0)
    const devRoles = parseList(req.headers["x-roles"]);
    const devPerms = parseList(req.headers["x-perms"]);

    // Estado base
    req.iam = { userId: uid, email, name, roles: [], permissions: [] };

    // 1) Buscar usuario en IamUser
    let user =
      (uid && (await IamUser.findOne({ externalId: uid }).lean())) ||
      (email && (await IamUser.findOne({ email }).lean())) ||
      null;

    // 2) Si no está en IamUser, intentar en colección "usuarios"
    if (!user && email) {
      try {
        const raw = await req.app
          .get("mongoose")
          ?.connection.collection("usuarios")
          .findOne({ email });
        if (raw) {
          user = {
            _id: raw._id,
            externalId: raw.externalId,
            email: raw.email,
            name: raw.name,
            roles: Array.isArray(raw.roles) ? raw.roles : [],
            perms: Array.isArray(raw.perms) ? raw.perms : [],
            active: raw.active !== false,
            _source: "usuarios",
          };
        }
      } catch {
        // Ignorar si la colección no existe
      }
    }

    // 3) Autoprovisión en IamUser si tenemos identidad y no existe
    if (!user && (uid || email)) {
      const roles = [];
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

    // 4) Vincular externalId si faltaba
    if (user && uid && !user.externalId && user._source !== "usuarios") {
      await IamUser.updateOne({ _id: user._id }, { $set: { externalId: uid } });
      user.externalId = uid;
    }

    // 5) Construir roles/permisos efectivos
    const roleNames = new Set([
      ...(Array.isArray(user?.roles) ? user.roles : []),
      ...devRoles,
    ]);
    const permSet = new Set([
      ...(Array.isArray(user?.perms) ? user.perms : []),
      ...devPerms,
    ]);

    // Expandir permisos por roles (si existen en IamRole)
    if (roleNames.size) {
      const roleDocs = await IamRole.find({ name: { $in: [...roleNames] } }).lean();
      roleDocs.forEach((r) => (r.permissions || []).forEach((p) => permSet.add(p)));
    }

    // Guardar en req.iam
    req.iam.roles = [...roleNames];
    req.iam.permissions = [...permSet];
  } catch (e) {
    console.warn("[iamEnrich] fallo no crítico:", e?.message || e);
    req.iam = req.iam || { roles: [], permissions: [] };
  }
  next();
}

/**
 * “Cerrojo” neutro: no bloquea (usa tu auth propio en otros módulos).
 */
export function iamRequireAuth(_req, _res, next) {
  next();
}

/**
 * Middleware de permiso simple basado en req.iam.permissions.
 */
export function iamAllowPerm(perm) {
  return (req, res, next) => {
    const perms = req.iam?.permissions || [];
    if (perms.includes("*") || perms.includes(perm)) return next();
    return res.status(403).json({ ok: false, error: "forbidden", need: perm });
  };
}
