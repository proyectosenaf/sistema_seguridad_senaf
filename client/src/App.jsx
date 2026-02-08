// client/src/App.jsx
import React, { Suspense, useEffect, useMemo, useRef } from "react";
import { Routes, Route, Navigate, useNavigate } from "react-router-dom";
import { useAuth0 } from "@auth0/auth0-react";

import { attachAuth0 } from "./lib/api.js";
import { attachRondasAuth } from "./modules/rondasqr/api/rondasqrApi.js";
import { attachIamAuth } from "./iam/api/iamApi.js";

import ProtectedRoute from "./components/ProtectedRoute.jsx";
import Layout from "./components/Layout.jsx";
import { LayoutUIProvider } from "./components/layout-ui.jsx";
import IamGuard from "./iam/api/IamGuard.jsx";

// Auth pages
const Entry = React.lazy(() => import("./pages/Auth/Entry.jsx"));
const LoginRedirect = React.lazy(() => import("./pages/Auth/LoginRedirect.jsx"));
const AuthCallback = React.lazy(() => import("./pages/Auth/AuthCallback.jsx"));

// ---- Páginas (lazy)
const IamAdminPage = React.lazy(() => import("./iam/pages/IamAdmin/index.jsx"));
const Home = React.lazy(() => import("./pages/Home/Home.jsx"));
const IncidentesList = React.lazy(() => import("./pages/Incidentes/IncidentesList.jsx"));
const IncidenteForm = React.lazy(() => import("./pages/Incidentes/IncidenteForm.jsx"));

// ✅ Rondas QR
const RondasDashboard = React.lazy(() => import("./modules/rondasqr/supervisor/ReportsPage.jsx"));
const RondasScan = React.lazy(() => import("./modules/rondasqr/guard/ScanPage.jsx"));
const AdminHub = React.lazy(() => import("./modules/rondasqr/admin/AdminHub.jsx"));

// Otros módulos
const Accesos = React.lazy(() => import("./pages/Accesos/Accesos.jsx"));
const Bitacora = React.lazy(() => import("./pages/Bitacora/Bitacora.jsx"));
const Supervision = React.lazy(() => import("./pages/Supervision/Supervision.jsx"));
const Evaluacion = React.lazy(() => import("./pages/Evaluacion/Evaluacion.jsx"));
const Chat = React.lazy(() => import("./pages/Chat/Chat.jsx"));

// Control de visitas moderno
const VisitsPageCore = React.lazy(() => import("./modules/visitas/pages/VisitsPage.jsx"));
const AgendaPageCore = React.lazy(() => import("./modules/visitas/pages/AgendaPage.jsx"));

/* ───────────────── SUPER ADMIN FRONTEND ───────────────── */

const ROOT_ADMINS = (
  import.meta.env.VITE_ROOT_ADMINS ||
  import.meta.env.VITE_SUPERADMIN_EMAIL ||
  ""
)
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

function isSuperAdminUser(user) {
  const email = (user?.email || "").toLowerCase();
  return !!email && ROOT_ADMINS.includes(email);
}

function IamGuardSuper(props) {
  const { user } = useAuth0();
  if (isSuperAdminUser(user)) return <>{props.children}</>;
  return <IamGuard {...props} />;
}

/* ───────────────── LÓGICA HOME ───────────────── */

function pickHome({ roles = [], perms = [] }) {
  const R = new Set((roles || []).map((r) => String(r).toLowerCase()));
  const P = new Set(perms || []);

  // Guardia ya NO se manda a rondas automáticamente
  if (R.has("guardia")) return "/";

  if (P.has("rondasqr.admin") || R.has("rondasqr.admin")) return "/rondasqr/admin";
  if (R.has("recepcion")) return "/accesos";

  return "/";
}

