// client/src/components/AuthBridge.jsx
import React from "react";
import { useAuth0 } from "@auth0/auth0-react";
import { attachAuth0 } from "../lib/api.js";

export default function AuthBridge() {
  const { getAccessTokenSilently, isAuthenticated } = useAuth0();

  React.useEffect(() => {
    if (!isAuthenticated) {
      // si el usuario salió, limpiamos el provider de token
      attachAuth0(null);
      return;
    }

    // registra el proveedor de token para axios
    attachAuth0(async () => {
      try {
        const token = await getAccessTokenSilently({
          authorizationParams: {
            audience: import.meta.env.VITE_AUTH0_AUDIENCE,
            scope: "openid profile email", // agrega scopes RBAC aquí si los usas
          },
        });
        return token || null;
      } catch (err) {
        console.warn("[AuthBridge] no se pudo obtener token:", err?.message || err);
        return null;
      }
    });
  }, [isAuthenticated, getAccessTokenSilently]);

  return null; // no renderiza UI, solo configura el token
}
