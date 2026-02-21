import { useEffect } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import { attachAuth0 } from "../lib/api.js";

export default function AttachAuth0ToApi() {
  const { isAuthenticated, getAccessTokenSilently } = useAuth0();

  useEffect(() => {
    // Provider que Axios va a usar en cada request
    attachAuth0(async () => {
      if (!isAuthenticated) return null;

      // 👇 IMPORTANTE: fuerza audience correcto
      const token = await getAccessTokenSilently({
        authorizationParams: {
          audience: import.meta.env.VITE_AUTH0_AUDIENCE || "https://senaf",
        },
      });

      return token;
    });
  }, [isAuthenticated, getAccessTokenSilently]);

  return null;
}