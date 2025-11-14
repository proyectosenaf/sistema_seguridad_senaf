// client/src/iam/api/IamGuard.jsx
import React, { useEffect, useState } from "react";
import { iamApi } from "../api/iamApi";

// 🌍 Detectar si estamos en localhost
const IS_LOCALHOST =
  typeof window !== "undefined" &&
  (window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1");

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
 * - anyOf: string | string[]
 * - allOf: string | string[]
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
  // 👇 Si estamos en modo "skip", arrancamos como admin con wildcard
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
        const me = await iamApi.me(); // usa /api/iam/v1/auth/me (con fallback)
        const roles =
          me?.roles ||
          me?.user?.roles ||
          me?.data?.roles ||
          [];
        const perms =
          me?.perms ||
          me?.permissions ||
          me?.data?.perms ||
          [];

        if (!cancel) setState({ loading: false, roles, perms });
      } catch (e) {
        if (!cancel) setState({ loading: false, roles: [], perms: [] });
      }
    })();
    return () => {
      cancel = true;
    };
  }, []);

  if (state.loading) return <div className="p-6">Cargando…</div>;

  // Sets normalizados
  const roleSet = new Set((state.roles || []).map((r) => String(r).toLowerCase()));
  const permSet = new Set(state.perms || []);

  // Wildcard si trae "*" o si el usuario es admin
  const hasWildcard = permSet.has("*") || roleSet.has("admin");

  // Normalizador de props
  const asArr = (v) => (Array.isArray(v) ? v : v ? [v] : []);

  // Checks
  const hasPerm = (p) => !!p && (hasWildcard || permSet.has(p));
  const hasAny = (arr) => {
    if (hasWildcard) return true;
    const A = asArr(arr);
    return A.some((k) => permSet.has(k));
  };
  const hasAll = (arr) => {
    if (hasWildcard) return true;
    const A = asArr(arr);
    return A.every((k) => permSet.has(k));
  };
  const hasRole = (r) => {
    const A = asArr(r).map((x) => String(x).toLowerCase());
    if (!A.length) return true;
    return A.some((x) => roleSet.has(x));
  };

  // Evaluación final
  let ok = true;
  if (requirePerm) ok = ok && hasPerm(requirePerm);
  if (asArr(anyOf).length) ok = ok && hasAny(anyOf);
  if (asArr(allOf).length) ok = ok && hasAll(allOf);
  if (requireRole) ok = ok && hasRole(requireRole);

  return ok ? <>{children}</> : (fallback || <div className="p-6">No autorizado</div>);
}
