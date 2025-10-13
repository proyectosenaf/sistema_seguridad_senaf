import React, { Suspense, useEffect } from "react";
import { Routes, Route, Navigate, useNavigate } from "react-router-dom";
import { useAuth0 } from "@auth0/auth0-react";
import { attachAuth0 } from "./lib/api.js";

import ProtectedRoute from "./components/ProtectedRoute.jsx";
import Layout from "./components/Layout.jsx";

// ✅ Layout global (back inteligente / ocultar sidebar)
import { LayoutUIProvider } from "./components/layout-ui.jsx";

// ✅ IAM (este import asume el archivo en client/src/iam/api/IamGuard.jsx)
import IamGuard from "./iam/api/IamGuard.jsx";

// ---- Páginas (lazy)
const IamAdminPage   = React.lazy(() => import("./iam/pages/IamAdmin/index.jsx"));
const Home           = React.lazy(() => import("./pages/Home/Home.jsx"));
const IncidentesList = React.lazy(() => import("./pages/Incidentes/IncidentesList.jsx"));
const IncidenteForm  = React.lazy(() => import("./pages/Incidentes/IncidenteForm.jsx"));

// ✅ Rondas
const RondasAdminPage   = React.lazy(() => import("./pages/Rondas/RondasAdminPage.jsx"));
const RondasGuardPage   = React.lazy(() => import("./pages/Rondas/RondasGuardPage.jsx"));
const RondasDashboard   = React.lazy(() => import("./pages/Rondas/RondasDashboard.jsx"));

// Otros módulos
const Accesos         = React.lazy(() => import("./pages/Accesos/Accesos.jsx"));
const Visitas         = React.lazy(() => import("./pages/Visitas/Visitas.jsx"));
const Bitacora        = React.lazy(() => import("./pages/Bitacora/Bitacora.jsx"));
const Supervision     = React.lazy(() => import("./pages/Supervision/Supervision.jsx"));
const Evaluacion      = React.lazy(() => import("./pages/Evaluacion/Evaluacion.jsx"));
const Chat            = React.lazy(() => import("./pages/Chat/Chat.jsx"));
const RoutesAdminList = React.lazy(() => import("./pages/RutasAdmin/RoutesList.jsx"));
const RouteForm       = React.lazy(() => import("./pages/RutasAdmin/RouteForm.jsx"));
const Assignments     = React.lazy(() => import("./pages/RutasAdmin/Assignments.jsx"));
const LoginRedirect   = React.lazy(() => import("./pages/Auth/LoginRedirect.jsx"));

/** Redirección automática por rol/permisos a la “home” correcta */
function pickHome({ roles = [], perms = [] }) {
  const R = new Set(roles.map((r) => String(r).toLowerCase()));
  const P = new Set(perms);

  // comodín de permisos o admin → IAM
  if (P.has("*") || R.has("admin") || P.has("iam.users.manage")) return "/iam/admin";
  if (R.has("supervisor")) return "/rondas/admin";
  if (R.has("guardia"))    return "/rondas/guard";
  if (R.has("recepcion"))  return "/accesos";
  if (R.has("analista"))   return "/rondas/dashboard";
  if (R.has("ti"))         return "/iam/admin";

  return "/"; // fallback a Home si no matchea
}

/** Página interna que decide a dónde mandarte según lo que diga /me */
function RoleRedirectInline() {
  const navigate = useNavigate();
  const { user } = useAuth0(); // usamos email real si existe

  useEffect(() => {
    let alive = true;

    const ROOT   = (import.meta.env.VITE_API_BASE_URL || "http://localhost:4000").replace(/\/$/, "");
    const V1     = `${ROOT}/api/iam/v1`;
    const LEGACY = `${ROOT}/api/iam`;
    const DEV    = import.meta.env.DEV;

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
          const data  = (await res.json().catch(() => ({}))) || {};
          const roles = data?.roles || data?.user?.roles || [];
          const perms = data?.permissions || data?.perms || [];
          if ((roles?.length || 0) + (perms?.length || 0) > 0) {
            return { roles, perms };
          }
        } catch {
          // continuar con la siguiente
        }
      }
      return null;
    }

    (async () => {
      // 1) JWT real (sin headers dev)
      let me = await tryFetch();

      // 2) En DEV, si vino vacío, reintentar con SOLO x-user-email (sin x-roles/x-perms)
      if (!me && DEV) {
        const devEmail =
          user?.email ||
          localStorage.getItem("iamDevEmail") ||
          import.meta.env.VITE_DEV_IAM_EMAIL ||
          "admin@local";
        me = await tryFetch({ "x-user-email": devEmail });
      }

      const dest = me ? pickHome(me) : "/";
      if (alive) navigate(dest, { replace: true });
    })();

    return () => { alive = false; };
  }, [navigate, user]);

  return <div className="p-6">Redirigiendo…</div>;
}

/** Puente para inyectar el token de Auth0 en tu lib/api */
function AuthTokenBridge({ children }) {
  const { isAuthenticated, getAccessTokenSilently } = useAuth0();

  useEffect(() => {
    const setProvider = async () => {
      if (!isAuthenticated) {
        attachAuth0(null);
        return;
      }
      attachAuth0(async () => {
        try {
          const token = await getAccessTokenSilently({
            authorizationParams: { audience: import.meta.env.VITE_AUTH0_AUDIENCE },
          });
          return token || null;
        } catch (err) {
          console.warn("[AuthTokenBridge] no se pudo obtener token:", err?.message || err);
          return null;
        }
      });
    };
    setProvider();
  }, [isAuthenticated, getAccessTokenSilently]);

  return children;
}

