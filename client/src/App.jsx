// client/src/App.jsx
import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Routes, Route, Navigate, useNavigate, useLocation } from "react-router-dom";

// ✅ auth local
import { useAuth } from "./pages/auth/AuthProvider.jsx";

// Layout
import Layout from "./components/Layout.jsx";

// ✅ Un solo cliente HTTP + token canónico
import api, { getToken, clearToken } from "./lib/api.js";

// ✅ Config central
import { APP_CONFIG } from "./config/app.config.js";

// Login local
import LoginLocal from "./pages/auth/LoginLocal.jsx";

// ✅ Pantalla para forzar cambio de contraseña
const ForceChangePassword = React.lazy(() => import("./pages/ForceChangePassword.jsx"));

// ✅ OTP
const VerifyOtp = React.lazy(() => import("./pages/auth/VerifyOtp.jsx"));

// ---- Páginas (lazy)
const IamAdminPage = React.lazy(() => import("./iam/pages/IamAdmin/index.jsx"));
const Home = React.lazy(() => import("./pages/Home/Home.jsx"));

const IncidentesList = React.lazy(() => import("./pages/Incidentes/IncidentesList.jsx"));
const IncidenteForm = React.lazy(() => import("./pages/Incidentes/IncidenteForm.jsx"));

// Rondas QR
const RondasDashboard = React.lazy(() => import("./modules/rondasqr/supervisor/ReportsPage.jsx"));
const RondasScan = React.lazy(() => import("./modules/rondasqr/guard/ScanPage.jsx"));
const AdminHub = React.lazy(() => import("./modules/rondasqr/admin/AdminHub.jsx"));

// Otros módulos
const Accesos = React.lazy(() => import("./pages/Accesos/Accesos.jsx"));
const Bitacora = React.lazy(() => import("./pages/Bitacora/Bitacora.jsx"));
const Supervision = React.lazy(() => import("./pages/Supervision/Supervision.jsx"));
const Chat = React.lazy(() => import("./pages/Chat/Chat.jsx"));

// Visitas
const VisitsPageCore = React.lazy(() => import("./modules/visitas/pages/VisitsPage.jsx"));
const AgendaPageCore = React.lazy(() => import("./modules/visitas/pages/AgendaPage.jsx"));

/* ───────────────── ENV helpers ───────────────── */
const VITE_ENV = String(import.meta.env.VITE_ENV || "").toLowerCase();
const MODE = String(import.meta.env.MODE || "").toLowerCase();
const IS_PROD = VITE_ENV === "production" || MODE === "production";

/* ───────────────── Helpers de rutas parametrizadas ───────────────── */

function normalizePath(p) {
  const s = String(p || "/").trim();
  if (!s) return "/";
  if (!s.startsWith("/")) return `/${s}`;
  return s;
}

function startsWithPath(pathname, base) {
  const p = normalizePath(pathname);
  const b = normalizePath(base);
  if (b === "/") return p === "/";
  return p === b || p.startsWith(b + "/");
}

function isPublicPath(pathname) {
  const p = normalizePath(pathname);
  const login = normalizePath(APP_CONFIG?.routes?.login || "/login");
  if (startsWithPath(p, login)) return true;

  // públicas mínimas para flujo
  if (startsWithPath(p, "/otp")) return true;
  if (startsWithPath(p, "/force-change-password")) return true;

  const allow = Array.isArray(APP_CONFIG?.routes?.publicAllowlist)
    ? APP_CONFIG.routes.publicAllowlist
    : [];
  return allow.some((x) => startsWithPath(p, x));
}

/* ───────────────── Visitor hint (anti-flash al refrescar) ───────────────── */
const VISITOR_HINT_KEY = "senaf_is_visitor";
function readVisitorHint() {
  try {
    return localStorage.getItem(VISITOR_HINT_KEY) === "1";
  } catch {
    return false;
  }
}

/* ───────────────── Session bootstrap: 1 sola llamada /me ───────────────── */
function useMeSession(currentPathname) {
  const [me, setMe] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await api.get("/iam/v1/me", {
        headers: {
          "Cache-Control": "no-store, no-cache",
          Pragma: "no-cache",
        },
      });

      // backend puede devolver { ok, me } o directamente el objeto
      const payload = res?.data || null;
      const normalized = payload?.me || payload?.user || payload;

      setMe(normalized || null);
      return normalized || null;
    } catch (e) {
      setMe(null);
      setError(e);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let alive = true;

    (async () => {
      const hardToken = getToken() || "";

      // ✅ si estoy en ruta pública Y no hay token, no llamo /me
      if (isPublicPath(currentPathname) && !hardToken) {
        if (!alive) return;
        setMe(null);
        setError(null);
        setLoading(false);
        return;
      }

      if (!alive) return;
      await refresh();
    })();

    return () => {
      alive = false;
    };
  }, [refresh, currentPathname]);

  return { me, loading, error, refresh };
}

