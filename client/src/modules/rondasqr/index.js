// helpers para registrar rutas en tu App principal (React-Router)
import React from 'react';
const GuardScanPage = React.lazy(()=> import('./pages/GuardScanPage.jsx'));
const AdminCheckpointsPage = React.lazy(()=> import('./pages/AdminCheckpointsPage.jsx'));
const AdminPlansPage = React.lazy(()=> import('./pages/AdminPlansPage.jsx'));
const ReportsPage = React.lazy(()=> import('./pages/ReportsPage.jsx'));
const DashboardPage = React.lazy(()=> import('./pages/DashboardPage.jsx'));


export const rondasqrRoutes = [
{ path: '/rondasqr', element: <DashboardPage/> },
{ path: '/rondasqr/scan', element: <GuardScanPage/> },
{ path: '/rondasqr/admin/checkpoints', element: <AdminCheckpointsPage/> },
{ path: '/rondasqr/admin/plans', element: <AdminPlansPage/> },
{ path: '/rondasqr/reports', element: <ReportsPage/> }
];