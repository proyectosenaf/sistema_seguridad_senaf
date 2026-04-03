// client/src/App.jsx
import React, { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { Routes, Route, Navigate, useNavigate, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";

// ✅ auth local
import { useAuth } from "./pages/auth/AuthProvider.jsx";

// Layout
import Layout from "./components/Layout.jsx";
import GlobalPanicListener from "./components/GlobalPanicListener.jsx";

// ✅ Un solo cliente HTTP + token canónico
import api, { getToken, clearToken } from "./lib/api.js";

// ✅ Config central
import { APP_CONFIG } from "./config/app.config.js";

// ✅ i18n
import i18n from "./i18n";

// Login local
import LoginLocal from "./pages/auth/LoginLocal.jsx";

// ✅ NUEVO: recuperación de contraseña
const ForgotPassword = React.lazy(() => import("./pages/auth/ForgotPassword.jsx"));
const ResetPassword = React.lazy(() => import("./pages/auth/ResetPassword.jsx"));

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
const RondasLanding = React.lazy(() => import("./modules/rondasqr/RondasLanding.jsx"));
const RondasDashboard = React.lazy(() => import("./modules/rondasqr/supervisor/ReportsPage.jsx"));
const RondasScan = React.lazy(() => import("./modules/rondasqr/guard/ScanPage.jsx"));
const AdminHub = React.lazy(() => import("./modules/rondasqr/admin/AdminHub.jsx"));

// Otros módulos
const Accesos = React.lazy(() => import("./pages/Accesos/Accesos.jsx"));
const Bitacora = React.lazy(() => import("./pages/Bitacora/Bitacora.jsx"));
const Chat = React.lazy(() => import("./pages/Chat/Chat.jsx"));

// ✅ NUEVO MÓDULO: Respaldo y Restauración
const BackupRestorePage = React.lazy(() =>
  import("./modules/system/pages/BackupRestorePage.jsx")
);

// Visitas
const VisitsPageCore = React.lazy(() => import("./modules/visitas/pages/VisitsPage.jsx"));
const AgendaPageCore = React.lazy(() => import("./modules/visitas/pages/AgendaPage.jsx"));
import CitasQrScannerPage from "./modules/visitas/pages/CitasQrScannerPage.jsx";

/* ───────────────── ENV helpers ───────────────── */
const VITE_ENV = String(import.meta.env.VITE_ENV || "").toLowerCase();
const MODE = String(import.meta.env.MODE || "").toLowerCase();
const IS_PROD = VITE_ENV === "production" || MODE === "production";

// ✅ fallback fijo confirmado por ti
const SUPERADMIN_EMAIL = String(
  import.meta.env.VITE_SUPERADMIN_EMAIL || "proyectosenaf@gmail.com"
)
  .trim()
  .toLowerCase();

/* ───────────────── ✅ Keys compartidas con AuthProvider ───────────────── */
const USER_KEY = "senaf_user";
const USER_UPDATED_EVENT = "senaf:user_updated";

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

  if (startsWithPath(p, "/forgot-password")) return true;
  if (startsWithPath(p, "/reset-password")) return true;

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

function writeVisitorHint(isVisitor) {
  try {
    localStorage.setItem(VISITOR_HINT_KEY, isVisitor ? "1" : "0");
  } catch {}
}

function clearVisitorHint() {
  try {
    localStorage.removeItem(VISITOR_HINT_KEY);
  } catch {}
}

function clearPersistedSessionArtifacts() {
  try {
    localStorage.removeItem(USER_KEY);
  } catch {}
  clearVisitorHint();
  try {
    window.dispatchEvent(new Event(USER_UPDATED_EVENT));
  } catch {}
}

/* ───────────────── Helpers de normalización de /me ───────────────── */

function normalizeArray(v) {
  if (Array.isArray(v)) return v.filter(Boolean);
  if (typeof v === "string" && v.trim()) return [v.trim()];
  return [];
}

function normalizeMePayload(payload) {
  if (!payload || typeof payload !== "object") return null;

  const userObj = payload.user && typeof payload.user === "object" ? payload.user : {};

  const payloadRoles = normalizeArray(payload.roles);
  const payloadPerms = normalizeArray(
    payload.permissions?.length ? payload.permissions : payload.perms
  );

  const userRoles = normalizeArray(userObj.roles);
  const userPerms = normalizeArray(
    userObj.permissions?.length ? userObj.permissions : userObj.perms
  );

  const roles = payloadRoles.length ? payloadRoles : userRoles;
  const permissions = payloadPerms.length ? payloadPerms : userPerms;

  const can =
    payload.can && typeof payload.can === "object"
      ? payload.can
      : userObj.can && typeof userObj.can === "object"
      ? userObj.can
      : {};

  const payloadEmail = String(payload.email || "").trim().toLowerCase();
  const userEmail = String(userObj.email || "").trim().toLowerCase();
  const resolvedEmail = payloadEmail || userEmail;

  const superadminByPayload =
    payload.superadmin === true ||
    payload.isSuperAdmin === true ||
    userObj.superadmin === true ||
    userObj.isSuperAdmin === true;

  const superadminByEmail =
    !!resolvedEmail && !!SUPERADMIN_EMAIL && resolvedEmail === SUPERADMIN_EMAIL;

  const superadmin = superadminByPayload || superadminByEmail;

  const normalized = {
    ...payload,
    email: resolvedEmail || payload.email || userObj.email || "",
    user: {
      ...userObj,
      email: userObj.email || payload.email || "",
      roles,
      permissions,
      perms: permissions,
      can,
      superadmin,
      isSuperAdmin: superadmin,
    },
    roles,
    permissions,
    perms: permissions,
    can,
    superadmin,
    isSuperAdmin: superadmin,
  };

  return normalized;
}

/* ───────────────── HOME PICKER ───────────────── */
function pickHomeFromMe(me) {
  const def = me?.defaultRoute || me?.home || me?.redirectTo;
  if (def) return String(def);

  const can = me?.can && typeof me.can === "object" ? me.can : null;
  if (can) {
    if (can["nav.iam"] === true) return "/iam/admin";
    if (can["nav.system"] === true) return "/system/backups";
    if (can["nav.rondas"] === true) return "/rondasqr";
    if (can["nav.visitas"] === true) return "/visitas/control";
    if (can["nav.accesos"] === true) return "/accesos";
    if (can["nav.incidentes"] === true) return "/incidentes";
    if (can["nav.bitacora"] === true) return "/bitacora";
  }

  return "/";
}

/* ───────────────── visitor helpers ───────────────── */
function isVisitorMe(me) {
  const email = String(me?.email || me?.user?.email || "").trim().toLowerCase();
  if (SUPERADMIN_EMAIL && email && email === SUPERADMIN_EMAIL) return false;

  const roles = me?.roles || me?.user?.roles || [];
  const visitor = !!me?.visitor || !!me?.isVisitor;
  const R = new Set((roles || []).map((r) => String(r).toLowerCase()));
  return visitor || R.has("visita") || R.has("visitor");
}

/* ───────────────── Root Error Boundary ───────────────── */
class RootErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, err: null };
  }

  static getDerivedStateFromError(err) {
    return { hasError: true, err };
  }

  componentDidCatch(err, info) {
    console.error("[RootErrorBoundary]", err, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-6">
          <div className="text-lg font-bold text-red-600">
            {i18n.t("system.interfaceError")}
          </div>
          <div className="mt-2 text-sm opacity-80">
            {String(this.state.err?.message || this.state.err || i18n.t("system.errorGeneric"))}
          </div>
          {!import.meta.env.PROD ? (
            <pre className="mt-3 text-[11px] whitespace-pre-wrap opacity-70">
              {String(this.state.err?.stack || "")}
            </pre>
          ) : null}
        </div>
      );
    }
    return this.props.children;
  }
}

