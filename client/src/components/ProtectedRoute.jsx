// client/src/components/ProtectedRoute.jsx
import React from "react";
import { useAuth0 } from "@auth0/auth0-react";
import { useLocation } from "react-router-dom";

// 🌍 Detectar si estamos en localhost
const IS_LOCALHOST =
  typeof window !== "undefined" &&
  (window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1");

export default function ProtectedRoute({ children }) {
  const { isAuthenticated, isLoading, loginWithRedirect, error } = useAuth0();
  const location = useLocation();

  // 🔓 En localhost SIEMPRE saltamos Auth0.
  // Además, fuera de localhost se puede forzar con VITE_SKIP_VERIFY=1 si quisieras.
  const skipVerify =
    IS_LOCALHOST ||
    String(import.meta.env.VITE_SKIP_VERIFY || "") === "1";

  const redirectingRef = React.useRef(false);
  const audience = import.meta.env.VITE_AUTH0_AUDIENCE;

  React.useEffect(() => {
    // En modo “sin auth” (localhost o VITE_SKIP_VERIFY=1) → no hacer nada
    if (skipVerify) return;
    if (isLoading) return;

    const params = new URLSearchParams(location.search);
    const urlError = params.get("error");
    const urlDesc = params.get("error_description") || "";

    const denied =
      urlError === "access_denied" ||
      /did not authorize/i.test(urlDesc) ||
      error?.error === "access_denied";

    if (!isAuthenticated && !redirectingRef.current) {
      redirectingRef.current = true;

      if (denied) {
        // limpiar querystring de error
        window.history.replaceState({}, document.title, location.pathname);
      }

      const opts = {
        appState: { returnTo: location.pathname + location.search },
      };
      if (audience) {
        opts.authorizationParams = { audience };
      }

      loginWithRedirect(opts).finally(() => {
        redirectingRef.current = false;
      });
    }
  }, [skipVerify, isLoading, isAuthenticated, loginWithRedirect, location, error, audience]);

  // 🔓 Localhost o modo libre → no exigir login
  if (skipVerify) return <>{children}</>;

  // 🔐 Flujo normal con Auth0
  if (isLoading) return <div className="p-6">Cargando…</div>;
  if (!isAuthenticated) return null;

  return <>{children}</>;
}
