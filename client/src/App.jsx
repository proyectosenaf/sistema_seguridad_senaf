// client/src/App.jsx
import React, { Suspense, useEffect, useRef } from "react";
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
const AdminHub = React.lazy(() =>
  import("./modules/rondasqr/admin/AdminHub.jsx")
);

// Otros módulos
const Accesos = React.lazy(() => import("./pages/Accesos/Accesos.jsx"));
const Bitacora = React.lazy(() => import("./pages/Bitacora/Bitacora.jsx"));
const Supervision = React.lazy(() =>
  import("./pages/Supervision/Supervision.jsx")
);
const Evaluacion = React.lazy(() => import("./pages/Evaluacion/Evaluacion.jsx"));
const Chat = React.lazy(() => import("./pages/Chat/Chat.jsx"));

// Control de visitas moderno
const VisitsPageCore = React.lazy(() =>
  import("./modules/visitas/pages/VisitsPage.jsx")
);
const AgendaPageCore = React.lazy(() =>
  import("./modules/visitas/pages/AgendaPage.jsx")
);

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

/* ───────────────── LÓGICA HOME ─────────────────
   ✅ Si el usuario está autenticado pero NO existe en IAM:
      roles=[], perms=[] y/o visitor:true → manda a /visitas/agenda
*/

function pickHome({ roles = [], perms = [], visitor = false }) {
  const R = new Set((roles || []).map((r) => String(r).toLowerCase()));
  const P = new Set(perms || []);

  // ✅ VISITANTE: autenticado pero sin registro/roles/perms en IAM
  if (visitor || (R.size === 0 && P.size === 0)) return "/visitas/agenda";

  if (R.has("guardia")) return "/";

  if (P.has("rondasqr.admin") || R.has("rondasqr.admin")) return "/rondasqr/admin";
  if (R.has("recepcion")) return "/visitas/control";

  return "/";
}

/* ───────────────── DEBUG Auth0 (IMPRIME EN PRODUCCIÓN) ───────────────── */

function AuthDebug() {
  const { isAuthenticated, user, error, isLoading, getAccessTokenSilently } = useAuth0();

  useEffect(() => {
    let alive = true;

    (async () => {
      const domain = import.meta.env.VITE_AUTH0_DOMAIN;
      const clientId = import.meta.env.VITE_AUTH0_CLIENT_ID;
      const audience = import.meta.env.VITE_AUTH0_AUDIENCE || "";

      console.log("[AUTH0] env domain:", domain || "(missing)");
      console.log("[AUTH0] env clientId:", clientId ? "(set)" : "(missing)");
      console.log("[AUTH0] env audience:", audience || "(empty)");
      console.log("[AUTH0] isLoading:", isLoading);
      console.log("[AUTH0] isAuthenticated:", isAuthenticated);
      console.log("[AUTH0] user.email:", user?.email || null);
      console.log("[AUTH0] error:", error || null);

      if (!alive) return;

      if (isAuthenticated) {
        try {
          const token = await getAccessTokenSilently({
            authorizationParams: audience ? { audience } : {},
          });
          console.log("[AUTH0] token ok?", !!token, "len:", token?.length || 0);
        } catch (e) {
          console.log("[AUTH0] getAccessTokenSilently FAILED:", e?.message || e);
        }
      }
    })();

    return () => {
      alive = false;
    };
  }, [isAuthenticated, isLoading, user, error, getAccessTokenSilently]);

  return null;
}

