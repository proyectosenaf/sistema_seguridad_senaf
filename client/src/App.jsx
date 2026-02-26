// client/src/App.jsx
import React, { Suspense, useEffect, useRef } from "react";
import {
  Routes,
  Route,
  Navigate,
  useNavigate,
  useLocation,
} from "react-router-dom";
import { useAuth0 } from "@auth0/auth0-react";

import { attachAuth0 } from "./lib/api.js";
import { attachRondasAuth } from "./modules/rondasqr/api/rondasqrApi.js";
import { attachIamAuth } from "./iam/api/iamApi.js";

import ProtectedRoute from "./components/ProtectedRoute.jsx";
import Layout from "./components/Layout.jsx";
import IamGuard from "./iam/api/IamGuard.jsx";

// Login local (solo DEV)
import LoginLocal from "./pages/Auth/LoginLocal";
import ChangePassword from "./pages/Auth/ChangePassword";

// Auth pages
const Entry = React.lazy(() => import("./pages/Auth/Entry.jsx"));
const AuthCallback = React.lazy(() => import("./pages/Auth/AuthCallback.jsx"));

// ✅ NUEVO: pantalla para forzar cambio de contraseña
const ForceChangePassword = React.lazy(() =>
  import("./pages/ForceChangePassword.jsx")
);

// ---- Páginas (lazy)
const IamAdminPage = React.lazy(() => import("./iam/pages/IamAdmin/index.jsx"));
const Home = React.lazy(() => import("./pages/Home/Home.jsx"));

const IncidentesList = React.lazy(() =>
  import("./pages/Incidentes/IncidentesList.jsx")
);
const IncidenteForm = React.lazy(() =>
  import("./pages/Incidentes/IncidenteForm.jsx")
);

// Rondas QR
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
const Chat = React.lazy(() => import("./pages/Chat/Chat.jsx"));

// Visitas
const VisitsPageCore = React.lazy(() =>
  import("./modules/visitas/pages/VisitsPage.jsx")
);
const AgendaPageCore = React.lazy(() =>
  import("./modules/visitas/pages/AgendaPage.jsx")
);

/* ───────────────── ENV helpers ───────────────── */
const VITE_ENV = String(import.meta.env.VITE_ENV || "").toLowerCase();
const MODE = String(import.meta.env.MODE || "").toLowerCase();
const IS_PROD = VITE_ENV === "production" || MODE === "production";

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

/* ───────────────── HOME PICKER ───────────────── */
function pickHome({ roles = [], perms = [], visitor = false }) {
  const R = new Set((roles || []).map((r) => String(r).toLowerCase()));
  const Praw = Array.isArray(perms) ? perms : [];
  const P = new Set(Praw.map((p) => String(p)));
  const Plow = new Set(Praw.map((p) => String(p).toLowerCase()));

  const hasWildcard =
    P.has("*") || Plow.has("*") || R.has("admin") || R.has("administrador");

  if (visitor || (!R.size && !Praw.length)) return "/visitas/agenda";
  if (hasWildcard || R.has("ti") || R.has("administrador_it"))
    return "/iam/admin";
  if (R.has("guardia")) return "/rondasqr/scan";
  if (R.has("supervisor")) return "/rondasqr/reports";
  if (R.has("recepcion")) return "/visitas/control";
  return "/";
}

/* ───────────────── Token utils (limpiar HS256) ───────────────── */
function looksLikeJwt(t) {
  return typeof t === "string" && t.split(".").length === 3;
}

function base64UrlDecode(str) {
  try {
    let s = String(str || "").replace(/-/g, "+").replace(/_/g, "/");
    while (s.length % 4) s += "=";
    return atob(s);
  } catch {
    return "";
  }
}

function decodeJwtHeader(token) {
  try {
    const h = String(token || "").split(".")[0] || "";
    const decoded = base64UrlDecode(h);
    if (!decoded) return null;
    return JSON.parse(decoded);
  } catch {
    return null;
  }
}

function isHs256Jwt(token) {
  const hdr = decodeJwtHeader(token);
  return String(hdr?.alg || "").toUpperCase() === "HS256";
}

function purgeLocalHs256Token() {
  try {
    const t = localStorage.getItem("token");
    if (t && looksLikeJwt(t) && isHs256Jwt(t)) {
      localStorage.removeItem("token");
      console.warn(
        "[App] Se eliminó localStorage.token HS256 (incompatible con Auth0/JWKS RS256)."
      );
      return true;
    }
  } catch {}
  return false;
}

