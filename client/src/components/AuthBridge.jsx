import { useEffect } from "react";
import { useAuth0 } from "@auth0/auth0-react";

import { attachAuth0 } from "../lib/api.js";
import { attachRondasAuth } from "../modules/rondasqr/api/rondasqrApi.js";

export default function AuthBridge() {
  const { isAuthenticated, getAccessTokenSilently } = useAuth0();

  useEffect(() => {
    const wireProviders = async () => {
      if (!isAuthenticated) {
        // limpiar providers si no hay sesión
        attachAuth0(null);
        attachRondasAuth(null);
        if (typeof window !== "undefined") {
          window.__iamTokenProvider = null;
        }
        return;
      }

      // único provider para TODAS las libs
      const provider = async () => {
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

      // API general
      attachAuth0(provider);
      // Rondas
      attachRondasAuth(provider);
      // 🔹 IAM (lo usa iamApi.js -> window.__iamTokenProvider)
      if (typeof window !== "undefined") {
        window.__iamTokenProvider = provider;
      }
    };

    wireProviders();

    return () => {
      if (typeof window !== "undefined") {
        window.__iamTokenProvider = null;
      }
    };
  }, [isAuthenticated, getAccessTokenSilently]);

  return null;
}
