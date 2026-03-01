// client/src/App.jsx
import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Routes, Route, Navigate, useNavigate, useLocation } from "react-router-dom";

// ✅ auth local
import { useAuth } from "./pages/auth/AuthProvider.jsx";

import Layout from "./components/Layout.jsx";

// ✅ Un solo cliente HTTP + token canónico
import api, { getToken, clearToken } from "./lib/api.js";

// ✅ Config central (sin rutas quemadas)
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

  // ✅ NUEVO: permitir OTP y reset como públicas (para no romper el flujo)
  if (startsWithPath(p, "/otp")) return true;
  if (startsWithPath(p, "/force-change-password")) return true;

  const allow = Array.isArray(APP_CONFIG?.routes?.publicAllowlist)
    ? APP_CONFIG.routes.publicAllowlist
    : [];
  return allow.some((x) => startsWithPath(p, x));
}

/* ───────────────── Session bootstrap: 1 sola llamada /me ───────────────── */
function useMeSession() {
  const [me, setMe] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // ✅ Un solo cliente HTTP (axios) y token ya lo adjunta interceptor si existe
      const res = await api.get("/iam/v1/me", {
        headers: {
          "Cache-Control": "no-store, no-cache",
          Pragma: "no-cache",
        },
      });

      const payload = res?.data || null;
      setMe(payload);
      return payload;
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
      if (!alive) return;
      await refresh();
    })();
    return () => {
      alive = false;
    };
  }, [refresh]);

  // ✅ token canónico
  const token = useMemo(() => getToken() || "", [me]);

  return { me, loading, error, refresh, token };
}

/* ───────────────── HOME PICKER (preferir backend) ───────────────── */
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

  // ⚠️ estos destinos “default” son fallback, pero NO dependen de login route
  if (visitor || (!R.size && !Praw.length)) return "/visitas/agenda";
  if (hasWildcard || R.has("ti") || R.has("administrador_it")) return "/iam/admin";
  if (R.has("guardia")) return "/rondasqr/scan";
  if (R.has("supervisor")) return "/rondasqr/reports";
  if (R.has("recepcion")) return "/visitas/control";
  return "/";
}

/* ───────────────── NUEVO: visitor helpers ───────────────── */
function isVisitorMe(me) {
  const roles = me?.roles || me?.user?.roles || [];
  const visitor = !!me?.visitor || !!me?.isVisitor;
  const R = new Set((roles || []).map((r) => String(r).toLowerCase()));
  return visitor || R.has("visita") || R.has("visitor");
}

function AppShell({ me, children }) {
  if (isVisitorMe(me)) return <>{children}</>;
  return <Layout>{children}</Layout>;
}

/* ───────────────── Evaluador local de reglas (SIN llamar /me otra vez) ───────────────── */
function asArr(v) {
  if (!v) return [];
  return Array.isArray(v) ? v : [v];
}

