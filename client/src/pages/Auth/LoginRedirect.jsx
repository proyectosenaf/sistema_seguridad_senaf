// client/src/pages/Auth/LoginRedirect.jsx
import React, { useEffect } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import { useNavigate, useLocation } from "react-router-dom";

/**
 * Página pública que dispara el login de Auth0.
 * Si ya estás autenticado y entras a /login, te devuelve al panel principal (/).
 */
export default function LoginRedirect() {
  const { loginWithRedirect, isAuthenticated } = useAuth0();
  const nav = useNavigate();
  const { state } = useLocation(); // opcional: { returnTo: "/ruta" }

  useEffect(() => {
    (async () => {
      if (isAuthenticated) {
        nav(state?.returnTo || "/", { replace: true });
        return;
      }
      try {
        await loginWithRedirect({
          authorizationParams: {
            // ✅ Al volver del login, caemos en /start (ahí se redirige por rol)
            redirect_uri: `${window.location.origin}/start`,
            prompt: "login",
            screen_hint: "login",
          },
        });
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error("Error en loginWithRedirect:", err);
      }
    })();
  }, [isAuthenticated, loginWithRedirect, nav, state]);

  return (
    <div className="min-h-[60vh] grid place-items-center p-6">
      <div className="text-center">
        <div className="text-lg font-semibold mb-2">Redirigiendo al inicio de sesión…</div>
        <div className="opacity-70">Si no sucede nada, recarga la página.</div>
      </div>
    </div>
  );
}
