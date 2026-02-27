import React from "react";
import { useNavigate } from "react-router-dom";

export default function LoginButton({
  label = "Iniciar sesión",
  className = "px-4 py-2 bg-blue-600 text-white rounded-xl shadow hover:brightness-110 active:scale-[.98]",
}) {
  const navigate = useNavigate();

  const handleLogin = () => {
    navigate("/login", {
      state: { returnTo: window.location.pathname + window.location.search },
    });
  };

  return (
    <button onClick={handleLogin} className={className}>
      {label}
    </button>
  );
}
