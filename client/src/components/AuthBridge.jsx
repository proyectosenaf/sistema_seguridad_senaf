import React from "react";
import { useAuth0 } from "@auth0/auth0-react";
import { setAuthToken } from "../lib/api.js";

export default function AuthBridge() {
  const { getAccessTokenSilently, isAuthenticated } = useAuth0();

  React.useEffect(() => {
    // Registra la función que devolverá el token para todas las peticiones axios
    setAuthToken(() =>
      getAccessTokenSilently({
        authorizationParams: {
          audience: import.meta.env.VITE_AUTH0_AUDIENCE,
          scope: "openid profile email", // agrega aquí tus scopes RBAC si usas: "visitas:read visitas:write chat:read chat:write"
        },
      })
    );
  }, [getAccessTokenSilently, isAuthenticated]);

  return null;
}

// Este componente no renderiza nada, solo configura el token para las llamadas API