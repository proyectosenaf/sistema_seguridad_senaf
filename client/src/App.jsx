// client/src/App.jsx
import React, { Suspense, useEffect } from "react";
import { Routes, Route } from "react-router-dom";
import { useAuth0 } from "@auth0/auth0-react";
import { attachAuth0 } from "./lib/api.js"; // <- corregido (antes: /src/lib/api.js)

import ProtectedRoute from "./components/ProtectedRoute.jsx";
import Layout from "./components/Layout.jsx";

// Páginas (lazy)
const Home            = React.lazy(() => import("./pages/Home/Home.jsx"));
const IncidentesList  = React.lazy(() => import("./pages/Incidentes/IncidentesList.jsx"));
const IncidenteForm   = React.lazy(() => import("./pages/Incidentes/IncidenteForm.jsx"));
const Rondas          = React.lazy(() => import("./pages/Rondas/Rondas.jsx"));
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

function AuthTokenBridge({ children }) {
  const { isAuthenticated, getAccessTokenSilently } = useAuth0();

  useEffect(() => {
    const setProvider = async () => {
      if (!isAuthenticated) {
        attachAuth0(null); // limpia el provider si no está autenticado
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
      <Suspense fallback={<div className="p-6">Cargando…</div>}>
        <Routes>
          {/* Pública */}
          <Route path="/login" element={<LoginRedirect />} />

          {/* Protegidas */}
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Layout><Home /></Layout>
              </ProtectedRoute>
            }
          />

          {/* Módulos (placeholders propios) */}
          <Route path="/incidentes"        element={<ProtectedRoute><Layout><IncidentesList /></Layout></ProtectedRoute>} />
          <Route path="/incidentes/nuevo"  element={<ProtectedRoute><Layout><IncidenteForm  /></Layout></ProtectedRoute>} />
          <Route path="/rondas"            element={<ProtectedRoute><Layout><Rondas         /></Layout></ProtectedRoute>} />
          <Route path="/accesos"           element={<ProtectedRoute><Layout><Accesos        /></Layout></ProtectedRoute>} />
          <Route path="/visitas"           element={<ProtectedRoute><Layout><Visitas        /></Layout></ProtectedRoute>} />
          <Route path="/bitacora"          element={<ProtectedRoute><Layout><Bitacora       /></Layout></ProtectedRoute>} />
          <Route path="/supervision"       element={<ProtectedRoute><Layout><Supervision    /></Layout></ProtectedRoute>} />
          <Route path="/evaluacion"        element={<ProtectedRoute><Layout><Evaluacion     /></Layout></ProtectedRoute>} />
          <Route path="/chat"              element={<ProtectedRoute><Layout><Chat           /></Layout></ProtectedRoute>} />

          {/* Admin */}
          <Route path="/rutas-admin"             element={<ProtectedRoute><Layout><RoutesAdminList /></Layout></ProtectedRoute>} />
          <Route path="/rutas-admin/nueva"       element={<ProtectedRoute><Layout><RouteForm       /></Layout></ProtectedRoute>} />
          <Route path="/rutas-admin/:id"         element={<ProtectedRoute><Layout><RouteForm       /></Layout></ProtectedRoute>} />
          <Route path="/rutas-admin/asignaciones"element={<ProtectedRoute><Layout><Assignments     /></Layout></ProtectedRoute>} />

          {/* 404 */}
          <Route path="*" element={<div className="p-6">No encontrado</div>} />
        </Routes>
      </Suspense>
    </AuthTokenBridge>
  );
}