/* ───────────────── HOME PICKER ───────────────── */
function pickHomeFromMe(me) {
  const def = me?.defaultRoute || me?.home || me?.redirectTo;
  if (def) return String(def);

  const roles = me?.roles || me?.user?.roles || [];
  const perms = me?.permissions || me?.perms || [];
  const visitor = !!me?.visitor || !!me?.isVisitor;

  const R = new Set((roles || []).map((r) => String(r).toLowerCase()));
  const Praw = Array.isArray(perms) ? perms : [];
  const P = new Set(Praw.map((p) => String(p)));
  const Plow = new Set(Praw.map((p) => String(p).toLowerCase()));
  const hasWildcard = P.has("*") || Plow.has("*") || R.has("admin") || R.has("administrador");

  if (visitor || (!R.size && !Praw.length)) return "/visitas/agenda";
  if (hasWildcard || R.has("ti") || R.has("administrador_it")) return "/iam/admin";
  if (R.has("guardia")) return "/rondasqr/scan";
  if (R.has("supervisor")) return "/rondasqr/reports";
  if (R.has("recepcion")) return "/visitas/control";
  return "/";
}

/* ───────────────── visitor helpers ───────────────── */
function isVisitorMe(me) {
  const roles = me?.roles || me?.user?.roles || [];
  const visitor = !!me?.visitor || !!me?.isVisitor;
  const R = new Set((roles || []).map((r) => String(r).toLowerCase()));
  return visitor || R.has("visita") || R.has("visitor");
}

/**
 * ✅ AppShell:
 * - Visitante => NO Layout
 * - Sin me (todavía cargando / aún no llegó) => NO Layout (deny-by-default visual)
 * - Interno => Layout
 */
function AppShell({ me, meLoading, children }) {
  if (meLoading) return <>{children}</>;
  if (!me) return <>{children}</>;
  if (isVisitorMe(me)) return <>{children}</>;
  return <Layout>{children}</Layout>;
}

/* ───────────────── Evaluador local de reglas ───────────────── */
function asArr(v) {
  if (!v) return [];
  return Array.isArray(v) ? v : [v];
}

function canAccess(me, rules) {
  if (!rules) return true;

  // superadmin hard-pass si backend lo manda
  if (me?.superadmin === true) return true;

  const roles = me?.roles || me?.user?.roles || [];
  const perms = me?.permissions || me?.perms || [];

  const roleSet = new Set((roles || []).map((r) => String(r).toLowerCase()));
  const permSet = new Set((perms || []).map((p) => String(p)));
  const permSetLower = new Set((perms || []).map((p) => String(p).toLowerCase()));

  const hasWildcard = permSet.has("*") || permSetLower.has("*") || roleSet.has("admin");

  const tokenMatches = (k) => {
    if (!k) return false;
    if (hasWildcard) return true;
    const raw = String(k);
    const low = raw.toLowerCase();
    return permSet.has(raw) || permSetLower.has(low) || roleSet.has(low);
  };

  const hasPerm = (p) => (!p ? true : tokenMatches(p));

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

  let ok = true;
  if (rules.requirePerm) ok = ok && hasPerm(rules.requirePerm);
  if (asArr(rules.anyOf).length) ok = ok && hasAny(rules.anyOf);
  if (asArr(rules.allOf).length) ok = ok && hasAll(rules.allOf);

  return ok;
}

/* ───────────────── ProtectedRoute ───────────────── */
function ProtectedRoute({ children }) {
  const { isAuthenticated, isLoading, token } = useAuth();
  const loc = useLocation();

  const loginRoute = normalizePath(APP_CONFIG?.routes?.login || "/login");
  const hardToken = token || getToken() || "";

  if (isLoading) return <div className="p-6">Cargando…</div>;

  if (!isAuthenticated && !hardToken) {
    return <Navigate to={loginRoute} replace state={{ from: loc.pathname }} />;
  }

  return <>{children}</>;
}

/**
 * ✅ SessionGate (CRÍTICO):
 * - Evita que, al refrescar, se rendericen módulos protegidos con me=null.
 * - Si es visitante (hint), permite SOLO /visitas/** mientras carga /me.
 */
