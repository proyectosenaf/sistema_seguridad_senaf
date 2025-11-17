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

// ✅ Rondas QR
//   - Panel unificado (scan + widgets)
const RondasDashboard = React.lazy(() => import("./modules/rondasqr/supervisor/ReportsPage.jsx")); // informes
const RondasScan      = React.lazy(() => import("./modules/rondasqr/guard/ScanPage.jsx"));         // panel unificado

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
const AuthCallback  = React.lazy(() => import("./pages/Auth/AuthCallback.jsx")); // 👈 NUEVO

/* 👇 NUEVO: páginas del módulo Control de Visitas */
const VisitsPageCore = React.lazy(() => import("./modules/visitas/pages/VisitsPage.jsx"));
const AgendaPageCore = React.lazy(() => import("./modules/visitas/pages/AgendaPage.jsx"));
/* FIN NUEVO */

/* ───────────────── SUPER ADMIN FRONTEND ───────────────── */

// Varios correos separados por coma: VITE_ROOT_ADMINS=correo1@x.com,correo2@y.com
// Además, incluye VITE_SUPERADMIN_EMAIL para que coincida con el backend.
const ROOT_ADMINS = (
  (import.meta.env.VITE_ROOT_ADMINS ||
    import.meta.env.VITE_SUPERADMIN_EMAIL ||
    "")
)
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

/**
 * Devuelve true si el usuario actual es un "root admin" por correo.
 * Esto funciona igual en localhost y producción mientras el correo sea el mismo.
 */
function isSuperAdminUser(user) {
  if (!user) return false;
  const email = (user.email || "").toLowerCase();
  if (!email) return false;
  return ROOT_ADMINS.includes(email);
}

/**
 * Wrapper sobre IamGuard que:
 *  - Si eres super admin → SIEMPRE muestra children (ignora anyOf, fallback, etc.).
 *  - Si no → delega al IamGuard original.
 */
function IamGuardSuper(props) {
  const { user } = useAuth0();

  if (isSuperAdminUser(user)) {
    // ignoramos fallback/redirecciones: el dueño del sistema ve TODO
    return <>{props.children}</>;
  }

  return <IamGuard {...props} />;
}

/* ───────────────── LÓGICA EXISTENTE ───────────────── */

/** Decide home por rol/permisos */
function pickHome({ roles = [], perms = [] }) {
  const R = new Set(roles.map((r) => String(r).toLowerCase()));
  const P = new Set(perms);
  if (P.has("*") || R.has("admin") || P.has("iam.users.manage") || R.has("ti"))
    return "/iam/admin";
  if (P.has("rondasqr.admin") || R.has("rondasqr.admin")) return "/rondasqr/admin";
  if (R.has("recepcion")) return "/accesos";
  if (R.has("guardia")) return "/rondasqr/scan";
  return "/";
}

