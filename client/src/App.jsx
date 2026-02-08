// src/App.jsx
import React, { Suspense, useEffect } from "react";
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
const IncidentesList = React.lazy(() =>
  import("./pages/Incidentes/IncidentesList.jsx")
);
const IncidenteForm = React.lazy(() =>
  import("./pages/Incidentes/IncidenteForm.jsx")
);

// ✅ Rondas QR
const RondasDashboard = React.lazy(() =>
  import("./modules/rondasqr/supervisor/ReportsPage.jsx")
);
const RondasScan = React.lazy(() =>
  import("./modules/rondasqr/guard/ScanPage.jsx")
);
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

/** Redirección tras login */
function RoleRedirectInline() {
  const navigate = useNavigate();
  const { user, isAuthenticated, getAccessTokenSilently } = useAuth0();

  useEffect(() => {
    let alive = true;

    const RAW = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000/api";
    const ROOT = String(RAW).replace(/\/api\/?$/, "").replace(/\/$/, "");
    const V1 = `${ROOT}/api/iam/v1`;
    const LEGACY = `${ROOT}/api/iam`;
    const DEV = import.meta.env.DEV;

    // ✅ FIX: Auth0 SDK v2 usa "authorizationParams"
    const audience = import.meta.env.VITE_AUTH0_AUDIENCE;

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
          if ((roles?.length || 0) + (perms?.length || 0) > 0) return { roles, perms };
        } catch {}
      }
      return null;
    }

    (async () => {
      let headers = {};

      // ✅ FIX: pedir token SIEMPRE con authorizationParams (no mezclar)
      if (isAuthenticated && audience) {
        try {
          const token = await getAccessTokenSilently({
            authorizationParams: { audience },
          });
          if (token) headers.Authorization = `Bearer ${token}`;
        } catch {}
      }

      let me = await tryFetch(headers);

      // DEV fallback (solo en dev)
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
  }, [navigate, user, isAuthenticated, getAccessTokenSilently]);

  return <div className="p-6">Redirigiendo…</div>;
}

/** Inyecta token de Auth0 a la lib/api, Rondas QR e IAM */
function AuthTokenBridge({ children }) {
  const { isAuthenticated, getAccessTokenSilently } = useAuth0();

  useEffect(() => {
    // ✅ IMPORTANTE:
    // - Setear provider aunque el user cambie
    // - No hacer "setProvider async" innecesario, solo setear funciones
    const audience = import.meta.env.VITE_AUTH0_AUDIENCE;

    if (!isAuthenticated) {
      attachAuth0(null);
      attachRondasAuth(null);
      attachIamAuth(null);
      return;
    }

    const provider = async () => {
      try {
        // ✅ FIX: Auth0 v2 -> authorizationParams
        // ✅ NO meter offline_access aquí si no lo necesitas (puede requerir refresh token config)
        const token = await getAccessTokenSilently({
          authorizationParams: {
            audience,
            scope: "openid profile email",
          },
        });
        return token || null;
      } catch {
        return null;
      }
    };

    attachAuth0(provider);
    attachRondasAuth(provider);
    attachIamAuth(provider);
  }, [isAuthenticated, getAccessTokenSilently]);

  return children;
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
