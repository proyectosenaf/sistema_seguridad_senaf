import React from "react";
import { useNavigate } from "react-router-dom";
import { useAuth0 } from "@auth0/auth0-react";

function safeInternalPath(p) {
  return typeof p === "string" && p.startsWith("/") && !p.startsWith("//");
}

export default function AuthCallback() {
  const nav = useNavigate();
  const { isAuthenticated, isLoading, getAccessTokenSilently, user } = useAuth0();

  React.useEffect(() => {
    let alive = true;

    (async () => {
      if (isLoading) return;
      if (!isAuthenticated) return;

      // 1) token
      let token = null;
      try {
        token = await getAccessTokenSilently({
          authorizationParams: { audience: import.meta.env.VITE_AUTH0_AUDIENCE },
        });
      } catch {}

      // 2) /me (IAM)
      const RAW = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000/api";
      const ROOT = RAW.replace(/\/api\/?$/, "").replace(/\/$/, "");
      const meUrl = `${ROOT}/api/iam/v1/me`;

      let me = null;
      try {
        const res = await fetch(meUrl, {
          credentials: "include",
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (res.ok) me = await res.json();
      } catch {}

      // 3) returnTo
      const returnTo = (() => {
        try {
          const raw = sessionStorage.getItem("auth:returnTo");
          return safeInternalPath(raw) ? raw : null;
        } catch {
          return null;
        }
      })();

      // 4) destino
      // Si tu backend marca externos: me.kind === "external"
      const kind = me?.kind || "internal";

      let dest = "/";
      if (returnTo) dest = returnTo;
      else if (kind === "external") dest = "/portal/citas";
      else dest = "/start";

      // Limpia returnTo para no “pegarse”
      try {
        sessionStorage.removeItem("auth:returnTo");
      } catch {}

      if (alive) nav(dest, { replace: true });
    })();

    return () => {
      alive = false;
    };
  }, [isAuthenticated, isLoading, getAccessTokenSilently, nav, user]);

  return <div className="p-6">Procesando acceso…</div>;
}
  