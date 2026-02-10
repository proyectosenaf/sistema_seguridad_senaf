// client/src/iam/api/IamGuard.jsx
import React, { useEffect, useState } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import { iamApi } from "../api/iamApi";

// 🌍 Detectar si estamos en localhost
const IS_LOCALHOST =
  typeof window !== "undefined" &&
  (window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1");

// 📧 Super-admin por correo (configurable por env)
const SUPERADMIN_EMAIL = String(import.meta.env.VITE_SUPERADMIN_EMAIL || "").toLowerCase();

// 🌐 Entorno (por convención tuya: VITE_ENV=production)
const VITE_ENV = String(import.meta.env.VITE_ENV || "").toLowerCase();
const IS_PROD = VITE_ENV === "production";

// 🔓 Skip IAM SOLO en localhost o flags explícitos
const SKIP_IAM =
  IS_LOCALHOST ||
  String(import.meta.env.VITE_SKIP_VERIFY || "") === "1" ||
  String(import.meta.env.VITE_DISABLE_AUTH || "") === "1" ||
  String(import.meta.env.VITE_FORCE_DEV_IAM || "") === "1";

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

/**
 * IamGuard
 * Props:
 * - requirePerm: string (p.ej. "iam.users.manage")
 * - anyOf: string | string[]   ✅ acepta roles o permisos
 * - allOf: string | string[]   ✅ acepta roles o permisos
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
  const { user, isAuthenticated, getAccessTokenSilently } = useAuth0();

  // En modo skip => admin + wildcard
  const [state, setState] = useState(
    SKIP_IAM
      ? { loading: false, roles: ["admin"], perms: ["*"] }
      : { loading: true, roles: [], perms: [] }
  );

  useEffect(() => {
    if (SKIP_IAM) return;

    let cancel = false;

    (async () => {
      try {
        // Si NO está autenticado, no intentamos /me (evita estado raro sin token)
        if (!isAuthenticated) {
          if (!cancel) setState({ loading: false, roles: [], perms: [] });
          return;
        }

        // Token Auth0 (obligatorio para prod)
        let token = null;
        try {
          token = await getAccessTokenSilently({
            authorizationParams: {
              audience: import.meta.env.VITE_AUTH0_AUDIENCE,
            },
          });
        } catch (e) {
          console.warn("[IamGuard] no se pudo obtener access token:", e?.message || e);
        }

        if (!token) {
          // En producción: sin token = sin permisos
          if (!cancel) setState({ loading: false, roles: [], perms: [] });
          return;
        }

        // Consulta al backend
        const me = await iamApi.me(token);

        // email desde IAM
        const emailFromMe = String(
          me?.email ||
            me?.user?.email ||
            me?.data?.email ||
            me?.profile?.email ||
            ""
        ).toLowerCase();

        // email desde Auth0
        const emailFromAuth0 = String(user?.email || "").toLowerCase();

        // roles/perms desde backend
        let roles =
          me?.roles || me?.user?.roles || me?.data?.roles || [];
        let perms =
          me?.perms ||
          me?.permissions ||
          me?.data?.perms ||
          me?.data?.permissions ||
          [];

        roles = normalizeRoles(roles);
        perms = normalizePerms(perms);

        // Superadmin por correo => wildcard
        const isSuperadmin =
          SUPERADMIN_EMAIL &&
          (emailFromMe === SUPERADMIN_EMAIL || emailFromAuth0 === SUPERADMIN_EMAIL);

        if (isSuperadmin) {
          roles = Array.from(new Set([...roles, "admin"]));
          perms = Array.from(new Set([...perms, "*"]));
        }

        if (!cancel) {
          setState({ loading: false, roles, perms });
        }
      } catch (e) {
        const emailFromAuth0 = String(user?.email || "").toLowerCase();
        const isSuperadmin = SUPERADMIN_EMAIL && emailFromAuth0 === SUPERADMIN_EMAIL;

        if (!cancel) {
          if (isSuperadmin) {
            setState({ loading: false, roles: ["admin"], perms: ["*"] });
          } else {
            setState({ loading: false, roles: [], perms: [] });
          }
        }

        if (!IS_PROD) {
          console.warn("[IamGuard] fallo /me:", e?.message || e);
        }
      }
    })();

    return () => {
      cancel = true;
    };
  }, [user, isAuthenticated, getAccessTokenSilently]);

  if (state.loading) return <div className="p-6">Cargando…</div>;

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

  return ok ? <>{children}</> : (fallback || <div className="p-6">No autorizado</div>);
}