function SessionGate({ me, meLoading, children }) {
  const location = useLocation();
  const path = location?.pathname || "/";
  const hardToken = getToken() || "";

  // Si no hay token, no bloqueamos aquí (ProtectedRoute lo maneja)
  if (!hardToken) return <>{children}</>;

  // Si está cargando /me: solo deja pasar visitas si hint visitante
  if (meLoading) {
    const hintVisitor = readVisitorHint();
    if (hintVisitor && startsWithPath(path, "/visitas")) return <>{children}</>;
    return <div className="p-6">Cargando sesión…</div>;
  }

  // Si ya terminó de cargar, pero no hay me: bloquear por seguridad
  if (!me) {
    const hintVisitor = readVisitorHint();
    if (hintVisitor && startsWithPath(path, "/visitas")) return <>{children}</>;
    return <div className="p-6">Cargando sesión…</div>;
  }

  return <>{children}</>;
}

/* ───────────────── Guard por ruta usando routeRules ───────────────── */
function RouteAccess({ me, meLoading, routeKey, children }) {
  // ✅ deny-by-default total mientras no haya me listo (evita “se destapa”)
  if (meLoading) return <div className="p-6">Cargando…</div>;
  if (!me) return <div className="p-6">Cargando sesión…</div>;

  // deny-by-default en visitante: si no es ruta de visitas, bloquea
  if (isVisitorMe(me)) {
    const allowed = String(routeKey || "").startsWith("visitas");
    if (!allowed) return <div className="p-6">No autorizado</div>;
  }

  const rules = me?.routeRules?.[routeKey] || null;

  // transición: si backend aún no manda reglas, NO bloqueamos aquí (para NO visitantes)
  if (!rules) return <>{children}</>;

  const ok = canAccess(me, rules);
  return ok ? <>{children}</> : <div className="p-6">No autorizado</div>;
}

/* ───────────────── Redirección tras login ───────────────── */
function RoleRedirectInline({ me, meLoading, refresh }) {
  const navigate = useNavigate();
  const { isAuthenticated, isLoading, token } = useAuth();
  const ranRef = useRef(false);

  useEffect(() => {
    let alive = true;
    if (ranRef.current) return;

    (async () => {
      if (isLoading) return;

      ranRef.current = true;

      const hasToken = !!(token || getToken());
      let currentMe = me;

      if ((isAuthenticated || hasToken) && !currentMe && !meLoading) {
        currentMe = await refresh();
      }

      const dest = pickHomeFromMe(currentMe);
      if (alive) navigate(dest || "/visitas/agenda", { replace: true });
    })();

    return () => {
      alive = false;
    };
  }, [navigate, isAuthenticated, isLoading, token, me, meLoading, refresh]);

  return <div className="p-6">Redirigiendo…</div>;
}

/* ───────────────── Bloqueo duro en PROD ───────────────── */
function AuthTokenBridge({ children }) {
  const { isAuthenticated, isLoading, token } = useAuth();
  const location = useLocation();

  const path = location?.pathname || "/";
  const hardToken = token || getToken() || "";

  const loginRoute = normalizePath(APP_CONFIG?.routes?.login || "/login");
  const isPublicRoute = isPublicPath(path);

  if (IS_PROD && !isLoading && !isAuthenticated && !hardToken && !isPublicRoute) {
    return (
      <div className="p-6">
        Debes iniciar sesión para acceder al sistema.
        <div className="mt-3">
          <a className="underline" href={loginRoute}>
            Ir al inicio de sesión
          </a>
        </div>
      </div>
    );
  }

  return children;
}