/** Redirección tras login */
function RoleRedirectInline() {
  const navigate = useNavigate();
  const { isAuthenticated, getAccessTokenSilently } = useAuth0();
  const ranRef = useRef(false);

  useEffect(() => {
    let alive = true;
    if (ranRef.current) return;
    ranRef.current = true;

    const RAW = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000/api";
    const API_ROOT = String(RAW).replace(/\/$/, "");
    const ME_URL = `${API_ROOT}/iam/v1/me`;

    const audience = import.meta.env.VITE_AUTH0_AUDIENCE || "https://senaf";

    async function fetchMe(headers = {}) {
      try {
        const res = await fetch(ME_URL, {
          method: "GET",
          credentials: "omit",
          headers,
        });
        if (!res.ok) return null;

        const data = (await res.json().catch(() => ({}))) || {};
        const roles = data?.roles || data?.user?.roles || [];
        const perms = data?.permissions || data?.perms || [];
        const visitor = !!data?.visitor;
        return { roles, perms, visitor };
      } catch {
        return null;
      }
    }

    (async () => {
      let headers = {};
      if (isAuthenticated) {
        try {
          const token = await getAccessTokenSilently({
            authorizationParams: { audience },
          });
          if (token) headers.Authorization = `Bearer ${token}`;
        } catch {}
      }

      const me = await fetchMe(headers);
      const dest = me ? pickHome(me) : "/visitas/agenda";
      if (alive) navigate(dest, { replace: true });
    })();

    return () => {
      alive = false;
    };
  }, [navigate, isAuthenticated, getAccessTokenSilently]);

  return <div className="p-6">Redirigiendo…</div>;
}

/** Inyecta token de Auth0 a axios, Rondas QR e IAM */
function AuthTokenBridge({ children }) {
  const { isAuthenticated, isLoading, getAccessTokenSilently } = useAuth0();
  const location = useLocation();
  const audience = import.meta.env.VITE_AUTH0_AUDIENCE || "https://senaf";

  const path = location?.pathname || "/";
  const isPublicRoute =
    path === "/entry" ||
    path === "/callback" ||
    path === "/login" || // ✅ importante: /login también público
    path === "/force-change-password" || // ✅ NUEVO: pantalla pública
    path.startsWith("/verify");

  useEffect(() => {
    purgeLocalHs256Token();
  }, []);

  useEffect(() => {
    if (!isAuthenticated) {
      attachAuth0(null);
      attachRondasAuth(null);
      attachIamAuth(null);
      return;
    }

    const provider = async () => {
      try {
        const token = await getAccessTokenSilently({
          authorizationParams: { audience },
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
  }, [isAuthenticated, getAccessTokenSilently, audience]);

  // ✅ Bloquea SOLO rutas privadas
  if (IS_PROD && !isLoading && !isAuthenticated && !isPublicRoute) {
    return (
      <div className="p-6">
        Debes iniciar sesión con Auth0 para acceder al sistema.
        <div className="mt-3">
          <a className="underline" href="/entry">
            Ir al inicio de sesión
          </a>
        </div>
      </div>
    );
  }

  return children;
}

export default function App() {
  return (
    <AuthTokenBridge>
      <Suspense fallback={<div className="p-6">Cargando…</div>}>
        <Routes>
          {/* Auth */}
          <Route path="/entry" element={<Entry />} />
          <Route path="/callback" element={<AuthCallback />} />

          {/* ✅ /login en PROD = alias de /entry (EVITA LOOP) */}
          <Route path="/login" element={IS_PROD ? <Entry /> : <LoginLocal />} />

          {/* ✅ NUEVO: primer login (creados por admin) -> reset password */}
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
                    anyOf={[
                      "iam.users.manage",
                      "iam.roles.manage",
                      "iam.usuarios.gestionar",
                      "iam.roles.gestionar",
                      "*",
                    ]}
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
                      "rondasqr.scan.qr",
                      "rondasqr.scan.manual",
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
                      "rondasqr.reports.view",
                      "rondasqr.reports.query",
                      "rondasqr.reports.export_pdf",
                      "rondasqr.reports.map",
                      "rondasqr.reports",
                      "rondasqr.view",
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
                    anyOf={[
                      "rondasqr.assignments.write",
                      "rondasqr.sites.write",
                      "rondasqr.checkpoints.write",
                      "rondasqr.qr.generate",
                      "rondasqr.create",
                      "rondasqr.edit",
                      "rondasqr.delete",
                      "*",
                    ]}
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
                  <IamGuardSuper anyOf={["supervision.read", "supervision.create", "supervision.edit", "supervision.reports", "*"]}>
                    <Supervision />
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

          <Route path="/change-password" element={<ChangePassword />} />
          <Route path="*" element={<div className="p-6">No encontrado</div>} />
        </Routes>
      </Suspense>
    </AuthTokenBridge>
  );
}