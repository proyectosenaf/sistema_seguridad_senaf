// Página de cambio de contraseña local
// Creada el 19/02/2026 para implementar cambio de contraseña y vencimiento
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";

export default function ChangePassword() {
  const [passwordActual, setPasswordActual] = useState("");
  const [passwordNueva, setPasswordNueva] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    try {
      const res = await fetch("http://localhost:4000/api/iam/v1/auth/change-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify({ passwordActual, passwordNueva }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Error al cambiar contraseña");
        return;
      }

      navigate("/");
    } catch (err) {
      setError("Error de conexión");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center">
      <form onSubmit={handleSubmit} className="p-6 border rounded w-80">
        <h2 className="text-lg mb-4 font-bold">Cambiar contraseña</h2>

        <input
          type="password"
          placeholder="Contraseña actual"
          className="border w-full mb-3 p-2"
          value={passwordActual}
          onChange={(e) => setPasswordActual(e.target.value)}
          autoComplete="current-password"
        />

        <input
          type="password"
          placeholder="Nueva contraseña"
          className="border w-full mb-3 p-2"
          value={passwordNueva}
          onChange={(e) => setPasswordNueva(e.target.value)}
        />

        {error && <div className="text-red-500 mb-2">{error}</div>}

        <button className="bg-green-600 text-white w-full p-2">
          Guardar
        </button>
      </form>
    </div>
  );
}
// Página de cambio de contraseña local
// Creada el 19/02/2026 para implementar cambio de contraseña y vencimiento
