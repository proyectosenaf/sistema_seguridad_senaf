import React from "react";
import { useAuth0 } from "@auth0/auth0-react";

function safeInternalPath(p) {
  return typeof p === "string" && p.startsWith("/") && !p.startsWith("//");
}

export default function LoginRedirect() {
  const { loginWithRedirect, isLoading } = useAuth0();

  React.useEffect(() => {
    if (isLoading) return;

    const returnTo = (() => {
      try {
        const raw = sessionStorage.getItem("auth:returnTo");
        return safeInternalPath(raw) ? raw : "/";
      } catch {
        return "/";
      }
    })();

    loginWithRedirect({
      authorizationParams: {
        prompt: "login", // ✅ fuerza SIEMPRE
        audience: import.meta.env.VITE_AUTH0_AUDIENCE,
        scope: "openid profile email",
      },
      // Nota: appState lo leeremos en callback via sessionStorage (más confiable)
      appState: { returnTo, force: true },
    }).catch(() => {});
  }, [isLoading, loginWithRedirect]);

  return <div className="p-6">Redirigiendo a inicio de sesión…</div>;
}
