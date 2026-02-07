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

// 🔓 Modo “sin restricciones” en localhost SIEMPRE.
// Además puedes seguir usando las envs si quieres forzar bypass en otros entornos.
const SKIP_IAM =
  IS_LOCALHOST ||
  String(import.meta.env.VITE_SKIP_VERIFY || "") === "1" ||
  String(import.meta.env.VITE_DISABLE_AUTH || "") === "1" ||
  String(import.meta.env.VITE_FORCE_DEV_IAM || "") === "1";

/**
 * IamGuard
 * Props:
 * - requirePerm: string (p.ej. "iam.users.manage")
 * - anyOf: string | string[]   ✅ ahora acepta roles O permisos
 * - allOf: string | string[]   ✅ ahora acepta roles O permisos
 * - requireRole: string | string[]
 * - fallback: ReactNode (opcional) -> contenido si NO autorizado
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

  // 👇 Estado base: si estamos en modo "skip", arrancamos como admin con wildcard
  const [state, setState] = useState(
    SKIP_IAM
      ? { loading: false, roles: ["admin"], perms: ["*"] }
      : { loading: true, roles: [], perms: [] }
  );

  useEffect(() => {
    // En localhost con bypass → no llamamos al backend
    if (SKIP_IAM) return;

    let cancel = false;

    (async () => {
      try {
        let token = null;

        try {
          if (isAuthenticated) {
            token = await getAccessTokenSilently({
              authorizationParams: {
                audience: import.meta.env.VITE_AUTH0_AUDIENCE,
              },
            });
          }
        } catch (e) {
          console.warn(
            "[IamGuard] no se pudo obtener access token para /iam/v1/me:",
            e?.message || e
          );
        }

        const me = await iamApi.me(token);

        // ----- email que viene del microservicio IAM -----
        const emailFromMe = String(
          me?.email ||
            me?.user?.email ||
            me?.data?.email ||
            me?.profile?.email ||
            ""
        ).toLowerCase();

        // ----- email desde Auth0 (fallback) -----
        const emailFromAuth0 = String(user?.email || "").toLowerCase();

        // ----- roles / permisos básicos que vengan del backend -----
        let roles =
          me?.roles || me?.user?.roles || me?.data?.roles || [];
        let perms =
          me?.perms ||
          me?.permissions ||
          me?.data?.perms ||
          me?.data?.permissions ||
          [];

        // ⭐ Superadmin por correo → wildcard
        const isSuperadmin =
          SUPERADMIN_EMAIL &&
          (emailFromMe === SUPERADMIN_EMAIL || emailFromAuth0 === SUPERADMIN_EMAIL);

        if (isSuperadmin) {
          roles = Array.from(new Set([...(roles || []), "admin"]));
          perms = Array.from(new Set([...(perms || []), "*"]));
        }

        if (!cancel) {
          setState({ loading: false, roles, perms });
        }
      } catch (e) {
        // Si IAM falla PERO el usuario de Auth0 es el super-admin,
        // igual le damos admin + wildcard para no dejarlo "No autorizado".
        const emailFromAuth0 = String(user?.email || "").toLowerCase();
        const isSuperadmin = SUPERADMIN_EMAIL && emailFromAuth0 === SUPERADMIN_EMAIL;

        if (!cancel) {
          if (isSuperadmin) {
            setState({ loading: false, roles: ["admin"], perms: ["*"] });
          } else {
            setState({ loading: false, roles: [], perms: [] });
          }
        }
      }
    })();

    return () => {
      cancel = true;
    };
  }, [user, isAuthenticated, getAccessTokenSilently]);

  if (state.loading) return <div className="p-6">Cargando…</div>;

  // Normalizadores
  const asArr = (v) => (Array.isArray(v) ? v : v ? [v] : []);

  // Sets normalizados
  const roleSet = new Set((state.roles || []).map((r) => String(r).toLowerCase()));
  const permSet = new Set((state.perms || []).map((p) => String(p))); // permisos suelen ser case-sensitive
  const permSetLower = new Set((state.perms || []).map((p) => String(p).toLowerCase()));

  // Wildcard si trae "*" o si el usuario es admin
  const hasWildcard = permSet.has("*") || permSetLower.has("*") || roleSet.has("admin");

  // Checks
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

  /**
   * ✅ FIX CLAVE:
   * anyOf/allOf ahora aceptan tokens que pueden ser:
   * - permisos (iam.users.manage, rondasqr.view, etc.)
   * - roles (guardia, recepcion, ti, admin, etc.)
   * Se valida contra ambos sets.
   */
  const tokenMatches = (k) => {
    if (!k) return false;
    if (hasWildcard) return true;

    const raw = String(k);
    const low = raw.toLowerCase();

    // match por permiso o por rol
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
