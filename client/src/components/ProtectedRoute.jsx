// client/src/components/ProtectedRoute.jsx
import React from "react";
import { useAuth0 } from "@auth0/auth0-react";
import { useLocation } from "react-router-dom";

export default function ProtectedRoute({ children }) {
  const { isAuthenticated, isLoading, loginWithRedirect, error } = useAuth0();
  const location = useLocation();

  React.useEffect(() => {
    if (isLoading) return;

    // ¿viene error en la URL o desde Auth0?
    const params = new URLSearchParams(location.search);
    const urlError = params.get("error");
    const urlDesc  = params.get("error_description") || "";
    const denied   =
      urlError === "access_denied" ||
      /did not authorize/i.test(urlDesc) ||
      error?.error === "access_denied";

    if (!isAuthenticated) {
      // si hubo "rechazar", limpiar la URL y volver al login
      if (denied) {
        window.history.replaceState({}, document.title, location.pathname);
      }
      loginWithRedirect({
        authorizationParams: {
          audience: import.meta.env.VITE_AUTH0_AUDIENCE,
          prompt: "login", // fuerza a mostrar la pantalla de login
        },
        appState: { returnTo: location.pathname }, // vuelve a donde estaba
      });
    }
  }, [isLoading, isAuthenticated, loginWithRedirect, location, error]);

  if (isLoading) return <div className="p-6">Cargando…</div>;
  if (!isAuthenticated) return null;
  return children;
}
// Componente que protege las rutas y redirige al login si no está autenticado