/* ───────────────── Session bootstrap ───────────────── */
function useMeSession(authToken) {
  const [me, setMe] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    const hardToken = String(authToken || getToken() || "").trim();

    if (!hardToken) {
      setMe(null);
      setError(null);
      setLoading(false);
      return null;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await api.get("/iam/v1/me", {
        headers: {
          "Cache-Control": "no-store, no-cache",
          Pragma: "no-cache",
        },
      });

      const payload = res?.data ?? null;
      const normalized = normalizeMePayload(payload);

      try {
        if (normalized && typeof normalized === "object") {
          localStorage.setItem(USER_KEY, JSON.stringify(normalized));
          writeVisitorHint(isVisitorMe(normalized));
          window.dispatchEvent(new Event(USER_UPDATED_EVENT));
        }
      } catch {}

      setMe(normalized || null);
      return normalized || null;
    } catch (e) {
      setMe(null);
      setError(e);

      if (Number(e?.status) === 401 || Number(e?.response?.status) === 401) {
        clearPersistedSessionArtifacts();
        clearToken();
      }

      return null;
    } finally {
      setLoading(false);
    }
  }, [authToken]);

  useEffect(() => {
    let alive = true;

    (async () => {
      const hardToken = String(authToken || getToken() || "").trim();

      if (!hardToken) {
        if (!alive) return;
        setMe(null);
        setError(null);
        setLoading(false);
        return;
      }

      const result = await refresh();
      if (!alive) return;
      void result;
    })();

    return () => {
      alive = false;
    };
  }, [authToken, refresh]);

  return { me, loading, error, refresh };
}