/* ───────────────── AuthTokenBridge ─────────────────
   ✅ CLAVE:
   - si NO estás mandando Authorization, todo te dará 403.
   - aquí aseguramos que los 3 módulos reciban SIEMPRE el token provider.
*/
function AuthTokenBridge({ children }) {
  const { isAuthenticated, isLoading, getAccessTokenSilently } = useAuth0();

  // evita recrear provider por renders; igual si cambia isAuthenticated/isLoading se re-evalúa
  const audience = useMemo(() => import.meta.env.VITE_AUTH0_AUDIENCE || "", []);
  const setOnceRef = useRef({ attached: false, mode: "none" });

  useEffect(() => {
    // mientras carga Auth0, no “rompas” providers
    if (isLoading) return;

    if (!isAuthenticated) {
      // clean
      attachAuth0(null);
      attachRondasAuth(null);
      attachIamAuth(null);
      setOnceRef.current = { attached: true, mode: "no-auth" };
      return;
    }

    const provider = async () => {
      try {
        const token = await getAccessTokenSilently({
          authorizationParams: {
            // ✅ imprescindible para que el token salga con aud = https://senaf
            audience: audience || undefined,
            scope: "openid profile email",
          },
        });
        return token || null;
      } catch (e) {
        // DEBUG rápido si quieres:
        // console.warn("[AuthTokenBridge] getAccessTokenSilently failed:", e?.message || e);
        return null;
      }
    };

    attachAuth0(provider);
    attachRondasAuth(provider);
    attachIamAuth(provider);
    setOnceRef.current = { attached: true, mode: "auth" };
  }, [isAuthenticated, isLoading, getAccessTokenSilently, audience]);

  return children;
}

/** Redirección tras login */
function RoleRedirectInline() {
  const navigate = useNavigate();
  const { user, isAuthenticated, isLoading, getAccessTokenSilently } = useAuth0();

  useEffect(() => {
    if (isLoading) return;

    let alive = true;

    const RAW = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000/api";
    const ROOT = String(RAW).replace(/\/api\/?$/, "").replace(/\/$/, "");
    const V1 = `${ROOT}/api/iam/v1`;
    const LEGACY = `${ROOT}/api/iam`;
    const DEV = import.meta.env.DEV;

    const audience = import.meta.env.VITE_AUTH0_AUDIENCE || "";

    const candidates = [
      `${V1}/me`,
      `${V1}/auth/me`,
      `${LEGACY}/me`,
      `${LEGACY}/auth/me`,
    ];

    async function tryFetch(headers = {}) {
      for (const url of candidates) {
        try {
          const res = await fetch(url, { credentials: "include", headers });
          if (!res.ok) continue;

          const data = (await res.json().catch(() => ({}))) || {};
          const roles = data?.roles || data?.user?.roles || [];
          const perms = data?.permissions || data?.perms || [];

          if ((roles?.length || 0) + (perms?.length || 0) > 0) {
            return { roles, perms };
          }
        } catch {
          // ignore
        }
      }
      return null;
    }

    (async () => {
      // 1) intenta con token real
      let headers = {};

      if (isAuthenticated) {
        try {
          const token = await getAccessTokenSilently({
            authorizationParams: { audience: audience || undefined },
          });
          if (token) headers.Authorization = `Bearer ${token}`;
        } catch {
          // si falla, no inventamos nada aquí
        }
      }

      let me = await tryFetch(headers);

      // 2) DEV fallback: cabecera dev (solo local/dev)
      if (!me && DEV) {
        const devEmail =
          user?.email ||
          (typeof localStorage !== "undefined" && localStorage.getItem("iamDevEmail")) ||
          import.meta.env.VITE_DEV_IAM_EMAIL ||
          "admin@local";

        me = await tryFetch({ ...headers, "x-user-email": devEmail });
      }

      const dest = me ? pickHome(me) : "/";
      if (alive) navigate(dest, { replace: true });
    })();

    return () => {
      alive = false;
    };
  }, [navigate, user, isAuthenticated, isLoading, getAccessTokenSilently]);

  return <div className="p-6">Redirigiendo…</div>;
}

