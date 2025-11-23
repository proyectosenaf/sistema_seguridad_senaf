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
      if (!isAuthenticated) {
        // 🔹 Usuario no autenticado: limpiamos TODO
        attachAuth0(null);
        attachRondasAuth(null);
        if (typeof window !== "undefined") {
          delete window.__iamTokenProvider;
        }
        return;
      }

      // 🔹 Un único provider que usaremos en:
      // - api.js (axios)
      // - rondasqrApi
      // - iamApi (vía window.__iamTokenProvider)
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

      // Conectamos el provider a las diferentes capas
      attachAuth0(provider);
      attachRondasAuth(provider);

      // 🔹 NUEVO: provider global para iamApi.js
      if (typeof window !== "undefined") {
        window.__iamTokenProvider = provider;
      }
    };

    wireProviders();

    // Cleanup al desmontar / cambiar auth
    return () => {
      cancelled = true;
      attachAuth0(null);
      attachRondasAuth(null);
      if (typeof window !== "undefined") {
        delete window.__iamTokenProvider;
      }
    };
  }, [isAuthenticated, getAccessTokenSilently]);

  return null;
}
