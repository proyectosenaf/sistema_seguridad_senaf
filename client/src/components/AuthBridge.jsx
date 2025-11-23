// client/src/components/AuthBridge.jsx
import { useEffect } from "react";
import { useAuth0 } from "@auth0/auth0-react";

// Inyectores de token a tus capas de red
import { attachAuth0 } from "../lib/api.js";
import { attachRondasAuth } from "../modules/rondasqr/api/rondasqrApi.js";

/**
 * No renderiza UI: solo registra (o limpia) proveedores de token.
 * Mantiene sincronizadas todas las libs de red con el access_token de Auth0.
 */
export default function AuthBridge() {
  const { isAuthenticated, getAccessTokenSilently } = useAuth0();

  useEffect(() => {
    let cancelled = false;

    const wireProviders = async () => {
      // 🔴 Si NO hay sesión: limpiar todo
      if (!isAuthenticated) {
        attachAuth0(null);
        attachRondasAuth(null);
        if (typeof window !== "undefined") {
          window.__iamTokenProvider = undefined;
        }
        return;
      }

      // ✅ Provider único para TODAS las libs (axios, rondasqrApi, iamApi)
      const provider = async () => {
        if (cancelled) return null;
        try {
          const token = await getAccessTokenSilently({
            authorizationParams: {
              audience: import.meta.env.VITE_AUTH0_AUDIENCE,
              scope: "openid profile email offline_access",
            },
          });
          return token || null;
        } catch (err) {
          console.warn(
            "[AuthBridge] no se pudo obtener token:",
            err?.message || err
          );
          return null;
        }
      };

      // 👉 Inyectar en tus capas de red existentes
      attachAuth0(provider);
      attachRondasAuth(provider);

      // 👉 NUEVO: exponer provider para iamApi
      if (typeof window !== "undefined") {
        window.__iamTokenProvider = provider;
      }
    };

    wireProviders();

    // cleanup al desmontar / cambiar sesión
    return () => {
      cancelled = true;
      attachAuth0(null);
      attachRondasAuth(null);
      if (typeof window !== "undefined") {
        window.__iamTokenProvider = undefined;
      }
    };
  }, [isAuthenticated, getAccessTokenSilently]);

  return null;
}
