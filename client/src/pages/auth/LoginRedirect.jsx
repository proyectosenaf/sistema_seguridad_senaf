// client/src/pages/auth/LoginRedirect.jsx
import React from "react";
import { useLocation, useNavigate } from "react-router-dom";

function safeInternalPath(p) {
  return typeof p === "string" && p.startsWith("/") && !p.startsWith("//");
}

export default function LoginRedirect() {
  const nav = useNavigate();
  const loc = useLocation();

  React.useEffect(() => {
    const qs = new URLSearchParams(loc.search || "");
    const fromQuery = qs.get("to");

    const fromSession = (() => {
      try {
        return sessionStorage.getItem("auth:returnTo");
      } catch {
        return null;
      }
    })();

    const returnTo =
      (safeInternalPath(fromQuery) && fromQuery) ||
      (safeInternalPath(fromSession) && fromSession) ||
      "/";

    try {
      sessionStorage.setItem("auth:returnTo", returnTo);
    } catch {
      // ignore
    }

    nav(`/login?to=${encodeURIComponent(returnTo)}`, { replace: true });
  }, [nav, loc.search]);

  return <div className="p-6">Redirigiendo a inicio de sesión…</div>;
}