import React, { useEffect, useState } from "react";
import { iamApi } from "./iamApi";

/**
 * IamGuard
 * - Consulta /me a través de iamApi (que ya maneja DEV/LEGACY y headers opcionales).
 * - Evalúa permisos/roles requeridos y muestra children o fallback.
 *
 * Props:
 *  - requirePerm: string            → necesita ese permiso
 *  - anyOf: string[]               → necesita alguno de esos permisos
 *  - allOf: string[]               → necesita todos esos permisos
 *  - requireRole: string|string[]  → necesita ese rol (o uno de esos)
 *  - fallback: ReactNode           → UI si no autorizado
 */
export default function IamGuard({
  requirePerm,
  anyOf,
  allOf,
  requireRole,
  fallback = <div className="p-6">No autorizado</div>,
  children,
}) {
  const [me, setMe] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancel = false;

    (async () => {
      try {
        const data = await iamApi.me();
        if (!cancel) {
          const roles = data?.roles || data?.user?.roles || [];
          const perms = data?.permissions || data?.perms || [];
          setMe({ roles, perms });
        }
      } catch {
        if (!cancel) setMe({ roles: [], perms: [] });
      } finally {
        if (!cancel) setLoading(false);
      }
    })();

    return () => {
      cancel = true;
    };
  }, []);

  if (loading) return <div className="p-6">Cargando…</div>;

  const roleSet = new Set(me?.roles || []);
  const permSet = new Set(me?.perms || []);
  const hasWildcard = permSet.has("*") || roleSet.has("admin");

  const hasPerm = (p) => !!p && (hasWildcard || permSet.has(p));
  const hasAny = (arr = []) => hasWildcard || arr.some((p) => permSet.has(p));
  const hasAll = (arr = []) => hasWildcard || arr.every((p) => permSet.has(p));
  const hasRole = (r) =>
    Array.isArray(r) ? r.some((x) => roleSet.has(x)) : (r ? roleSet.has(r) : true);

  let allowed = true;
  if (requirePerm) allowed = allowed && hasPerm(requirePerm);
  if (anyOf?.length) allowed = allowed && hasAny(anyOf);
  if (allOf?.length) allowed = allowed && hasAll(allOf);
  if (requireRole) allowed = allowed && hasRole(requireRole);

  return allowed ? <>{children}</> : fallback;
}
