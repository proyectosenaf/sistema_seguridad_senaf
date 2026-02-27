import React from "react";
import { useNavigate } from "react-router-dom";

function safeInternalPath(p) {
  return typeof p === "string" && p.startsWith("/") && !p.startsWith("//");
}

export default function LoginRedirect() {
  const nav = useNavigate();

  React.useEffect(() => {
    const returnTo = (() => {
      try {
        const raw = sessionStorage.getItem("auth:returnTo");
        return safeInternalPath(raw) ? raw : "/";
      } catch {
        return "/";
      }
    })();

    // En login local, pasamos returnTo por query (opcional) y/o mantenemos sessionStorage
    try {
      sessionStorage.setItem("auth:returnTo", returnTo);
    } catch {
      // ignore
    }

    nav(`/login?to=${encodeURIComponent(returnTo)}`, { replace: true });
  }, [nav]);

  return <div className="p-6">Redirigiendo a inicio de sesión…</div>;
}