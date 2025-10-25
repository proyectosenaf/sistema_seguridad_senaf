import React, { Suspense, lazy } from "react";
import { Routes, Route, Navigate } from "react-router-dom";

// Guard / Panel unificado
const ScanPage = lazy(() => import("./guard/ScanPage.jsx"));

// Reportes (supervisor)
const ReportsPage = lazy(() => import("./supervisor/ReportsPage.jsx"));

// Admin (ajusta si usas rutas/páginas diferentes)
const AdminHub = lazy(() => import("./admin/AdminHub.jsx"));
const CreateRoundsPage = lazy(() => import("./admin/CreateRoundsPage.jsx"));
const EditRoundsPage = lazy(() => import("./admin/EditRoundsPage.jsx"));
const LoadRoundsPage = lazy(() => import("./admin/LoadRoundsPage.jsx"));

/**
 * Rutas INTERNAS del módulo, montadas en /rondasqr/* desde el router principal.
 * Ejemplo en App:  <Route path="/rondasqr/*" element={<RondasqrModule />} />
 */
export function RondasqrModule() {
  return (
    <Suspense fallback={null}>
      <Routes>
        {/* /rondasqr → /rondasqr/scan */}
        <Route index element={<Navigate to="scan" replace />} />

        {/* Panel unificado */}
        <Route path="scan" element={<ScanPage />} />
        {/* Sub-vistas del panel (usan el mismo componente) */}
        <Route path="scan/qr" element={<ScanPage />} />
        <Route path="scan/msg" element={<ScanPage />} />
        <Route path="scan/fotos" element={<ScanPage />} />

        {/* Reportes */}
        <Route path="reports" element={<ReportsPage />} />

        {/* Admin */}
        <Route path="admin" element={<AdminHub />} />
        <Route path="admin/create" element={<CreateRoundsPage />} />
        <Route path="admin/edit" element={<EditRoundsPage />} />
        <Route path="admin/load" element={<LoadRoundsPage />} />

        {/* Catch-all del módulo */}
        <Route path="*" element={<Navigate to="scan" replace />} />
      </Routes>
    </Suspense>
  );
}

/**
 * Redirecciones LEGACY a nivel raíz (opcional).
 * Debes añadir estas rutas en el router principal (no dentro del módulo),
 * por ejemplo junto a otros <Route path="..."> globales.
 *
 * Ejemplo en App:
 *   {rondasqrLegacyRoutes.map(r => (
 *      <Route key={r.path} path={r.path} element={r.element} />
 *   ))}
 */
export const rondasqrLegacyRoutes = [
  { path: "/rondasqrpanel",  element: <Navigate to="/rondasqr/scan" replace /> },
  { path: "/rondasqr/panel", element: <Navigate to="/rondasqr/scan" replace /> },
];
