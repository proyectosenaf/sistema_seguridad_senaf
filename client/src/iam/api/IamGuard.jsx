// client/src/iam/api/IamGuard.jsx
import React, { useEffect, useMemo, useState } from "react";

/**
 * IamGuard (post-refactor / centralizado):
 * - ✅ El backend decide roles/perms (incl. wildcard).
 * - ✅ El FRONTEND NO llama /me aquí. Debe recibir `me` desde App.jsx.
 * - ✅ Nunca "superadmin por email" en frontend.
 * - ✅ Nunca "skip verify" en PROD.
 *
 * USO:
 * <IamGuard me={me} meLoading={meLoading} requirePerm="iam.users.manage">...</IamGuard>
 */

const IS_LOCALHOST =
  typeof window !== "undefined" &&
  (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1");

// Entorno
const VITE_ENV = String(import.meta.env.VITE_ENV || "").toLowerCase();
const MODE = String(import.meta.env.MODE || "").toLowerCase();
const IS_PROD = VITE_ENV === "production" || MODE === "production";

/**
 * SKIP IAM (solo DEV/local)
 * - Nunca debe abrir accesos en producción.
 * - Si necesitas “bypass” en prod, que sea SOLO desde backend.
 */
const SKIP_IAM =
  !IS_PROD &&
  (IS_LOCALHOST ||
    String(import.meta.env.VITE_SKIP_VERIFY || "") === "1" ||
    String(import.meta.env.VITE_DISABLE_AUTH || "") === "1" ||
    String(import.meta.env.VITE_FORCE_DEV_IAM || "") === "1");

function asArr(v) {
  if (!v) return [];
  return Array.isArray(v) ? v : [v];
}

function normalizeTokens(v) {
  return asArr(v)
    .map((x) => String(x || "").trim())
    .filter(Boolean);
}

function pickEmailFromMe(me) {
  return String(me?.email || me?.user?.email || me?.data?.email || me?.profile?.email || "")
    .trim()
    .toLowerCase();
}

function pickRolesFromMe(me) {
  return me?.roles || me?.user?.roles || me?.data?.roles || me?.data?.user?.roles || [];
}

function pickPermsFromMe(me) {
  return (
    me?.permissions ||
    me?.perms ||
    me?.user?.permissions ||
    me?.user?.perms ||
    me?.data?.permissions ||
    me?.data?.perms ||
    []
  );
}

/**
 * Props:
 * - me: objeto /me ya resuelto (desde App.jsx)
 * - meLoading: boolean loading de /me (desde App.jsx)
 * - requirePerm: string (p.ej. "iam.users.manage")
 * - anyOf: string | string[]   ✅ acepta roles o permisos (compat)
 * - allOf: string | string[]   ✅ acepta roles o permisos (compat)
 * - requireRole: string | string[]
 * - fallback: ReactNode
 */
export default function IamGuard({
  me,
  meLoading,
  requirePerm,
  anyOf,
  allOf,
  requireRole,
  fallback = null,
  children,
}) {
  const [state, setState] = useState(() =>
    SKIP_IAM
      ? { loading: false, roles: ["admin"], perms: ["*"], email: "", visitor: false }
      : { loading: true, roles: [], perms: [], email: "", visitor: false }
  );

  // ✅ Fuente única: props me/meLoading (App.jsx)
  useEffect(() => {
    if (SKIP_IAM) return;

    if (meLoading) {
      setState((s) => ({ ...s, loading: true }));
      return;
    }

    if (me && typeof me === "object") {
      const roles = normalizeTokens(pickRolesFromMe(me));
      const perms = normalizeTokens(pickPermsFromMe(me));
      const email = pickEmailFromMe(me);
      const visitor = !!me?.visitor || !!me?.isVisitor;

      setState({ loading: false, roles, perms, email, visitor });
      return;
    }

    // ✅ Si App no mandó `me` (o falló /me), NO inventamos auth aquí.
    setState({ loading: false, roles: [], perms: [], email: "", visitor: false });
  }, [me, meLoading]);

  if (state.loading) return fallback || <div className="p-6">Cargando…</div>;

  const roleSet = useMemo(() => {
    return new Set((state.roles || []).map((r) => String(r).toLowerCase()));
  }, [state.roles]);

  const permSet = useMemo(() => {
    return new Set((state.perms || []).map((p) => String(p)));
  }, [state.perms]);

  const permSetLower = useMemo(() => {
    return new Set((state.perms || []).map((p) => String(p).toLowerCase()));
  }, [state.perms]);

  // Wildcard SOLO si backend lo envía (o si SKIP_IAM en dev)
  const hasWildcard =
    permSet.has("*") ||
    permSetLower.has("*") ||
    roleSet.has("admin") ||
    roleSet.has("administrador");

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

  // compat: el token puede ser permiso o rol (tu diseño actual)
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

  return ok ? <>{children}</> : fallback || <div className="p-6">No autorizado</div>;
}