/** Redirección tras login */
function RoleRedirectInline() {
  const navigate = useNavigate();
  const { user, isAuthenticated, getAccessTokenSilently } = useAuth0();
  const ranRef = useRef(false);

  useEffect(() => {
    let alive = true;
    if (ranRef.current) return; // evita loops por re-renders
    ranRef.current = true;

    const RAW = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000/api";
    const API_ROOT = String(RAW).replace(/\/$/, "");
    const ME_URL = `${API_ROOT}/iam/v1/me`; // VITE_API_BASE_URL ya incluye /api

    const audience = import.meta.env.VITE_AUTH0_AUDIENCE || "";
    const ALLOW_DEV_HEADERS = import.meta.env.VITE_ALLOW_DEV_HEADERS === "1";
    const IS_DEV = import.meta.env.DEV;

    async function fetchMe(headers = {}) {
      try {
        const res = await fetch(ME_URL, {
          method: "GET",
          // En prod tu auth real es Bearer; no dependas de cookies
          credentials: "omit",
          headers,
        });

        if (!res.ok) return null;

        const data = (await res.json().catch(() => ({}))) || {};
        const roles = data?.roles || data?.user?.roles || [];
        const perms = data?.permissions || data?.perms || [];
        const visitor = !!data?.visitor || (!!data?.email && !data?.user); // fallback robusto
        return { roles, perms, visitor };
      } catch (e) {
        console.warn("[RoleRedirectInline] fetch /me error:", e?.message || e);
        return null;
      }
    }

    (async () => {
      let headers = {};

      // 1) token
      if (isAuthenticated) {
        try {
          const token = await getAccessTokenSilently({
            authorizationParams: audience ? { audience } : {},
          });
          if (token) headers.Authorization = `Bearer ${token}`;
        } catch (e) {
          console.warn(
            "[RoleRedirectInline] getAccessTokenSilently falló:",
            e?.message || e
          );
        }
      }

      let me = await fetchMe(headers);

      // 2) fallback dev headers (SOLO si tú lo permites)
      const lacksIdentity =
        !me || (!me.roles?.length && !me.perms?.length && !me.visitor);

      if (lacksIdentity && (IS_DEV || ALLOW_DEV_HEADERS)) {
        const devEmail =
          user?.email ||
          (typeof localStorage !== "undefined" &&
            localStorage.getItem("iamDevEmail")) ||
          import.meta.env.VITE_DEV_IAM_EMAIL ||
          "admin@local";

        me = await fetchMe({
          ...headers,
          "x-user-email": devEmail,
          "x-perms": "*",
        });
      }

      // ✅ si no hay me, cae a agenda (usuario autenticado pero backend no respondió)
      const dest = me ? pickHome(me) : "/visitas/agenda";
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
    const audience = import.meta.env.VITE_AUTH0_AUDIENCE || "";

    if (!isAuthenticated) {
      attachAuth0(null);
      attachRondasAuth(null);
      attachIamAuth(null);
      return;
    }

    const provider = async () => {
      try {
        const token = await getAccessTokenSilently({
          authorizationParams: audience ? { audience } : {},
        });
        return token || null;
      } catch (e) {
        console.warn("[AuthTokenBridge] tokenProvider falló:", e?.message || e);
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
      {/* ✅ IMPORTANTE: sí se renderiza para que imprima */}
      <AuthDebug />

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

            {/* Start */}
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
                    <IamGuardSuper
                      anyOf={["iam.users.manage", "iam.roles.manage", "*"]}
                    >
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
                    <IamGuardSuper
                      anyOf={[
                        "guardia",
                        "rondasqr.view",
                        "admin",
                        "iam.users.manage",
                        "*",
                      ]}
                    >
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
                    <IamGuardSuper
                      anyOf={["rondasqr.admin", "admin", "iam.users.manage", "*"]}
                    >
                      <AdminHub />
                    </IamGuardSuper>
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
                    <IamGuardSuper
                      anyOf={["accesos.read", "accesos.write", "accesos.export", "*"]}
                    >
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
                    <IamGuardSuper
                      anyOf={["visitas.read", "visitas.write", "visitas.close", "*"]}
                    >
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
                    <IamGuardSuper
                      anyOf={["visitas.read", "visitas.write", "visitas.close", "*"]}
                    >
                      <VisitsPageCore />
                    </IamGuardSuper>
                  </Layout>
                </ProtectedRoute>
              }
            />

            {/* ✅ CRÍTICO: agenda debe ser accesible para VISITANTES autenticados
               (sin permisos/roles en IAM todavía) */}
            <Route
              path="/visitas/agenda"
              element={
                <ProtectedRoute>
                  <Layout>
                    <AgendaPageCore />
                  </Layout>
                </ProtectedRoute>
              }
            />

            <Route
              path="/bitacora"
              element={
                <ProtectedRoute>
                  <Layout>
                    <IamGuardSuper
                      anyOf={["bitacora.read", "bitacora.write", "bitacora.export", "*"]}
                    >
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
