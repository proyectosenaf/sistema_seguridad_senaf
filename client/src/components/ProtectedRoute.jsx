// client/src/components/ProtectedRoute.jsx
import React from "react";
import { useAuth0 } from "@auth0/auth0-react";
import { useLocation } from "react-router-dom";

export default function ProtectedRoute({ children }) {
  const { isAuthenticated, isLoading, loginWithRedirect, error } = useAuth0();
  const location = useLocation();

  // Permite saltar auth en desarrollo: VITE_SKIP_VERIFY=1
  const skipVerify = String(import.meta.env.VITE_SKIP_VERIFY || "") === "1";

  // Evita múltiples redirecciones seguidas
  const redirectingRef = React.useRef(false);

  React.useEffect(() => {
    if (skipVerify) return;        // no hacemos nada si está desactivado
    if (isLoading) return;         // esperamos a que Auth0 cargue

    // ¿viene error en la URL o desde Auth0?
    const params   = new URLSearchParams(location.search);
    const urlError = params.get("error");
    const urlDesc  = params.get("error_description") || "";
    const denied   =
      urlError === "access_denied" ||
      /did not authorize/i.test(urlDesc) ||
      error?.error === "access_denied";

    if (!isAuthenticated && !redirectingRef.current) {
      redirectingRef.current = true;

      // si hubo "rechazar", limpiar la URL y volver al login
      if (denied) {
        window.history.replaceState({}, document.title, location.pathname);
      }

      loginWithRedirect({
        authorizationParams: {
          audience: import.meta.env.VITE_AUTH0_AUDIENCE,
          // Si quieres forzar la pantalla de login SIEMPRE, descomenta:
          // prompt: "login",
        },
        appState: { returnTo: location.pathname + location.search },
      }).finally(() => {
        // Permitimos futuros intentos si el usuario vuelve aquí
        redirectingRef.current = false;
      });
    }
  }, [skipVerify, isLoading, isAuthenticated, loginWithRedirect, location, error]);

  if (skipVerify) return children;
  if (isLoading)  return <div className="p-6">Cargando…</div>;
  if (!isAuthenticated) return null;
  return children;
}
// Componente que protege las rutas y redirige al login si no está autenticado
