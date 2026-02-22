// client/src/components/ProtectedRoute.jsx
import React from "react";
import { useAuth0 } from "@auth0/auth0-react";
import { useLocation, Navigate } from "react-router-dom";

// localhost?
const IS_LOCALHOST =
  typeof window !== "undefined" &&
  (window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1");

const VITE_ENV = String(import.meta.env.VITE_ENV || "").toLowerCase();
const MODE = String(import.meta.env.MODE || "").toLowerCase();
const IS_PROD = VITE_ENV === "production" || MODE === "production";

export default function ProtectedRoute({ children }) {
  const { isAuthenticated, isLoading, loginWithRedirect, error } = useAuth0();
  const location = useLocation();

  // Solo permitir “sin auth” en localhost y con env explícita
  const skipVerify =
    IS_LOCALHOST &&
    (String(import.meta.env.VITE_SKIP_VERIFY || "") === "1" ||
      String(import.meta.env.VITE_DISABLE_AUTH || "") === "1");

  const redirectingRef = React.useRef(false);
  const audience = import.meta.env.VITE_AUTH0_AUDIENCE || "https://senaf";

  // En PROD: nunca usar token local (evita HS256)
  // En DEV: si quieres, puedes permitir el token local SOLO cuando skipVerify=false,
  // pero NO lo recomiendo. Aquí lo ignoramos siempre para mantener un solo flujo.
  React.useEffect(() => {
    if (skipVerify) return; // modo libre en localhost
    if (isLoading) return;
    if (isAuthenticated) return;

    // Evitar loops si Auth0 devolvió access_denied
    const params = new URLSearchParams(location.search);
    const urlError = params.get("error");
    const urlDesc = params.get("error_description") || "";

    const denied =
      urlError === "access_denied" ||
      /did not authorize/i.test(urlDesc) ||
      error?.error === "access_denied";

    if (!redirectingRef.current) {
      redirectingRef.current = true;

      // Limpia query string si hubo access_denied
      if (denied) {
        window.history.replaceState({}, document.title, location.pathname);
      }

      // Si estás en PROD o quieres forzar Auth0: redirect a Auth0
      loginWithRedirect({
        appState: { returnTo: location.pathname + location.search },
        authorizationParams: { audience },
      }).finally(() => {
        // Nota: normalmente Auth0 redirige fuera, pero esto previene dobles llamados
        redirectingRef.current = false;
      });
    }
  }, [
    skipVerify,
    isLoading,
    isAuthenticated,
    loginWithRedirect,
    location,
    error,
    audience,
  ]);

  // ✅ Localhost con modo libre
  if (skipVerify) return <>{children}</>;

  // ✅ Loading
  if (isLoading) return <div className="p-6">Cargando…</div>;

  // ✅ No autenticado: manda a /entry (que inicia Auth0 login)
  // (esto evita que alguien llegue directo a /login y cree loops)
  if (!isAuthenticated) {
    const to = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/entry?to=${to}`} replace />;
  }

  return <>{children}</>;
}