// client/src/components/AuthBridge.jsx
import { useEffect } from "react";
import { useAuth0 } from "@auth0/auth0-react";

import { attachAuth0 } from "../lib/api.js";
import { attachRondasAuth } from "../modules/rondasqr/api/rondasqrApi.js";

export default function AuthBridge() {
  const { isAuthenticated, getAccessTokenSilently } = useAuth0();

  useEffect(() => {
    const wireProviders = async () => {
      if (!isAuthenticated) {
        attachAuth0(null);
        attachRondasAuth(null);
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

      attachAuth0(provider);
      attachRondasAuth(provider);

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
