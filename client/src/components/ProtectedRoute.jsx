// client/src/components/ProtectedRoute.jsx
import React, { useMemo } from "react";
import { useLocation, Navigate } from "react-router-dom";
import { useAuth } from "../pages/auth/AuthProvider.jsx";

// localhost?
const IS_LOCALHOST =
  typeof window !== "undefined" &&
  (window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1");

// entorno
const VITE_ENV = String(import.meta.env.VITE_ENV || "").toLowerCase();
const MODE = String(import.meta.env.MODE || "").toLowerCase();
const IS_PROD = VITE_ENV === "production" || MODE === "production";

export default function ProtectedRoute({ children }) {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  // Solo permitir “sin auth” en DEV/local. Nunca en PROD.
  const skipVerify = useMemo(() => {
    if (IS_PROD) return false;
    if (!IS_LOCALHOST) return false;
    return (
      String(import.meta.env.VITE_SKIP_VERIFY || "") === "1" ||
      String(import.meta.env.VITE_DISABLE_AUTH || "") === "1"
    );
  }, []);

  // ✅ Localhost con modo libre (DEV)
  if (skipVerify) return <>{children}</>;

  // ✅ Loading
  if (isLoading) return <div className="p-6">Cargando…</div>;

  // ✅ Fallback: si AuthProvider aún no “marca” authenticated pero ya hay token
  const token =
    localStorage.getItem("senaf_token") || localStorage.getItem("token");

  // ✅ No autenticado: manda a /login y guarda returnTo
  if (!isAuthenticated && !token) {
    const returnTo = location.pathname + location.search;
    return (
      <Navigate
        to="/login"
        replace
        state={{ returnTo }}
      />
    );
  }

  return <>{children}</>;
}