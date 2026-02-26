// client/src/App.jsx
import React, { Suspense, useEffect, useRef } from "react";
import { Routes, Route, Navigate, useNavigate, useLocation } from "react-router-dom";

// ✅ auth local (unificado)
import { useAuth } from "./pages/auth/AuthProvider.jsx";

import Layout from "./components/Layout.jsx";
import IamGuard from "./iam/api/IamGuard.jsx";

// Login local
import LoginLocal from "./pages/auth/LoginLocal.jsx";
import ChangePassword from "./pages/auth/ChangePassword.jsx";

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
const Evaluacion = React.lazy(() => import("./pages/Evaluacion/Evaluacion.jsx"));
const Chat = React.lazy(() => import("./pages/Chat/Chat.jsx"));

// Visitas
const VisitsPageCore = React.lazy(() => import("./modules/visitas/pages/VisitsPage.jsx"));
const AgendaPageCore = React.lazy(() => import("./modules/visitas/pages/AgendaPage.jsx"));

/* ───────────────── ENV helpers ───────────────── */
const VITE_ENV = String(import.meta.env.VITE_ENV || "").toLowerCase();
const MODE = String(import.meta.env.MODE || "").toLowerCase();
const IS_PROD = VITE_ENV === "production" || MODE === "production";

/* ───────────────── SUPER ADMIN FRONTEND ───────────────── */
const ROOT_ADMINS = (import.meta.env.VITE_ROOT_ADMINS || import.meta.env.VITE_SUPERADMIN_EMAIL || "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

function isSuperAdminUser(user) {
  const email = (user?.email || "").toLowerCase();
  return !!email && ROOT_ADMINS.includes(email);
}

function IamGuardSuper(props) {
  const { user } = useAuth();
  if (isSuperAdminUser(user)) return <>{props.children}</>;
  return <IamGuard {...props} />;
}

/* ───────────────── HOME PICKER ───────────────── */
function pickHome({ roles = [], perms = [], visitor = false }) {
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

/* ───────────────── ProtectedRoute (local) ───────────────── */
function ProtectedRoute({ children }) {
  const { isAuthenticated, isLoading } = useAuth();
  const loc = useLocation();

  if (isLoading) return <div className="p-6">Cargando…</div>;

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: loc.pathname }} />;
  }

  return <>{children}</>;
}

/** Redirección tras login */
function RoleRedirectInline() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const ranRef = useRef(false);

  useEffect(() => {
    let alive = true;
    if (ranRef.current) return;
    ranRef.current = true;

    const RAW = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000/api";
    const API_ROOT = String(RAW).replace(/\/$/, "");
    const ME_URL = `${API_ROOT}/iam/v1/me`;

    async function fetchMe(headers = {}) {
      try {
        const res = await fetch(ME_URL, { method: "GET", credentials: "omit", headers });
        if (!res.ok) return null;

        const data = (await res.json().catch(() => ({}))) || {};
        const roles = data?.roles || data?.user?.roles || [];
        const perms = data?.permissions || data?.perms || [];
        const visitor = !!data?.visitor || !!data?.isVisitor;
        return { roles, perms, visitor };
      } catch {
        return null;
      }
    }

    (async () => {
      const headers = {};
      if (isAuthenticated) {
        const token = localStorage.getItem("senaf_token");
        if (token) headers.Authorization = `Bearer ${token}`;
      }

      const me = await fetchMe(headers);
      const dest = me ? pickHome(me) : "/visitas/agenda";
      if (alive) navigate(dest, { replace: true });
    })();

    return () => {
      alive = false;
    };
  }, [navigate, isAuthenticated]);

  return <div className="p-6">Redirigiendo…</div>;
}

/** Solo bloqueo de rutas privadas. */
function AuthTokenBridge({ children }) {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  const path = location?.pathname || "/";
  const isPublicRoute =
    path === "/login" ||
    path === "/entry" ||
    path === "/callback" ||
    path === "/force-change-password" ||
    path.startsWith("/verify") ||
    path === "/otp" ||
    path === "/change-password";

  if (IS_PROD && !isLoading && !isAuthenticated && !isPublicRoute) {
    return (
      <div className="p-6">
        Debes iniciar sesión para acceder al sistema.
        <div className="mt-3">
          <a className="underline" href="/login">
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
          {/* Login */}
          <Route path="/login" element={<LoginLocal />} />

          {/* Legacy Auth0 routes */}
          <Route path="/entry" element={<Navigate to="/login" replace />} />
          <Route path="/callback" element={<Navigate to="/login" replace />} />

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
                    anyOf={["incidentes.read", "incidentes.create", "incidentes.edit", "incidentes.reports", "*"]}
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
                    anyOf={["incidentes.read", "incidentes.create", "incidentes.edit", "incidentes.reports", "*"]}
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
                  <IamGuardSuper anyOf={["guardia", "rondasqr.view", "rondasqr.scan.qr", "rondasqr.scan.manual", "*"]}>
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
            path="/evaluacion"
            element={
              <ProtectedRoute>
                <Layout>
                  <IamGuardSuper
                    anyOf={["evaluacion.list", "evaluacion.create", "evaluacion.edit", "evaluacion.reports", "evaluacion.kpi", "*"]}
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

          <Route path="/change-password" element={<ChangePassword />} />
          <Route path="*" element={<div className="p-6">No encontrado</div>} />
        </Routes>
      </Suspense>
    </AuthTokenBridge>
  );
}