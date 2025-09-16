// client/src/App.jsx
import React, { Suspense } from "react";
import { Routes, Route } from "react-router-dom";
import ProtectedRoute from "./components/ProtectedRoute.jsx";
import Layout from "./components/Layout.jsx";

// Páginas (lazy)
const Home           = React.lazy(() => import("./pages/Home/Home.jsx"));
const IncidentesList = React.lazy(() => import("./pages/Incidentes/IncidentesList.jsx"));
const IncidenteForm  = React.lazy(() => import("./pages/Incidentes/IncidenteForm.jsx"));
const Rondas         = React.lazy(() => import("./pages/Rondas/Rondas.jsx"));
const Accesos        = React.lazy(() => import("./pages/Accesos/Accesos.jsx"));
const Visitas        = React.lazy(() => import("./pages/Visitas/Visitas.jsx"));
const Bitacora       = React.lazy(() => import("./pages/Bitacora/Bitacora.jsx"));
const Supervision    = React.lazy(() => import("./pages/Supervision/Supervision.jsx"));
const Evaluacion     = React.lazy(() => import("./pages/Evaluacion/Evaluacion.jsx"));
const Reportes       = React.lazy(() => import("./pages/Reportes/Reportes.jsx"));
const Chat           = React.lazy(() => import("./pages/Chat/Chat.jsx"));
// arriba de export default function App()...
const RoutesAdminList = React.lazy(() => import("./pages/RutasAdmin/RoutesList.jsx"));
const RouteForm      = React.lazy(() => import("./pages/RutasAdmin/RouteForm.jsx"));
const SLAReports     = React.lazy(() => import("./pages/Reportes/SLA.jsx"));
// Página pública de login (respaldo por si navegan a /login manualmente)
const LoginRedirect  = React.lazy(() => import("./pages/Auth/LoginRedirect.jsx"));

export default function App() {
  return (
    <Suspense fallback={<div className="p-6">Cargando…</div>}>
      <Routes>
        {/* ===== Ruta PÚBLICA para iniciar sesión ===== */}
        <Route path="/login" element={<LoginRedirect />} />

        {/* ===== Rutas PROTEGIDAS (con layout) ===== */}
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Layout><Home /></Layout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/incidentes"
          element={
            <ProtectedRoute>
              <Layout><IncidentesList /></Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/incidentes/nuevo"
          element={
            <ProtectedRoute>
              <Layout><IncidenteForm /></Layout>
            </ProtectedRoute>
          }
        />

        <Route path="/rondas"       element={<ProtectedRoute><Layout><Rondas      /></Layout></ProtectedRoute>} />
        <Route path="/accesos"      element={<ProtectedRoute><Layout><Accesos     /></Layout></ProtectedRoute>} />
        <Route path="/visitas"      element={<ProtectedRoute><Layout><Visitas     /></Layout></ProtectedRoute>} />
        <Route path="/bitacora"     element={<ProtectedRoute><Layout><Bitacora    /></Layout></ProtectedRoute>} />
        <Route path="/supervision"  element={<ProtectedRoute><Layout><Supervision /></Layout></ProtectedRoute>} />
        <Route path="/evaluacion"   element={<ProtectedRoute><Layout><Evaluacion  /></Layout></ProtectedRoute>} />
        <Route path="/reportes"     element={<ProtectedRoute><Layout><Reportes    /></Layout></ProtectedRoute>} />
        <Route path="/chat"         element={<ProtectedRoute><Layout><Chat        /></Layout></ProtectedRoute>} />
        <Route path="/rutas-admin"           element={<ProtectedRoute><Layout><RoutesAdminList /></Layout></ProtectedRoute>} />
        <Route path="/rutas-admin/nueva"     element={<ProtectedRoute><Layout><RouteForm /></Layout></ProtectedRoute>} />
        <Route path="/rutas-admin/:id"       element={<ProtectedRoute><Layout><RouteForm /></Layout></ProtectedRoute>} />

<Route path="/reportes/sla"          element={<ProtectedRoute><Layout><SLAReports /></Layout></ProtectedRoute>} />

        <Route path="*" element={<div className="p-6">No encontrado</div>} />


        
      </Routes>
    </Suspense>
  );
}