export default function App() {
  const navigate = useNavigate();
  const location = useLocation();

  const currentPath = location?.pathname || "/";

  // ✅ ÚNICO lugar donde se llama /me
  const { me, loading: meLoading, error: meError, refresh } = useMeSession(currentPath);

  const loginRoute = normalizePath(APP_CONFIG?.routes?.login || "/login");

  // ✅ Force login on boot (SIN romper sesión en prod)
  const bootRef = useRef(false);
  useEffect(() => {
    if (!APP_CONFIG?.auth?.forceLoginOnBoot) return;
    if (bootRef.current) return;
    bootRef.current = true;

    const path = location?.pathname || "/";
    if (isPublicPath(path)) return;

    const hardToken = getToken() || "";

    // ✅ NO limpies token si ya existe
    if (!hardToken && APP_CONFIG?.auth?.clearTokenOnBoot) {
      clearToken();
    }

    // si ya hay token, NO fuerces login
    if (hardToken) return;

    navigate(loginRoute, {
      replace: true,
      state: { from: path + (location?.search || "") },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ✅ Bloqueo duro para VISITA (solo /visitas/**) cuando YA existe me
  useEffect(() => {
    if (meLoading) return;
    if (!me) return;
    if (!isVisitorMe(me)) return;

    const path = location?.pathname || "/";

    const allowBases = [
      "/visitas",
      "/visitas/control",
      "/visitas/agenda",
      "/otp",
      "/force-change-password",
      loginRoute,
    ];

    const ok = allowBases.some((base) => startsWithPath(path, base));
    if (!ok) {
      navigate("/visitas/agenda", { replace: true });
    }
  }, [me, meLoading, location?.pathname, loginRoute, navigate]);

  return (
    <AuthTokenBridge>
      <Suspense fallback={<div className="p-6">Cargando…</div>}>
        <Routes>
          {/* Login */}
          <Route path={loginRoute} element={<LoginLocal />} />

          {/* Legacy Auth0 routes */}
          <Route path="/entry" element={<Navigate to={loginRoute} replace />} />
          <Route path="/callback" element={<Navigate to={loginRoute} replace />} />

          {/* OTP */}
          <Route path="/otp" element={<VerifyOtp />} />

          {/* primer login / password vencida */}
          <Route path="/force-change-password" element={<ForceChangePassword />} />

          {/* Home */}
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <SessionGate me={me} meLoading={meLoading}>
                  <AppShell me={me} meLoading={meLoading}>
                    <Home />
                  </AppShell>
                </SessionGate>
              </ProtectedRoute>
            }
          />

          {/* Start */}
          <Route
            path="/start"
            element={
              <ProtectedRoute>
                <SessionGate me={me} meLoading={meLoading}>
                  <AppShell me={me} meLoading={meLoading}>
                    <RoleRedirectInline me={me} meLoading={meLoading} refresh={refresh} />
                    {meError && !IS_PROD ? (
                      <div className="p-3 text-sm text-red-600">
                        /me error: {String(meError?.message || meError)}
                      </div>
                    ) : null}
                  </AppShell>
                </SessionGate>
              </ProtectedRoute>
            }
          />

          {/* Incidentes */}
          <Route
            path="/incidentes"
            element={
              <ProtectedRoute>
                <SessionGate me={me} meLoading={meLoading}>
                  <AppShell me={me} meLoading={meLoading}>
                    <RouteAccess me={me} meLoading={meLoading} routeKey="incidentes">
                      <IncidentesList />
                    </RouteAccess>
                  </AppShell>
                </SessionGate>
              </ProtectedRoute>
            }
          />
          <Route
            path="/incidentes/lista"
            element={
              <ProtectedRoute>
                <SessionGate me={me} meLoading={meLoading}>
                  <AppShell me={me} meLoading={meLoading}>
                    <RouteAccess me={me} meLoading={meLoading} routeKey="incidentes">
                      <IncidentesList />
                    </RouteAccess>
                  </AppShell>
                </SessionGate>
              </ProtectedRoute>
            }
          />
          <Route
            path="/incidentes/nuevo"
            element={
              <ProtectedRoute>
                <SessionGate me={me} meLoading={meLoading}>
                  <AppShell me={me} meLoading={meLoading}>
                    <RouteAccess me={me} meLoading={meLoading} routeKey="incidentes.create">
                      <IncidenteForm />
                    </RouteAccess>
                  </AppShell>
                </SessionGate>
              </ProtectedRoute>
            }
          />

          {/* IAM */}
          <Route
            path="/iam"
            element={
              <ProtectedRoute>
                <Navigate to="/iam/admin" replace />
              </ProtectedRoute>
            }
          />
          <Route
            path="/iam/admin"
            element={
              <ProtectedRoute>
                <SessionGate me={me} meLoading={meLoading}>
                  <AppShell me={me} meLoading={meLoading}>
                    <RouteAccess me={me} meLoading={meLoading} routeKey="iam.admin">
                      <IamAdminPage me={me} meLoading={meLoading} />
                    </RouteAccess>
                  </AppShell>
                </SessionGate>
              </ProtectedRoute>
            }
          />

          {/* RondasQR */}
          <Route
            path="/rondasqr"
            element={
              <ProtectedRoute>
                <Navigate to="/rondasqr/scan" replace />
              </ProtectedRoute>
            }
          />
          <Route
            path="/rondasqr/scan/*"
            element={
              <ProtectedRoute>
                <SessionGate me={me} meLoading={meLoading}>
                  <AppShell me={me} meLoading={meLoading}>
                    <RouteAccess me={me} meLoading={meLoading} routeKey="rondasqr.scan">
                      <RondasScan />
                    </RouteAccess>
                  </AppShell>
                </SessionGate>
              </ProtectedRoute>
            }
          />
          <Route
            path="/rondasqr/reports"
            element={
              <ProtectedRoute>
                <SessionGate me={me} meLoading={meLoading}>
                  <AppShell me={me} meLoading={meLoading}>
                    <RouteAccess me={me} meLoading={meLoading} routeKey="rondasqr.reports">
                      <RondasDashboard />
                    </RouteAccess>
                  </AppShell>
                </SessionGate>
              </ProtectedRoute>
            }
          />
          <Route
            path="/rondasqr/admin"
            element={
              <ProtectedRoute>
                <SessionGate me={me} meLoading={meLoading}>
                  <AppShell me={me} meLoading={meLoading}>
                    <RouteAccess me={me} meLoading={meLoading} routeKey="rondasqr.admin">
                      <AdminHub />
                    </RouteAccess>
                  </AppShell>
                </SessionGate>
              </ProtectedRoute>
            }
          />

          {/* Aliases legacy */}
          <Route path="/rondas" element={<Navigate to="/rondasqr/scan" replace />} />
          <Route path="/rondas/admin" element={<Navigate to="/rondasqr/admin" replace />} />
          <Route path="/rondas/scan" element={<Navigate to="/rondasqr/scan" replace />} />
          <Route path="/rondas/reports" element={<Navigate to="/rondasqr/reports" replace />} />

          {/* Otros módulos */}
          <Route
            path="/accesos"
            element={
              <ProtectedRoute>
                <SessionGate me={me} meLoading={meLoading}>
                  <AppShell me={me} meLoading={meLoading}>
                    <RouteAccess me={me} meLoading={meLoading} routeKey="accesos">
                      <Accesos />
                    </RouteAccess>
                  </AppShell>
                </SessionGate>
              </ProtectedRoute>
            }
          />

          {/* ✅ VISITAS */}
          <Route
            path="/visitas"
            element={
              <ProtectedRoute>
                <SessionGate me={me} meLoading={meLoading}>
                  <AppShell me={me} meLoading={meLoading}>
                    <RouteAccess me={me} meLoading={meLoading} routeKey="visitas.control">
                      <VisitsPageCore />
                    </RouteAccess>
                  </AppShell>
                </SessionGate>
              </ProtectedRoute>
            }
          />
          <Route
            path="/visitas/control"
            element={
              <ProtectedRoute>
                <SessionGate me={me} meLoading={meLoading}>
                  <AppShell me={me} meLoading={meLoading}>
                    <RouteAccess me={me} meLoading={meLoading} routeKey="visitas.control">
                      <VisitsPageCore />
                    </RouteAccess>
                  </AppShell>
                </SessionGate>
              </ProtectedRoute>
            }
          />
          <Route
            path="/visitas/agenda"
            element={
              <ProtectedRoute>
                <SessionGate me={me} meLoading={meLoading}>
                  <AppShell me={me} meLoading={meLoading}>
                    <AgendaPageCore />
                  </AppShell>
                </SessionGate>
              </ProtectedRoute>
            }
          />

          <Route
            path="/bitacora"
            element={
              <ProtectedRoute>
                <SessionGate me={me} meLoading={meLoading}>
                  <AppShell me={me} meLoading={meLoading}>
                    <RouteAccess me={me} meLoading={meLoading} routeKey="bitacora">
                      <Bitacora />
                    </RouteAccess>
                  </AppShell>
                </SessionGate>
              </ProtectedRoute>
            }
          />

          <Route
            path="/supervision"
            element={
              <ProtectedRoute>
                <SessionGate me={me} meLoading={meLoading}>
                  <AppShell me={me} meLoading={meLoading}>
                    <RouteAccess me={me} meLoading={meLoading} routeKey="supervision">
                      <Supervision />
                    </RouteAccess>
                  </AppShell>
                </SessionGate>
              </ProtectedRoute>
            }
          />

          <Route
            path="/chat"
            element={
              <ProtectedRoute>
                <SessionGate me={me} meLoading={meLoading}>
                  <AppShell me={me} meLoading={meLoading}>
                    <Chat />
                  </AppShell>
                </SessionGate>
              </ProtectedRoute>
            }
          />

          <Route path="*" element={<div className="p-6">No encontrado</div>} />
        </Routes>
      </Suspense>
    </AuthTokenBridge>
  );
}