/** Redirección tras login */
function RoleRedirectInline() {
  const navigate = useNavigate();
  const { user, isAuthenticated, getAccessTokenSilently } = useAuth0();

  useEffect(() => {
    let alive = true;

    // Tomamos VITE_API_BASE_URL (normalmente termina en /api)
    const RAW  = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000/api";
    // Quitamos /api del final para quedarnos solo con el host
    const ROOT = RAW.replace(/\/api\/?$/, "").replace(/\/$/, "");
    const V1     = `${ROOT}/api/iam/v1`;
    const LEGACY = `${ROOT}/api/iam`;
    const DEV    = import.meta.env.DEV;
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
          const res = await fetch(url, {
            credentials: "include",
            headers,
          });
          if (!res.ok) continue;
          const data  = (await res.json().catch(() => ({}))) || {};
          const roles = data?.roles || data?.user?.roles || [];
          const perms = data?.permissions || data?.perms || [];
          if ((roles?.length || 0) + (perms?.length || 0) > 0) return { roles, perms };
        } catch {
          // ignoramos y probamos la siguiente URL
        }
      }
      return null;
    }

    (async () => {
      // 1️⃣ En producción (o si hay sesión Auth0), intentamos con token Bearer
      let headers = {};
      if (isAuthenticated && audience) {
        try {
          const token = await getAccessTokenSilently({
            authorizationParams: { audience },
          });
          if (token) {
            headers.Authorization = `Bearer ${token}`;
          }
        } catch (err) {
          const msg = (err && (err.error || err.message)) || String(err);
          console.debug("[RoleRedirectInline] getAccessTokenSilently:", msg);
        }
      }

      // 2️⃣ Intento normal (token si existe, si no cookies)
      let me = await tryFetch(headers);

      // 3️⃣ En DEV/local con IAM dev: usar x-user-email como antes
      if (!me && DEV) {
        const devEmail =
          user?.email ||
          (typeof localStorage !== "undefined" &&
            localStorage.getItem("iamDevEmail")) ||
          import.meta.env.VITE_DEV_IAM_EMAIL ||
          "admin@local";

        me = await tryFetch({
          ...headers,
          "x-user-email": devEmail,
        });
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
            authorizationParams: {
              audience: import.meta.env.VITE_AUTH0_AUDIENCE,
              scope: "openid profile email offline_access",
            },
          });
          return token || null;
        } catch (err) {
          const msg = (err && (err.error || err.message)) || String(err);
          console.debug("[AuthTokenBridge] getAccessTokenSilently:", msg);
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
      {/* Admin → Hub */}
      <IamGuardSuper anyOf={["rondasqr.admin", "admin", "iam.users.manage", "*"]} fallback={null}>
        <Navigate to="/rondasqr/admin" replace />
      </IamGuardSuper>

      {/* Guardia → Scan */}
      <IamGuardSuper anyOf={["guardia"]} fallback={null}>
        <Navigate to="/rondasqr/scan" replace />
      </IamGuardSuper>

      {/* Por defecto → Panel unificado */}
      <Navigate to="/rondasqr/scan" replace />
    </>
  );
}