function canAccess(me, rules) {
  if (!rules) return true;

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

/* ───────────────── ProtectedRoute (local) ───────────────── */
function ProtectedRoute({ children }) {
  const { isAuthenticated, isLoading, token } = useAuth();
  const loc = useLocation();

  const loginRoute = normalizePath(APP_CONFIG?.routes?.login || "/login");

  // ✅ token canónico (si provider aún no lo refleja por timing)
  const hardToken = token || getToken() || "";

  if (isLoading) return <div className="p-6">Cargando…</div>;

  if (!isAuthenticated && !hardToken) {
    return <Navigate to={loginRoute} replace state={{ from: loc.pathname }} />;
  }

  return <>{children}</>;
}

/* ───────────────── Guard por ruta usando routeRules del backend ───────────────── */
function RouteAccess({ me, meLoading, routeKey, children }) {
  if (meLoading) return <div className="p-6">Cargando…</div>;

  const rules = me?.routeRules?.[routeKey] || null;

  // transición: si backend aún no manda reglas, NO bloqueamos aquí
  if (!rules) return <>{children}</>;

  const ok = canAccess(me, rules);
  return ok ? <>{children}</> : <div className="p-6">No autorizado</div>;
}

/* ───────────────── Redirección tras login (usa refresh result, no me stale) ───────────────── */
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

      // si hay auth/token y aún no hay me, fuerza refresh y usa su retorno
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

/* ───────────────── Solo bloqueo duro en PROD ───────────────── */
function AuthTokenBridge({ children }) {
  const { isAuthenticated, isLoading, token } = useAuth();
  const location = useLocation();

  const path = location?.pathname || "/";
  const hardToken = token || getToken() || "";

  const loginRoute = normalizePath(APP_CONFIG?.routes?.login || "/login");

  // ✅ público parametrizado
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

  // ✅ ÚNICO lugar donde se llama /me
  const { me, loading: meLoading, error: meError, refresh } = useMeSession();

  // ✅ Force login on boot (parametrizado)
  const bootRef = useRef(false);
  useEffect(() => {
    if (!APP_CONFIG?.auth?.forceLoginOnBoot) return;
    if (bootRef.current) return;
    bootRef.current = true;

    const path = location?.pathname || "/";
    if (isPublicPath(path)) return;

    if (APP_CONFIG?.auth?.clearTokenOnBoot) clearToken();

    const loginRoute = normalizePath(APP_CONFIG?.routes?.login || "/login");
    navigate(loginRoute, {
      replace: true,
      state: { from: path + (location?.search || "") },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loginRoute = normalizePath(APP_CONFIG?.routes?.login || "/login");

  // ✅ NUEVO: bloqueo duro para VISITA (solo puede navegar en /visitas/**)
  useEffect(() => {
    if (meLoading) return;
    if (!me) return;
    if (!isVisitorMe(me)) return;

    const path = location?.pathname || "/";
    const allow = [
      "/visitas",
      "/visitas/control",
      "/visitas/agenda",
      "/otp",
      "/force-change-password",
      loginRoute,
    ];

    const ok = allow.some((base) => startsWithPath(path, base));
    if (!ok) {
      navigate("/visitas/agenda", { replace: true });
    }
  }, [me, meLoading, location?.pathname]);

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
                <Layout>
                  <Home />
                </Layout>
              </ProtectedRoute>
            }
          />

          {/* Start */}
          <Route
            path="/start"
            element={
              <ProtectedRoute>
                <Layout>
                  <RoleRedirectInline me={me} meLoading={meLoading} refresh={refresh} />
                  {/* opcional debug */}
                  {meError && !IS_PROD ? (
                    <div className="p-3 text-sm text-red-600">
                      /me error: {String(meError?.message || meError)}
                    </div>
                  ) : null}
                </Layout>
              </ProtectedRoute>
            }
          />

          {/* Incidentes */}
          <Route
            path="/incidentes"
            element={
              <ProtectedRoute>
                <Layout>
                  <RouteAccess me={me} meLoading={meLoading} routeKey="incidentes">
                    <IncidentesList />
                  </RouteAccess>
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/incidentes/lista"
            element={
              <ProtectedRoute>
                <Layout>
                  <RouteAccess me={me} meLoading={meLoading} routeKey="incidentes">
                    <IncidentesList />
                  </RouteAccess>
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/incidentes/nuevo"
            element={
              <ProtectedRoute>
                <Layout>
                  <RouteAccess me={me} meLoading={meLoading} routeKey="incidentes.create">
                    <IncidenteForm />
                  </RouteAccess>
                </Layout>
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
                <Layout>
                  <RouteAccess me={me} meLoading={meLoading} routeKey="iam.admin">
                    <IamAdminPage me={me} meLoading={meLoading} />
                  </RouteAccess>
                </Layout>
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
                <Layout>
                  <RouteAccess me={me} meLoading={meLoading} routeKey="rondasqr.scan">
                    <RondasScan />
                  </RouteAccess>
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/rondasqr/reports"
            element={
              <ProtectedRoute>
                <Layout>
                  <RouteAccess me={me} meLoading={meLoading} routeKey="rondasqr.reports">
                    <RondasDashboard />
                  </RouteAccess>
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/rondasqr/admin"
            element={
              <ProtectedRoute>
                <Layout>
                  <RouteAccess me={me} meLoading={meLoading} routeKey="rondasqr.admin">
                    <AdminHub />
                  </RouteAccess>
                </Layout>
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
                <Layout>
                  <RouteAccess me={me} meLoading={meLoading} routeKey="accesos">
                    <Accesos />
                  </RouteAccess>
                </Layout>
              </ProtectedRoute>
            }
          />

          {/* ✅ VISITAS: sin Layout SOLO si es visitante */}
          <Route
            path="/visitas"
            element={
              <ProtectedRoute>
                <AppShell me={me}>
                  <RouteAccess me={me} meLoading={meLoading} routeKey="visitas.control">
                    <VisitsPageCore />
                  </RouteAccess>
                </AppShell>
              </ProtectedRoute>
            }
          />
          <Route
            path="/visitas/control"
            element={
              <ProtectedRoute>
                <AppShell me={me}>
                  <RouteAccess me={me} meLoading={meLoading} routeKey="visitas.control">
                    <VisitsPageCore />
                  </RouteAccess>
                </AppShell>
              </ProtectedRoute>
            }
          />
          <Route
            path="/visitas/agenda"
            element={
              <ProtectedRoute>
                <AppShell me={me}>
                  <AgendaPageCore />
                </AppShell>
              </ProtectedRoute>
            }
          />

          <Route
            path="/bitacora"
            element={
              <ProtectedRoute>
                <Layout>
                  <RouteAccess me={me} meLoading={meLoading} routeKey="bitacora">
                    <Bitacora />
                  </RouteAccess>
                </Layout>
              </ProtectedRoute>
            }
          />

          <Route
            path="/supervision"
            element={
              <ProtectedRoute>
                <Layout>
                  <RouteAccess me={me} meLoading={meLoading} routeKey="supervision">
                    <Supervision />
                  </RouteAccess>
                </Layout>
              </ProtectedRoute>
            }
          />

          <Route
            path="/chat"
            element={
              <ProtectedRoute>
                <Layout>
                  <Chat />
                </Layout>
              </ProtectedRoute>
            }
          />

          <Route path="*" element={<div className="p-6">No encontrado</div>} />
        </Routes>
      </Suspense>
    </AuthTokenBridge>
  );
}