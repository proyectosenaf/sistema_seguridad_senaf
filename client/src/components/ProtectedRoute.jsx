// client/src/components/ProtectedRoute.jsx
import React from "react";
import { useLocation, Navigate } from "react-router-dom";
import { useAuth } from "./pages/auth/AuthProvider.jsx";

// localhost?
const IS_LOCALHOST =
  typeof window !== "undefined" &&
  (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1");

export default function ProtectedRoute({ children }) {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  // Solo permitir “sin auth” en localhost y con env explícita
  const skipVerify =
    IS_LOCALHOST &&
    (String(import.meta.env.VITE_SKIP_VERIFY || "") === "1" ||
      String(import.meta.env.VITE_DISABLE_AUTH || "") === "1");

  // ✅ Localhost con modo libre (DEV)
  if (skipVerify) return <>{children}</>;

  // ✅ Loading
  if (isLoading) return <div className="p-6">Cargando…</div>;

  // ✅ No autenticado: manda a /login y guarda returnTo
  if (!isAuthenticated) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ returnTo: location.pathname + location.search }}
      />
    );
  }

  return <>{children}</>;
}
