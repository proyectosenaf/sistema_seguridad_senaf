// client/src/iam/api/IamGuard.jsx
import React, { useEffect, useState } from "react";
import { iamApi } from "../api/iamApi";

// 🌍 Detectar si estamos en localhost
const IS_LOCALHOST =
  typeof window !== "undefined" &&
  (window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1");

// 📧 Super-admin por correo (configurable por env)
const SUPERADMIN_EMAIL = String(
  import.meta.env.VITE_SUPERADMIN_EMAIL || ""
).toLowerCase();

// 🌐 Entorno (por convención tuya: VITE_ENV=production)
const VITE_ENV = String(import.meta.env.VITE_ENV || "").toLowerCase();
const MODE = String(import.meta.env.MODE || "").toLowerCase();
const IS_PROD = VITE_ENV === "production" || MODE === "production";

// 🔓 Skip IAM SOLO en localhost o flags explícitos
const SKIP_IAM =
  IS_LOCALHOST ||
  String(import.meta.env.VITE_SKIP_VERIFY || "") === "1" ||
  String(import.meta.env.VITE_DISABLE_AUTH || "") === "1" ||
  String(import.meta.env.VITE_FORCE_DEV_IAM || "") === "1";

/* =========================================================
   ✅ Cache global para evitar múltiples /me por cada IamGuard
   - 1 sola llamada por sesión (mientras no recargues página)
   - si falla, cachea el fallo para no spamear el backend
========================================================= */
let _mePromise = null;
let _meCache = null; // { ok:true, roles, perms, email } OR { ok:false }
function resetIamMeCache() {
  _mePromise = null;
  _meCache = null;
}

// opcional: si tu app hace logout, puedes llamar resetIamMeCache()
// desde fuera, pero aquí no lo exporto para no romper imports.

function asArr(v) {
  if (!v) return [];
  return Array.isArray(v) ? v : [v];
}

function normalizeRoles(v) {
  return asArr(v)
    .map((x) => String(x || "").trim())
    .filter(Boolean);
}

function normalizePerms(v) {
  return asArr(v)
    .map((x) => String(x || "").trim())
    .filter(Boolean);
}

function pickEmailFromMe(me) {
  return String(
    me?.email ||
      me?.user?.email ||
      me?.data?.email ||
      me?.profile?.email ||
      ""
  )
    .trim()
    .toLowerCase();
}

function pickAuthUserFromMe(me) {
  // Algunos backends devuelven profile/user
  const u = me?.user || me?.profile || me?.data?.user || null;
  return u && typeof u === "object" ? u : null;
}

async function getMeCached() {
  if (_meCache) return _meCache;

  if (!_mePromise) {
    _mePromise = (async () => {
      try {
        const me = await iamApi.me(undefined);

        let roles = me?.roles || me?.user?.roles || me?.data?.roles || [];
        let perms =
          me?.perms ||
          me?.permissions ||
          me?.data?.perms ||
          me?.data?.permissions ||
          [];

        roles = normalizeRoles(roles);
        perms = normalizePerms(perms);

        const emailFromMe = pickEmailFromMe(me);
        const authUser = pickAuthUserFromMe(me);
        const emailFromProfile =
          String(authUser?.email || authUser?.correo || "").trim().toLowerCase();

        // Superadmin por correo => wildcard
        const isSuperadmin =
          !!SUPERADMIN_EMAIL &&
          (emailFromMe === SUPERADMIN_EMAIL || emailFromProfile === SUPERADMIN_EMAIL);

        if (isSuperadmin) {
          roles = Array.from(new Set([...roles, "admin"]));
          perms = Array.from(new Set([...perms, "*"]));
        }

        const out = { ok: true, roles, perms, email: emailFromMe };
        _meCache = out;
        return out;
      } catch (e) {
        const out = { ok: false, roles: [], perms: [], email: "" };
        _meCache = out;

        if (!IS_PROD) {
          // eslint-disable-next-line no-console
          console.warn("[IamGuard] fallo /me:", e?.message || e);
        }
        return out;
      }
    })();
  }

  return _mePromise;
}

/**
 * IamGuard
 * Props:
 * - requirePerm: string (p.ej. "iam.users.manage")
 * - anyOf: string | string[]   ✅ acepta roles o permisos (compat)
 * - allOf: string | string[]   ✅ acepta roles o permisos (compat)
 * - requireRole: string | string[]
 * - fallback: ReactNode
 */
export default function IamGuard({
  requirePerm,
  anyOf,
  allOf,
  requireRole,
  fallback = null,
  children,
}) {
  // En modo skip => admin + wildcard
  const [state, setState] = useState(
    SKIP_IAM
      ? { loading: false, roles: ["admin"], perms: ["*"], email: "" }
      : { loading: true, roles: [], perms: [], email: "" }
  );

  useEffect(() => {
    if (SKIP_IAM) return;

    let cancel = false;

    (async () => {
      const d = await getMeCached();
      if (cancel) return;

      if (d?.ok) {
        setState({ loading: false, roles: d.roles || [], perms: d.perms || [], email: d.email || "" });
      } else {
        setState({ loading: false, roles: [], perms: [], email: "" });
      }
    })();

    return () => {
      cancel = true;
    };
  }, []);

  // ✅ Mantener estructura UI sin “romper” layout: si loading y fallback existe, úsalo
  if (state.loading) return fallback || <div className="p-6">Cargando…</div>;

  // Sets normalizados
  const roleSet = new Set((state.roles || []).map((r) => String(r).toLowerCase()));
  const permSet = new Set((state.perms || []).map((p) => String(p)));
  const permSetLower = new Set((state.perms || []).map((p) => String(p).toLowerCase()));

  const hasWildcard = permSet.has("*") || permSetLower.has("*") || roleSet.has("admin");

  const hasPerm = (p) => {
    if (!p) return true;
    if (hasWildcard) return true;
    const key = String(p);
    return permSet.has(key) || permSetLower.has(key.toLowerCase());
  };

  const hasRole = (r) => {
    const A = asArr(r).map((x) => String(x).toLowerCase());
    if (!A.length) return true;
    if (hasWildcard) return true;
    return A.some((x) => roleSet.has(x));
  };

  const tokenMatches = (k) => {
    if (!k) return false;
    if (hasWildcard) return true;

    const raw = String(k);
    const low = raw.toLowerCase();
    // compat: cualquier string puede ser permiso o rol (tu diseño actual)
    return permSet.has(raw) || permSetLower.has(low) || roleSet.has(low);
  };

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

  // Evaluación final
  let ok = true;
  if (requirePerm) ok = ok && hasPerm(requirePerm);
  if (asArr(anyOf).length) ok = ok && hasAny(anyOf);
  if (asArr(allOf).length) ok = ok && hasAll(allOf);
  if (requireRole) ok = ok && hasRole(requireRole);

  return ok ? <>{children}</> : fallback || <div className="p-6">No autorizado</div>;
}