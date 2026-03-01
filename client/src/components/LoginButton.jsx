// client/src/components/LoginButton.jsx
import React from "react";
import { useNavigate } from "react-router-dom";

function safeInternalPath(p) {
  return typeof p === "string" && p.startsWith("/") && !p.startsWith("//");
}

export default function LoginButton({
  label = "Iniciar sesión",
  className = "px-4 py-2 bg-blue-600 text-white rounded-xl shadow hover:brightness-110 active:scale-[.98]",
  returnTo, // opcional: fuerza un destino específico
}) {
  const navigate = useNavigate();

  const handleLogin = () => {
    const desired =
      safeInternalPath(returnTo)
        ? returnTo
        : (window.location.pathname + window.location.search);

    try {
      sessionStorage.setItem("auth:returnTo", desired);
    } catch {
      // ignore
    }

    // Pasamos también por query para que sea visible y consistente
    navigate(`/login?to=${encodeURIComponent(desired)}`);
  };

  return (
    <button onClick={handleLogin} className={className} type="button">
      {label}
    </button>
  );
}