export default function App() {
  return (
    <AuthTokenBridge>
      <LayoutUIProvider>
        <Suspense fallback={<div className="p-6">Cargando…</div>}>
          <Routes>
            {/* Auth */}
            <Route path="/entry" element={<Entry />} />
            <Route path="/callback" element={<AuthCallback />} />
            <Route path="/login" element={<LoginRedirect />} />

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

            {/* Start (decide por roles/perms) */}
            <Route
              path="/start"
              element={
                <ProtectedRoute>
                  <Layout>
                    <RoleRedirectInline />
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
                    <IamGuardSuper
                      anyOf={[
                        "incidentes.read",
                        "incidentes.create",
                        "incidentes.edit",
                        "incidentes.reports",
                        "*",
                      ]}
                    >
                      <IncidentesList />
                    </IamGuardSuper>
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/incidentes/lista"
              element={
                <ProtectedRoute>
                  <Layout>
                    <IamGuardSuper
                      anyOf={[
                        "incidentes.read",
                        "incidentes.create",
                        "incidentes.edit",
                        "incidentes.reports",
                        "*",
                      ]}
                    >
                      <IncidentesList />
                    </IamGuardSuper>
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/incidentes/nuevo"
              element={
                <ProtectedRoute>
                  <Layout>
                    <IamGuardSuper anyOf={["incidentes.create", "*"]}>
                      <IncidenteForm />
                    </IamGuardSuper>
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
                    <IamGuardSuper anyOf={["iam.users.manage", "iam.roles.manage", "*"]}>
                      <IamAdminPage />
                    </IamGuardSuper>
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
                    <IamGuardSuper anyOf={["guardia", "rondasqr.view", "admin", "iam.users.manage", "*"]}>
                      <RondasScan />
                    </IamGuardSuper>
                  </Layout>
                </ProtectedRoute>
              }
            />

            <Route
              path="/rondasqr/reports"
              element={
                <ProtectedRoute>
                  <Layout>
                    <IamGuardSuper
                      anyOf={[
                        "rondasqr.reports",
                        "rondasqr.view",
                        "rondasqr.admin",
                        "admin",
                        "iam.users.manage",
                        "*",
                      ]}
                    >
                      <RondasDashboard />
                    </IamGuardSuper>
                  </Layout>
                </ProtectedRoute>
              }
            />

            <Route
              path="/rondasqr/admin"
              element={
                <ProtectedRoute>
                  <Layout>
                    <IamGuardSuper anyOf={["rondasqr.admin", "admin", "iam.users.manage", "*"]}>
                      <AdminHub />
                    </IamGuardSuper>
                  </Layout>
                </ProtectedRoute>
              }
            />

            {/* Aliases legacy rondas */}
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
                    <IamGuardSuper anyOf={["accesos.read", "accesos.write", "accesos.export", "*"]}>
                      <Accesos />
                    </IamGuardSuper>
                  </Layout>
                </ProtectedRoute>
              }
            />

            <Route
              path="/visitas"
              element={
                <ProtectedRoute>
                  <Layout>
                    <IamGuardSuper anyOf={["visitas.read", "visitas.write", "visitas.close", "*"]}>
                      <VisitsPageCore />
                    </IamGuardSuper>
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/visitas/control"
              element={
                <ProtectedRoute>
                  <Layout>
                    <IamGuardSuper anyOf={["visitas.read", "visitas.write", "visitas.close", "*"]}>
                      <VisitsPageCore />
                    </IamGuardSuper>
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/visitas/agenda"
              element={
                <ProtectedRoute>
                  <Layout>
                    <IamGuardSuper anyOf={["visitas.read", "visitas.write", "visitas.close", "*"]}>
                      <AgendaPageCore />
                    </IamGuardSuper>
                  </Layout>
                </ProtectedRoute>
              }
            />

            <Route
              path="/bitacora"
              element={
                <ProtectedRoute>
                  <Layout>
                    <IamGuardSuper anyOf={["bitacora.read", "bitacora.write", "bitacora.export", "*"]}>
                      <Bitacora />
                    </IamGuardSuper>
                  </Layout>
                </ProtectedRoute>
              }
            />

            <Route
              path="/supervision"
              element={
                <ProtectedRoute>
                  <Layout>
                    <IamGuardSuper
                      anyOf={[
                        "supervision.read",
                        "supervision.create",
                        "supervision.edit",
                        "supervision.reports",
                        "*",
                      ]}
                    >
                      <Supervision />
                    </IamGuardSuper>
                  </Layout>
                </ProtectedRoute>
              }
            />

            <Route
              path="/evaluacion"
              element={
                <ProtectedRoute>
                  <Layout>
                    <IamGuardSuper
                      anyOf={[
                        "evaluacion.list",
                        "evaluacion.create",
                        "evaluacion.edit",
                        "evaluacion.reports",
                        "evaluacion.kpi",
                        "*",
                      ]}
                    >
                      <Evaluacion />
                    </IamGuardSuper>
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
      </LayoutUIProvider>
    </AuthTokenBridge>
  );
}
