// client/src/pages/Auth/Entry.jsx
import React from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth0 } from "@auth0/auth0-react";

function safeInternalPath(p) {
  return typeof p === "string" && p.startsWith("/") && !p.startsWith("//");
}

export default function Entry() {
  const { search } = useLocation();
  const nav = useNavigate();
  const { isAuthenticated, isLoading, loginWithRedirect, error } = useAuth0();

  // env
  const VITE_ENV = String(import.meta.env.VITE_ENV || "").toLowerCase();
  const MODE = String(import.meta.env.MODE || "").toLowerCase();
  const IS_PROD = VITE_ENV === "production" || MODE === "production";

  // captura ?to=/ruta y guárdalo para el callback
  React.useEffect(() => {
    const qs = new URLSearchParams(search);
    const to = qs.get("to");

    try {
      if (safeInternalPath(to)) sessionStorage.setItem("auth:returnTo", to);
      else sessionStorage.removeItem("auth:returnTo");
    } catch {
      // ignore
    }
  }, [search]);

  // si ya está autenticado, manda a /start (o returnTo lo hará tu callback)
  React.useEffect(() => {
    if (!isLoading && isAuthenticated) {
      nav("/start", { replace: true });
    }
  }, [isLoading, isAuthenticated, nav]);

  // inicia Auth0 login en PROD y también en DEV (si quieres)
  React.useEffect(() => {
    if (isLoading) return;
    if (isAuthenticated) return;

    const audience = import.meta.env.VITE_AUTH0_AUDIENCE || "https://senaf";

    // En DEV podrías permitir /login local, pero si quieres mantener todo en Auth0, déjalo igual.
    // Aquí: en PROD SIEMPRE Auth0.
    (async () => {
      try {
        await loginWithRedirect({
          appState: {
            returnTo: (() => {
              try {
                const rt = sessionStorage.getItem("auth:returnTo");
                return safeInternalPath(rt) ? rt : "/start";
              } catch {
                return "/start";
              }
            })(),
          },
          authorizationParams: {
            audience,
          },
        });
      } catch (e) {
        console.error("[Entry] loginWithRedirect failed:", e?.message || e);
      }
    })();
  }, [isLoading, isAuthenticated, loginWithRedirect]);

  // UI simple mientras redirige
  if (error) {
    return (
      <div className="p-6">
        <div className="font-semibold">Error de autenticación</div>
        <div className="mt-2 text-sm opacity-80">
          {error?.message || "No se pudo iniciar sesión."}
        </div>

        {!IS_PROD && (
          <div className="mt-4">
            <button
              className="underline"
              onClick={() => nav("/login", { replace: true })}
            >
              Ir a login local (DEV)
            </button>
          </div>
        )}
      </div>
    );
  }

  return <div className="p-6">Redirigiendo a inicio de sesión…</div>;
}