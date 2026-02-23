// Página de login local (email/password)
// Creada el 19/02/2026 para implementar Login, cambio de contraseña y vencimiento
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import api, { API } from "../../lib/api.js"; // ✅ usa tu API_ROOT (VITE_API_BASE_URL)

export default function LoginLocal() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false); // ✅ NUEVO
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    try {
      // ✅ POST relativo al baseURL (API_ROOT ya incluye /api)
      // ruta final: `${VITE_API_BASE_URL}/iam/v1/auth/login`
      const res = await api.post("/iam/v1/auth/login", { email, password });

      const data = res?.data || {};

      // Mantengo tu lógica
      if (!data?.token) {
        setError(data?.error || "Error en login");
        return;
      }

      localStorage.setItem("token", data.token);

      if (data.mustChangePassword) {
        navigate("/change-password");
      } else {
        navigate("/");
      }
    } catch (err) {
      const msg =
        err?.response?.data?.error ||
        err?.response?.data?.message ||
        `Error de conexión (${API})`;
      setError(msg);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center">
      <form onSubmit={handleSubmit} className="p-6 border rounded w-80">
        <h2 className="text-lg mb-4 font-bold">Login</h2>

        <input
          className="border w-full mb-3 p-2"
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="username"
        />

        {/* ✅ Password con "ojito" */}
        <div className="relative mb-3">
          <input
            className="border w-full p-2 pr-10"
            type={showPass ? "text" : "password"}
            placeholder="Password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          <button
            type="button"
            onClick={() => setShowPass((v) => !v)}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-600 hover:text-gray-900"
            aria-label={showPass ? "Ocultar contraseña" : "Mostrar contraseña"}
            title={showPass ? "Ocultar" : "Mostrar"}
          >
            {showPass ? "🙈" : "👁️"}
          </button>
        </div>

        {error && <div className="text-red-500 mb-2">{error}</div>}

        <button className="bg-blue-600 text-white w-full p-2">
          Ingresar
        </button>
      </form>
    </div>
  );
}