/* ───────────────── AppShell ───────────────── */
function AppShell({ me, meLoading, children, shellProps = {} }) {
  if (meLoading) return <>{children}</>;
  if (!me) return <>{children}</>;

  if (isVisitorMe(me)) {
    return (
      <Layout layoutMode="visitor" {...shellProps}>
        {children}
      </Layout>
    );
  }

  return <Layout {...shellProps}>{children}</Layout>;
}

/* ───────────────── ProtectedRoute ───────────────── */
function ProtectedRoute({ children }) {
  const { t } = useTranslation();
  const { isAuthenticated, isLoading, token } = useAuth();
  const loc = useLocation();

  const loginRoute = normalizePath(APP_CONFIG?.routes?.login || "/login");
  const hardToken = token || getToken() || "";

  if (isLoading) return <div className="p-6">{t("system.loading")}</div>;

  if (!isAuthenticated && !hardToken) {
    return <Navigate to={loginRoute} replace state={{ from: loc.pathname }} />;
  }

  return <>{children}</>;
}

/* ───────────────── SessionGate ───────────────── */
function SessionGate({ me, meLoading, children }) {
  const { t } = useTranslation();
  const location = useLocation();
  const path = location?.pathname || "/";
  const hardToken = getToken() || "";

  if (!hardToken) return <>{children}</>;

  const hintVisitor = readVisitorHint();
  const isPublic = isPublicPath(path);

  if (meLoading) {
    if (isPublic) return <>{children}</>;
    if (hintVisitor && startsWithPath(path, "/visitas")) return <>{children}</>;
    return <div className="p-6">{t("system.loadingSession")}</div>;
  }

  if (!me) {
    if (!hardToken) return <>{children}</>;
    if (isPublic) return <>{children}</>;
    if (hintVisitor && startsWithPath(path, "/visitas")) return <>{children}</>;
    return <div className="p-6">{t("system.loadingSession")}</div>;
  }

  return <>{children}</>;
}

/* ───────────────── RouteAccess ───────────────── */
function RouteAccess({ me, meLoading, routeKey, children }) {
  const { t } = useTranslation();

  if (meLoading) return <div className="p-6">{t("system.loading")}</div>;
  if (!me) return <div className="p-6">{t("system.loadingSession")}</div>;

  if (me?.superadmin === true || me?.isSuperAdmin === true) {
    return <>{children}</>;
  }

  if (isVisitorMe(me)) {
    const allowed = String(routeKey || "").startsWith("visitas");
    if (!allowed) return <div className="p-6">{t("system.unauthorized")}</div>;
  }

  const can = me?.can && typeof me.can === "object" ? me.can : null;
  if (!can || !routeKey) return <div className="p-6">{t("system.unauthorized")}</div>;

  return can[routeKey] === true ? <>{children}</> : <div className="p-6">{t("system.unauthorized")}</div>;
}

/* ───────────────── Redirección tras login ───────────────── */
function RoleRedirectInline({ me, meLoading, refresh }) {
  const { t } = useTranslation();
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

  return <div className="p-6">{t("system.redirecting")}</div>;
}

