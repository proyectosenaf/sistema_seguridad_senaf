// client/src/components/AuthBridge.jsx
import { useEffect } from "react";
import { useAuth0 } from "@auth0/auth0-react";

import { attachAuth0 } from "../lib/api.js";
import { attachRondasAuth } from "../modules/rondasqr/api/rondasqrApi.js";
// 👇 NUEVO: importar attachIamAuth
import { attachIamAuth } from "../iam/api/iamApi.js";

export default function AuthBridge() {
  const { isAuthenticated, getAccessTokenSilently } = useAuth0();

  useEffect(() => {
    const wireProviders = async () => {
      if (!isAuthenticated) {
        // Sin sesión → limpiar todos los providers
        attachAuth0(null);
        attachRondasAuth(null);
        attachIamAuth(null);

        if (typeof window !== "undefined") {
          window.__iamTokenProvider = null;
        }
        return;
      }

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

      // 👉 inyectar provider en TODAS las capas
      attachAuth0(provider);
      attachRondasAuth(provider);
      attachIamAuth(provider);

      if (typeof window !== "undefined") {
        window.__iamTokenProvider = provider; // opcional, por compat
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
