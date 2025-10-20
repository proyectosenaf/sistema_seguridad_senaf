// src/App.jsx
import React, { Suspense, useEffect } from "react";
import { Routes, Route, Navigate, useNavigate } from "react-router-dom";
import { useAuth0 } from "@auth0/auth0-react";
import { attachAuth0 } from "./lib/api.js";

// ✅ también inyectamos el token al módulo Rondas QR
import { attachRondasAuth } from "./modules/rondasqr/api/rondasqrApi.js";

import ProtectedRoute from "./components/ProtectedRoute.jsx";
import Layout from "./components/Layout.jsx";
import { LayoutUIProvider } from "./components/layout-ui.jsx";
import IamGuard from "./iam/api/IamGuard.jsx";

// ---- Páginas (lazy)
const IamAdminPage   = React.lazy(() => import("./iam/pages/IamAdmin/index.jsx"));
const Home           = React.lazy(() => import("./pages/Home/Home.jsx"));
const IncidentesList = React.lazy(() => import("./pages/Incidentes/IncidentesList.jsx"));
const IncidenteForm  = React.lazy(() => import("./pages/Incidentes/IncidenteForm.jsx"));

// ✅ Rondas QR (nuevo módulo)
const RondasDashboard = React.lazy(() => import("./modules/rondasqr/supervisor/ReportsPage.jsx"));
const RondasScan      = React.lazy(() => import("./modules/rondasqr/guard/ScanPage.jsx"));
// ✅ Hub de administración (CRUD)
const AdminHub        = React.lazy(() => import("./modules/rondasqr/admin/AdminHub.jsx"));

// Otros módulos
const Accesos       = React.lazy(() => import("./pages/Accesos/Accesos.jsx"));
const Visitas       = React.lazy(() => import("./pages/Visitas/Visitas.jsx"));
const Bitacora      = React.lazy(() => import("./pages/Bitacora/Bitacora.jsx"));
const Supervision   = React.lazy(() => import("./pages/Supervision/Supervision.jsx"));
const Evaluacion    = React.lazy(() => import("./pages/Evaluacion/Evaluacion.jsx"));
const Chat          = React.lazy(() => import("./pages/Chat/Chat.jsx"));
const LoginRedirect = React.lazy(() => import("./pages/Auth/LoginRedirect.jsx"));

/** Decide home por rol/permisos */
function pickHome({ roles = [], perms = [] }) {
  const R = new Set(roles.map((r) => String(r).toLowerCase()));
  const P = new Set(perms);
  if (P.has("*") || R.has("admin") || P.has("iam.users.manage") || R.has("ti")) return "/iam/admin";
  if (P.has("rondasqr.admin") || R.has("rondasqr.admin")) return "/rondasqr/admin";
  if (R.has("recepcion")) return "/accesos";
  if (R.has("guardia")) return "/rondasqr/scan";
  return "/";
}

