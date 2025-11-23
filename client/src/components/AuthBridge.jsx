import { useEffect } from "react";
import { useAuth0 } from "@auth0/auth0-react";

// Inyectores de token a tus capas de red
import { attachAuth0 } from "../lib/api.js";
import { attachRondasAuth } from "../modules/rondasqr/api/rondasqrApi.js";
import { attachIamAuth } from "../iam/api/iamApi.js";

/**
 * No renderiza UI: solo registra (o limpia) proveedores de token.
 * Mantiene sincronizadas todas las libs de red con el access_token de Auth0.
 */
export default function AuthBridge() {
  const { isAuthenticated, getAccessTokenSilently } = useAuth0();

  useEffect(() => {
    const wireProviders = async () => {
      if (!isAuthenticated) {
        // Si el usuario no está autenticado, limpia proveedores
        attachAuth0(null);
        attachRondasAuth(null);
        attachIamAuth(null);
        return;
      }

      // Un único provider para todas tus libs
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
      attachIamAuth(provider); // 👈 IAM también
    };

    wireProviders();
  }, [isAuthenticated, getAccessTokenSilently]);

  return null;
}