export default function App() {
  return (
    <AuthTokenBridge>
      <LayoutUIProvider>
        <Suspense fallback={<div className="p-6">Cargando…</div>}>
          <Routes>
            {/* 🔹 Callback de Auth0: SOLO termina login y redirige */}
            <Route path="/callback" element={<AuthCallback />} />

            {/* Pública: ruta /login manual (siempre fuerza login) */}
            <Route path="/login" element={<LoginRedirect />} />

            {/* Protegidas */}
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
                    <IamGuardSuper anyOf={["incidentes.read","incidentes.create","incidentes.edit","incidentes.reports","*"]}>
                      <IncidentesList />
                    </IamGuardSuper>
                  </Layout>
                </ProtectedRoute>
              }
            />
            {/* 👉 alias para que /incidentes/lista no dé 404 */}
            <Route
              path="/incidentes/lista"
              element={
                <ProtectedRoute>
                  <Layout>
                    <IamGuardSuper anyOf={["incidentes.read","incidentes.create","incidentes.edit","incidentes.reports","*"]}>
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
                    <IamGuardSuper anyOf={["incidentes.create","*"]}>
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
                    <IamGuardSuper anyOf={["iam.users.manage","iam.roles.manage","*"]}>
                      <IamAdminPage />
                    </IamGuardSuper>
                  </Layout>
                </ProtectedRoute>
              }
            />

            {/* ✅ RONDAS QR */}
            <Route
              path="/rondasqr"
              element={
                <ProtectedRoute>
                  <Layout>
                    <RondasRouterInline />
                  </Layout>
                </ProtectedRoute>
              }
            />

            {/* Panel unificado (Scan) */}
            <Route
              path="/rondasqr/scan/*"
              element={
                <ProtectedRoute>
                  <Layout hideSidebar>
                    <IamGuardSuper anyOf={["guardia","rondasqr.view","admin","iam.users.manage","*"]}>
                      <RondasScan />
                    </IamGuardSuper>
                  </Layout>
                </ProtectedRoute>
              }
            />

            {/* Informes */}
            <Route
              path="/rondasqr/reports"
              element={
                <ProtectedRoute>
                  <Layout>
                    <IamGuardSuper anyOf={["rondasqr.reports","rondasqr.view","rondasqr.admin","admin","iam.users.manage","*"]}>
                      <RondasDashboard />
                    </IamGuardSuper>
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
                    <IamGuardSuper anyOf={["rondasqr.admin","admin","iam.users.manage","*"]}>
                      <AdminHub />
                    </IamGuardSuper>
                  </Layout>
                </ProtectedRoute>
              }
            />

            {/* Aliases de admin */}
            <Route path="/rondasqr/admin/plans"        element={<Navigate to="/rondasqr/admin" replace />} />
            <Route path="/rondasqr/admin/checkpoints"  element={<Navigate to="/rondasqr/admin" replace />} />

            {/* 🔁 Redirecciones legacy */}
            <Route path="/rondasqrpanel"          element={<Navigate to="/rondasqr/scan" replace />} />
            <Route path="/rondasqr/panel"         element={<Navigate to="/rondasqr/scan" replace />} />
            <Route path="/rondasqr/rondasqrpanel" element={<Navigate to="/rondasqr/scan" replace />} />

            {/* Alias legacy generales */}
            <Route path="/rondas"         element={<Navigate to="/rondasqr" replace />} />
            <Route path="/rondas/admin"   element={<Navigate to="/rondasqr/admin" replace />} />
            <Route path="/rondas/scan"    element={<Navigate to="/rondasqr/scan" replace />} />
            <Route path="/rondas/reports" element={<Navigate to="/rondasqr/reports" replace />} />

            {/* Otros módulos existentes */}
            <Route
              path="/accesos"
              element={
                <ProtectedRoute>
                  <Layout>
                    <IamGuardSuper anyOf={["accesos.read","accesos.write","accesos.export","*"]}>
                      <Accesos />
                    </IamGuardSuper>
                  </Layout>
                </ProtectedRoute>
              }
            />

            {/* Control de visitas (moderno) */}
            <Route
              path="/visitas"
              element={
                <ProtectedRoute>
                  <Layout>
                    <IamGuardSuper anyOf={["visitas.read","visitas.write","visitas.close","*"]}>
                      <VisitsPageCore />
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
                    <IamGuardSuper anyOf={["bitacora.read","bitacora.write","bitacora.export","*"]}>
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
                    <IamGuardSuper anyOf={["supervision.read","supervision.create","supervision.edit","supervision.reports","*"]}>
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
                    <IamGuardSuper anyOf={["evaluacion.list","evaluacion.create","evaluacion.edit","evaluacion.reports","evaluacion.kpi","*"]}>
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

            {/* 🔹 NUEVO: módulo Control de Visitas moderno */}
            <Route
              path="/visitas/control"
              element={
                <ProtectedRoute>
                  <Layout>
                    <IamGuardSuper anyOf={["visitas.read","visitas.write","visitas.close","*"]}>
                      <VisitsPageCore />
                    </IamGuardSuper>
                  </Layout>
                </ProtectedRoute>
              }
            />

            {/* 🔹 NUEVO: submódulo Agenda de Citas */}
            <Route
              path="/visitas/agenda"
              element={
                <ProtectedRoute>
                  <Layout>
                    <IamGuardSuper anyOf={["visitas.read","visitas.write","visitas.close","*"]}>
                      <AgendaPageCore />
                    </IamGuardSuper>
                  </Layout>
                </ProtectedRoute>
              }
            />

            {/* 404 */}
            <Route path="*" element={<div className="p-6">No encontrado</div>} />
          </Routes>
        </Suspense>
      </LayoutUIProvider>
    </AuthTokenBridge>
  );
}
