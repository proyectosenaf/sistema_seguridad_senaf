import React, { useEffect, useMemo } from "react";
import { useLocation, Navigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
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

const RETURN_TO_KEY = "auth:returnTo";

function readAnyToken() {
  try {
    return (
      localStorage.getItem("senaf_token") ||
      localStorage.getItem("token") ||
      ""
    );
  } catch {
    return "";
  }
}

export default function ProtectedRoute({ children }) {
  const { t } = useTranslation();
  const { isAuthenticated, isLoading, user, token } = useAuth();
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

  const fallbackToken = readAnyToken();
  const effectiveToken = String(token || fallbackToken || "").trim();
  const hasUserIdentity = !!String(user?.email || "").trim();
  const isActuallyAuthenticated =
    !!isAuthenticated || !!effectiveToken || hasUserIdentity;

  useEffect(() => {
    if (skipVerify) return;
    if (isLoading) return;
    if (isActuallyAuthenticated) return;

    const returnTo = location.pathname + location.search;
    try {
      sessionStorage.setItem(RETURN_TO_KEY, returnTo);
    } catch {
      // ignore
    }
  }, [
    skipVerify,
    isLoading,
    isActuallyAuthenticated,
    location.pathname,
    location.search,
  ]);

  // ✅ Localhost con modo libre (DEV)
  if (skipVerify) return <>{children}</>;

  // ✅ Loading
  if (isLoading) {
    return <div className="p-6">{t("system.loading")}</div>;
  }

  // ✅ No autenticado: manda a /login y guarda returnTo
  if (!isActuallyAuthenticated) {
    const returnTo = location.pathname + location.search;

    return <Navigate to="/login" replace state={{ returnTo }} />;
  }

  return <>{children}</>;
}