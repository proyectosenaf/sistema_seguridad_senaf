// client/src/iam/api/IamGuard.jsx
import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../../pages/auth/AuthProvider.jsx";
import { APP_CONFIG } from "../../config/app.config.js";

/**
 * IamGuard (sin hardcode de permisos)
 *
 * Reglas:
 * - Loading auth o meLoading => fallback
 * - Sin sesión => redirect SOLO a login
 * - Con sesión:
 *    - Si viene `me.navSections` (o variantes) y se pasa `sectionKey`,
 *      permite solo si esa sección está incluida.
 *    - Si NO viene `me.navSections` y pasaste `sectionKey` => DENY BY DEFAULT
 *    - Si NO pasas `sectionKey` => no bloquea (solo gate opcional)
 *
 * Uso recomendado:
 * <IamGuard me={me} meLoading={meLoading} sectionKey="iam" fallback={...}>
 *   ...
 * </IamGuard>
 */
function normalizeSectionList(me) {
  const list =
    me?.navSections ??
    me?.sections ??
    me?.ui?.navSections ??
    me?.ui?.sections ??
    null;

  return Array.isArray(list) ? list.map(String).filter(Boolean) : null;
}

export default function IamGuard({
  me,
  meLoading,
  sectionKey, // ✅ clave UI: "iam", "rondas", "incidentes", etc (NO permisos)
  fallback = <div className="p-6">Cargando…</div>,
  unauthorized = <div className="p-6">No autorizado</div>,
  children,
}) {
  const loc = useLocation();
  const { isAuthenticated, isLoading } = useAuth();

  const loginRoute = String(APP_CONFIG?.routes?.login || "/login").trim() || "/login";

  // 1) Loading global (auth o /me)
  if (isLoading || meLoading) return fallback;

  // 2) Sin sesión => solo login
  if (!isAuthenticated) {
    return <Navigate to={loginRoute} replace state={{ from: loc.pathname }} />;
  }

  // 3) Sesión pero `me` aún no está
  if (!me) return fallback;

  // 4) Gate por sección (si aplica)
  if (sectionKey) {
    const sections = normalizeSectionList(me);

    // ✅ Sin lista => deny-by-default si pediste gate
    if (!sections) return unauthorized;

    const allowed = sections.includes(String(sectionKey));
    return allowed ? <>{children}</> : unauthorized;
  }

  // 5) Sin sectionKey => no bloqueamos
  return <>{children}</>;
}