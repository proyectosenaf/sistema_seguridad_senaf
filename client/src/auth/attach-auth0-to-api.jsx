// client/src/auth/attach-auth0-to-api.jsx
import { useEffect } from "react";
import { useAuth0 } from "@auth0/auth0-react";

import { attachAuth0 } from "../lib/api.js";
import { attachIamAuth } from "../iam/api/iamApi.js";
import { attachRondasAuth } from "../modules/rondasqr/api/rondasqrApi.js";

function looksLikeJwt(t) {
  return typeof t === "string" && t.split(".").length === 3;
}

function isHs256(token) {
  try {
    if (!looksLikeJwt(token)) return false;
    const headerB64 = token.split(".")[0];
    const json = JSON.parse(atob(headerB64.replace(/-/g, "+").replace(/_/g, "/")));
    return String(json?.alg || "").toUpperCase() === "HS256";
  } catch {
    return false;
  }
}

export default function AttachAuth0ToApi() {
  const { isAuthenticated, getAccessTokenSilently } = useAuth0();
  const audience = import.meta.env.VITE_AUTH0_AUDIENCE || "https://senaf";

  useEffect(() => {
    // ✅ Si quedó token local HS256 guardado, bórralo para que NO contamine llamadas
    try {
      const local = localStorage.getItem("token");
      if (local && isHs256(local)) {
        localStorage.removeItem("token");
        console.warn("[AttachAuth0ToApi] Token local HS256 eliminado (incompatible con Auth0/JWKS).");
      }
    } catch {}

    // Provider único que usarán axios + IAM(fetch) + rondas
    const provider = async () => {
      if (!isAuthenticated) return null;

      const token = await getAccessTokenSilently({
        authorizationParams: { audience },
      });

      return token || null;
    };

    attachAuth0(isAuthenticated ? provider : null);
    attachIamAuth(isAuthenticated ? provider : null);
    attachRondasAuth(isAuthenticated ? provider : null);
  }, [isAuthenticated, getAccessTokenSilently, audience]);

  return null;
}