/** Redirección tras login */
function RoleRedirectInline() {
  const navigate = useNavigate();
  const { user } = useAuth0();

  useEffect(() => {
    let alive = true;
    const ROOT   = (import.meta.env.VITE_API_BASE_URL || "http://localhost:4000").replace(/\/$/, "");
    const V1     = `${ROOT}/api/iam/v1`;
    const LEGACY = `${ROOT}/api/iam`;
    const DEV    = import.meta.env.DEV;
    const candidates = [`${V1}/me`, `${V1}/auth/me`, `${LEGACY}/me`, `${LEGACY}/auth/me`];

    async function tryFetch(headers = {}) {
      for (const url of candidates) {
        try {
          const res = await fetch(url, { credentials: "include", headers });
          if (!res.ok) continue;
          const data  = (await res.json().catch(() => ({}))) || {};
          const roles = data?.roles || data?.user?.roles || [];
          const perms = data?.permissions || data?.perms || [];
          if ((roles?.length || 0) + (perms?.length || 0) > 0) return { roles, perms };
        } catch {}
      }
      return null;
    }

    (async () => {
      let me = await tryFetch();
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

/** Inyecta token de Auth0 a la lib/api y al módulo Rondas QR */
function AuthTokenBridge({ children }) {
  const { isAuthenticated, getAccessTokenSilently } = useAuth0();

  useEffect(() => {
    const setProvider = async () => {
      if (!isAuthenticated) {
        attachAuth0(null);
        attachRondasAuth(null);
        return;
      }
      const provider = async () => {
        try {
          const token = await getAccessTokenSilently({
            authorizationParams: { audience: import.meta.env.VITE_AUTH0_AUDIENCE },
          });
          return token || null;
        } catch (err) {
          console.warn("[AuthTokenBridge]", err?.message || err);
          return null;
        }
      };
      attachAuth0(provider);
      attachRondasAuth(provider);
    };
    setProvider();
  }, [isAuthenticated, getAccessTokenSilently]);

  return children;
}

/** ✔ Router inteligente para Rondas */
function RondasRouterInline() {
  return (
    <>
      {/* Admin (cualquiera de estos) → Hub */}
      <IamGuard anyOf={["rondasqr.admin", "admin", "iam.users.manage", "*"]} fallback={null}>
        <Navigate to="/rondasqr/admin" replace />
      </IamGuard>

      {/* Guardia → Scan */}
      <IamGuard anyOf={["guardia"]} fallback={null}>
        <Navigate to="/rondasqr/scan" replace />
      </IamGuard>

      {/* Por defecto → Panel */}
      <Navigate to="/rondasqr/panel" replace />
    </>
  );
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
            <Route
              path="/"
              element={<ProtectedRoute><Layout><Home /></Layout></ProtectedRoute>}
            />

            <Route
              path="/start"
              element={<ProtectedRoute><Layout><RoleRedirectInline /></Layout></ProtectedRoute>}
            />

            {/* Incidentes */}
            <Route
              path="/incidentes"
              element={
                <ProtectedRoute>
                  <Layout>
                    <IamGuard anyOf={["incidentes.read","incidentes.create","incidentes.edit","incidentes.reports","*"]}>
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
                    <IamGuard anyOf={["incidentes.create","*"]}>
                      <IncidenteForm />
                    </IamGuard>
                  </Layout>
                </ProtectedRoute>
              }
            />

            {/* IAM */}
            <Route path="/iam" element={<ProtectedRoute><Navigate to="/iam/admin" replace /></ProtectedRoute>} />
            <Route
              path="/iam/admin"
              element={
                <ProtectedRoute>
                  <Layout>
                    <IamGuard anyOf={["iam.users.manage","iam.roles.manage","*"]}>
                      <IamAdminPage />
                    </IamGuard>
                  </Layout>
                </ProtectedRoute>
              }
            />

            {/* ✅ RONDAS QR */}
            {/* Entrada única (router inteligente) */}
            <Route
              path="/rondasqr"
              element={<ProtectedRoute><Layout><RondasRouterInline /></Layout></ProtectedRoute>}
            />
            {/* Panel / Reportes (Supervisor) */}
            <Route
              path="/rondasqr/panel"
              element={
                <ProtectedRoute>
                  <Layout>
                    <IamGuard anyOf={["rondasqr.view","rondasqr.admin","guardia","admin","iam.users.manage","*"]}>
                      <RondasDashboard />
                    </IamGuard>
                  </Layout>
                </ProtectedRoute>
              }
            />
            {/* Scan (Guardia) */}
            <Route
              path="/rondasqr/scan"
              element={
                <ProtectedRoute>
                  <Layout hideSidebar>
                    <IamGuard anyOf={["guardia","rondasqr.view","admin","iam.users.manage","*"]}>
                      <RondasScan />
                    </IamGuard>
                  </Layout>
                </ProtectedRoute>
              }
            />
            {/* Admin Hub (CRUD) */}
            <Route
              path="/rondasqr/admin"
              element={
                <ProtectedRoute>
                  <Layout>
                    <IamGuard anyOf={["rondasqr.admin","admin","iam.users.manage","*"]}>
                      <AdminHub />
                    </IamGuard>
                  </Layout>
                </ProtectedRoute>
              }
            />
            {/* Reportes directo (alias) */}
            <Route
              path="/rondasqr/reports"
              element={
                <ProtectedRoute>
                  <Layout>
                    <IamGuard anyOf={["rondasqr.reports","rondasqr.view","rondasqr.admin","admin","iam.users.manage","*"]}>
                      <RondasDashboard />
                    </IamGuard>
                  </Layout>
                </ProtectedRoute>
              }
            />

            {/* Aliases de admin para que los enlaces del menú no den 404 */}
            <Route path="/rondasqr/admin/plans"        element={<Navigate to="/rondasqr/admin" replace />} />
            <Route path="/rondasqr/admin/checkpoints"  element={<Navigate to="/rondasqr/admin" replace />} />

            {/* Redirecciones “curita” para URLs mal formadas */}
            <Route path="/rondasqrpanel" element={<Navigate to="/rondasqr/panel" replace />} />
            <Route path="/rondasqr/rondasqrpanel" element={<Navigate to="/rondasqr/panel" replace />} />

            {/* Alias legacy */}
            <Route path="/rondas"         element={<Navigate to="/rondasqr" replace />} />
            <Route path="/rondas/admin"   element={<Navigate to="/rondasqr/admin" replace />} />
            <Route path="/rondas/scan"    element={<Navigate to="/rondasqr/scan" replace />} />
            <Route path="/rondas/reports" element={<Navigate to="/rondasqr/reports" replace />} />

            {/* Otros módulos */}
            <Route path="/accesos" element={<ProtectedRoute><Layout><IamGuard anyOf={["accesos.read","accesos.write","accesos.export","*"]}><Accesos/></IamGuard></Layout></ProtectedRoute>} />
            <Route path="/visitas" element={<ProtectedRoute><Layout><IamGuard anyOf={["visitas.read","visitas.write","visitas.close","*"]}><Visitas/></IamGuard></Layout></ProtectedRoute>} />
            <Route path="/bitacora" element={<ProtectedRoute><Layout><IamGuard anyOf={["bitacora.read","bitacora.write","bitacora.export","*"]}><Bitacora/></IamGuard></Layout></ProtectedRoute>} />
            <Route path="/supervision" element={<ProtectedRoute><Layout><IamGuard anyOf={["supervision.read","supervision.create","supervision.edit","supervision.reports","*"]}><Supervision/></IamGuard></Layout></ProtectedRoute>} />
            <Route path="/evaluacion" element={<ProtectedRoute><Layout><IamGuard anyOf={["evaluacion.list","evaluacion.create","evaluacion.edit","evaluacion.reports","evaluacion.kpi","*"]}><Evaluacion/></IamGuard></Layout></ProtectedRoute>} />
            <Route path="/chat" element={<ProtectedRoute><Layout><Chat /></Layout></ProtectedRoute>} />

            {/* 404 */}
            <Route path="*" element={<div className="p-6">No encontrado</div>} />
          </Routes>
        </Suspense>
      </LayoutUIProvider>
    </AuthTokenBridge>
  );
}
