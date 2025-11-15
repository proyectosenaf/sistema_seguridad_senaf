// client/src/pages/Auth/AuthCallback.jsx
import React, { useEffect } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import { useNavigate } from "react-router-dom";

export default function AuthCallback() {
  const { isLoading, isAuthenticated, error } = useAuth0();
  const nav = useNavigate();

  useEffect(() => {
    if (isLoading) return;

    if (error) {
      console.error("[AuthCallback] Error en callback Auth0:", error);
      // si quieres, podrías mandar a una página de error
      return;
    }

    if (isAuthenticated) {
      // Después de loguearse con éxito, mándalo al “router por rol”
      nav("/start", { replace: true });
    } else {
      // Si algo salió mal, reintenta login
      nav("/login", { replace: true });
    }
  }, [isLoading, isAuthenticated, error, nav]);

  return (
    <div className="min-h-[60vh] grid place-items-center p-6">
      <div className="text-center">
        <div className="text-lg font-semibold mb-2">
          Procesando inicio de sesión…
        </div>
        <div className="opacity-70">
          Espera un momento mientras completamos la autenticación.
        </div>
      </div>
    </div>
  );
}
