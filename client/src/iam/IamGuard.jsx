// client/src/iam/IamGuard.jsx
import React, { useEffect, useState } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import { iamApi } from "./iamApi";

/**
 * IamGuard: protege por permisos/roles con soporte Auth0 y fallback DEV.
 */
export default function IamGuard({
  requirePerm,
  anyOf,
  allOf,
  requireRole,
  fallback = <div className="p-6">No autorizado</div>,
  children,
}) {
  const [me, setMe] = useState({ roles: [], perms: [] });
  const [loading, setLoading] = useState(true);
  const { getAccessTokenSilently, isAuthenticated } = useAuth0();

  // 🔓 By-pass de emergencia (solo DEV): si está en 1, deja pasar siempre
  const FORCE_ALLOW = import.meta.env.VITE_IAM_ALLOW_ALL === "1";
  if (FORCE_ALLOW) return <>{children}</>;

  useEffect(() => {
    let cancel = false;
    (async () => {
      setLoading(true);
      try {
        // Usa token de Auth0 si hay sesión; si no, iamApi usará headers DEV
        let token;
        try {
          token = isAuthenticated ? await getAccessTokenSilently() : undefined;
        } catch {
          token = undefined;
        }

        const data = await iamApi.me(token);
        if (cancel) return;

        // 🔎 Debug en consola para ver qué llega desde /me
        // (quita esto cuando esté estable)
        // eslint-disable-next-line no-console
        console.log("[IAM] /me →", data);

        const roles = Array.isArray(data?.roles) ? data.roles : (data?.user?.roles || []);
        const perms = Array.isArray(data?.permissions) ? data.permissions : (data?.perms || []);
        setMe({ roles: roles || [], perms: perms || [] });
      } catch {
        if (!cancel) setMe({ roles: [], perms: [] });
      } finally {
        if (!cancel) setLoading(false);
      }
    })();
    return () => { cancel = true; };
  }, [getAccessTokenSilently, isAuthenticated]);

  if (loading) return <div className="p-6">Cargando…</div>;

  // Normalización
  const roleSet = new Set(me.roles || []);
  const roleSetLower = new Set((me.roles || []).map((r) => String(r).toLowerCase()));
  const permSet = new Set(me.perms || []);

  // Wildcard por "*" o rol admin/ADMIN (case-insensitive)
  const hasWildcard = permSet.has("*") || roleSetLower.has("admin");

  const hasPerm = (p) => !!p && (hasWildcard || permSet.has(p));
  const hasAny  = (arr = []) => hasWildcard || arr.some((p) => permSet.has(p));
  const hasAll  = (arr = []) => hasWildcard || arr.every((p) => permSet.has(p));

  const hasRole = (r) => {
    if (!r) return true;
    if (Array.isArray(r)) {
      return r.some((x) => roleSet.has(x) || roleSetLower.has(String(x).toLowerCase()));
    }
    return roleSet.has(r) || roleSetLower.has(String(r).toLowerCase());
  };

  let allowed = true;
  if (requirePerm)   allowed = allowed && hasPerm(requirePerm);
  if (anyOf?.length) allowed = allowed && hasAny(anyOf);
  if (allOf?.length) allowed = allowed && hasAll(allOf);
  if (requireRole)   allowed = allowed && hasRole(requireRole);

  return allowed ? <>{children}</> : fallback;
}