export default function App() {
  return (
    <AuthTokenBridge>
      <LayoutUIProvider>
        <Suspense fallback={<div className="p-6">Cargando…</div>}>
          <Routes>
            {/* Pública */}
            <Route path="/login" element={<LoginRedirect />} />

            {/* Protegidas */}
            {/* ✅ “/” vuelve a ser el panel principal (Home) */}
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <Layout><Home /></Layout>
                </ProtectedRoute>
              }
            />

            {/* ✅ Redirige según rol/permisos después del login */}
            <Route
              path="/start"
              element={
                <ProtectedRoute>
                  <Layout><RoleRedirectInline /></Layout>
                </ProtectedRoute>
              }
            />

            {/* ---- Incidentes ---- */}
            <Route
              path="/incidentes"
              element={
                <ProtectedRoute>
                  <Layout>
                    <IamGuard anyOf={["incidentes.read", "incidentes.create", "incidentes.edit", "incidentes.reports", "*"]}>
                      <IncidentesList />
                    </IamGuard>
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/incidentes/nuevo"
              element={
                <ProtectedRoute>
                  <Layout>
                    <IamGuard anyOf={["incidentes.create", "*"]}>
                      <IncidenteForm />
                    </IamGuard>
                  </Layout>
                </ProtectedRoute>
              }
            />

            {/* ---- Rondas de Vigilancia ---- */}
            <Route
              path="/rondas"
              element={<ProtectedRoute><Navigate to="/rondas/admin" replace /></ProtectedRoute>}
            />
            <Route
              path="/rondas/admin"
              element={
                <ProtectedRoute>
                  <Layout>
                    <IamGuard anyOf={["rondas.read", "rondas.create", "rondas.edit", "rondas.reports", "*"]}>
                      <RondasAdminPage />
                    </IamGuard>
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/rondas/guard"
              element={
                <ProtectedRoute>
                  <Layout>
                    <IamGuard anyOf={["rondas.read", "rondas.create", "rondas.edit", "*"]}>
                      <RondasGuardPage />
                    </IamGuard>
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/rondas/dashboard"
              element={
                <ProtectedRoute>
                  <Layout>
                    <IamGuard anyOf={["rondas.reports", "rondas.read", "*"]}>
                      <RondasDashboard />
                    </IamGuard>
                  </Layout>
                </ProtectedRoute>
              }
            />

            {/* ---- IAM (Gestión de usuarios/roles/permisos) ---- */}
            <Route
              path="/iam"
              element={<ProtectedRoute><Navigate to="/iam/admin" replace /></ProtectedRoute>}
            />
            <Route
              path="/iam/admin"
              element={
                <ProtectedRoute>
                  <Layout>
                    <IamGuard anyOf={["iam.users.manage", "iam.roles.manage", "*"]}>
                      <IamAdminPage />
                    </IamGuard>
                  </Layout>
                </ProtectedRoute>
              }
            />

            {/* ---- Otros módulos ---- */}
            <Route
              path="/accesos"
              element={
                <ProtectedRoute>
                  <Layout>
                    <IamGuard anyOf={["accesos.read", "accesos.write", "accesos.export", "*"]}>
                      <Accesos />
                    </IamGuard>
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/visitas"
              element={
                <ProtectedRoute>
                  <Layout>
                    <IamGuard anyOf={["visitas.read", "visitas.write", "visitas.close", "*"]}>
                      <Visitas />
                    </IamGuard>
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/bitacora"
              element={
                <ProtectedRoute>
                  <Layout>
                    <IamGuard anyOf={["bitacora.read", "bitacora.write", "bitacora.export", "*"]}>
                      <Bitacora />
                    </IamGuard>
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/supervision"
              element={
                <ProtectedRoute>
                  <Layout>
                    <IamGuard anyOf={["supervision.read", "supervision.create", "supervision.edit", "supervision.reports", "*"]}>
                      <Supervision />
                    </IamGuard>
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/evaluacion"
              element={
                <ProtectedRoute>
                  <Layout>
                    <IamGuard anyOf={["evaluacion.list", "evaluacion.create", "evaluacion.edit", "evaluacion.reports", "evaluacion.kpi", "*"]}>
                      <Evaluacion />
                    </IamGuard>
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/chat"
              element={<ProtectedRoute><Layout><Chat /></Layout></ProtectedRoute>}
            />

            {/* Admin de Rutas */}
            <Route
              path="/rutas-admin"
              element={<ProtectedRoute><Layout><RoutesAdminList /></Layout></ProtectedRoute>}
            />
            <Route
              path="/rutas-admin/nueva"
              element={<ProtectedRoute><Layout><RouteForm /></Layout></ProtectedRoute>}
            />
            <Route
              path="/rutas-admin/:id"
              element={<ProtectedRoute><Layout><RouteForm /></Layout></ProtectedRoute>}
            />
            <Route
              path="/rutas-admin/asignaciones"
              element={<ProtectedRoute><Layout><Assignments /></Layout></ProtectedRoute>}
            />

            {/* 404 */}
            <Route path="*" element={<div className="p-6">No encontrado</div>} />
          </Routes>
        </Suspense>
      </LayoutUIProvider>
    </AuthTokenBridge>
  );
}