/* ───────────────── Bloqueo duro en PROD ───────────────── */
function AuthTokenBridge({ children }) {
  const { t } = useTranslation();
  const { isAuthenticated, isLoading, token } = useAuth();
  const location = useLocation();

  const path = location?.pathname || "/";
  const hardToken = token || getToken() || "";

  const loginRoute = normalizePath(APP_CONFIG?.routes?.login || "/login");
  const isPublicRoute = isPublicPath(path);

  if (IS_PROD && !isLoading && !isAuthenticated && !hardToken && !isPublicRoute) {
    return (
      <div className="p-6">
        {t("auth.mustLogin")}
        <div className="mt-3">
          <a className="underline" href={loginRoute}>
            {t("auth.goToLogin")}
          </a>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

export default function App() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { token, isLoading: authLoading } = useAuth();

  const hardToken = String(token || getToken() || "").trim();
  const { me, loading: meLoading, error: meError, refresh } = useMeSession(hardToken);

  const loginRoute = normalizePath(APP_CONFIG?.routes?.login || "/login");

  const bootRef = useRef(false);

  useEffect(() => {
    if (!APP_CONFIG?.auth?.forceLoginOnBoot) return;
    if (bootRef.current) return;
    bootRef.current = true;

    const path = location?.pathname || "/";
    if (isPublicPath(path)) return;

    const tokenNow = getToken() || "";

    if (!tokenNow && APP_CONFIG?.auth?.clearTokenOnBoot) {
      clearToken();
      clearPersistedSessionArtifacts();
    }

    if (tokenNow) return;

    navigate(loginRoute, {
      replace: true,
      state: { from: path + (location?.search || "") },
    });
  }, [location?.pathname, location?.search, navigate, loginRoute]);

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
      "/forgot-password",
      "/reset-password",
      loginRoute,
    ];

    const ok = allowBases.some((base) => startsWithPath(path, base));
    if (!ok) {
      navigate("/visitas/agenda", { replace: true });
    }
  }, [me, meLoading, location?.pathname, loginRoute, navigate]);

  useEffect(() => {
    if (authLoading) return;
    if (hardToken) return;
    clearPersistedSessionArtifacts();
  }, [authLoading, hardToken]);

  return (
    <RootErrorBoundary>
      <AuthTokenBridge>
        <GlobalPanicListener />

        <Suspense fallback={<div className="p-6">{t("system.loading")}</div>}>
          <Routes>
            <Route path={loginRoute} element={<LoginLocal />} />

            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />

            <Route path="/entry" element={<Navigate to={loginRoute} replace />} />
            <Route path="/callback" element={<Navigate to={loginRoute} replace />} />

            <Route path="/otp" element={<VerifyOtp />} />
            <Route path="/force-change-password" element={<ForceChangePassword />} />

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

            {/* ✅ NUEVO MÓDULO: Respaldo y Restauración */}
            <Route
              path="/system/backups"
              element={
                <ProtectedRoute>
                  <SessionGate me={me} meLoading={meLoading}>
                    <AppShell me={me} meLoading={meLoading}>
                      <RouteAccess
                        me={me}
                        meLoading={meLoading}
                        routeKey="system.backups.read"
                      >
                        <BackupRestorePage />
                      </RouteAccess>
                    </AppShell>
                  </SessionGate>
                </ProtectedRoute>
              }
            />

            <Route
              path="/rondasqr"
              element={
                <ProtectedRoute>
                  <SessionGate me={me} meLoading={meLoading}>
                    <AppShell me={me} meLoading={meLoading}>
                      <RouteAccess me={me} meLoading={meLoading} routeKey="rondas.panel">
                        <RondasLanding me={me} />
                      </RouteAccess>
                    </AppShell>
                  </SessionGate>
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

            <Route path="/rondas" element={<Navigate to="/rondasqr" replace />} />
            <Route path="/rondas/admin" element={<Navigate to="/rondasqr/admin" replace />} />
            <Route path="/rondas/scan" element={<Navigate to="/rondasqr/scan" replace />} />
            <Route path="/rondas/reports" element={<Navigate to="/rondasqr/reports" replace />} />

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
                    <AppShell
                      me={me}
                      meLoading={meLoading}
                      shellProps={
                        isVisitorMe(me)
                          ? {
                              hideFooter: true,
                              hideChatDock: true,
                            }
                          : {}
                      }
                    >
                      <AgendaPageCore />
                    </AppShell>
                  </SessionGate>
                </ProtectedRoute>
              }
            />

            <Route
              path="/visitas/scan-qr"
              element={
                <ProtectedRoute>
                  <SessionGate me={me} meLoading={meLoading}>
                    <AppShell me={me} meLoading={meLoading}>
                      <RouteAccess me={me} meLoading={meLoading} routeKey="visitas.control">
                        <CitasQrScannerPage />
                      </RouteAccess>
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

            <Route path="*" element={<div className="p-6">{t("system.notFound")}</div>} />
          </Routes>
        </Suspense>
      </AuthTokenBridge>
    </RootErrorBoundary>
  );
}