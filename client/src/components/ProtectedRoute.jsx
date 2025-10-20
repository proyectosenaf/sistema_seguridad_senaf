// client/src/components/ProtectedRoute.jsx
import React from "react";
import { useAuth0 } from "@auth0/auth0-react";
import { useLocation } from "react-router-dom";

export default function ProtectedRoute({ children }) {
  const { isAuthenticated, isLoading, loginWithRedirect, error } = useAuth0();
  const location = useLocation();

  const skipVerify = String(import.meta.env.VITE_SKIP_VERIFY || "") === "1";
  const redirectingRef = React.useRef(false);
  const audience = import.meta.env.VITE_AUTH0_AUDIENCE;

  React.useEffect(() => {
    if (skipVerify) return;
    if (isLoading) return;

    const params = new URLSearchParams(location.search);
    const urlError = params.get("error");
    const urlDesc  = params.get("error_description") || "";
    const denied   =
      urlError === "access_denied" ||
      /did not authorize/i.test(urlDesc) ||
      error?.error === "access_denied";

    if (!isAuthenticated && !redirectingRef.current) {
      redirectingRef.current = true;

      if (denied) {
        window.history.replaceState({}, document.title, location.pathname);
      }

      const opts = {
        appState: { returnTo: location.pathname + location.search },
      };
      if (audience) opts.authorizationParams = { audience };

      loginWithRedirect(opts).finally(() => {
        redirectingRef.current = false;
      });
    }
  }, [skipVerify, isLoading, isAuthenticated, loginWithRedirect, location, error, audience]);

  if (skipVerify) return children;
  if (isLoading)  return <div className="p-6">Cargando…</div>;
  if (!isAuthenticated) return null;
  return children;
}
