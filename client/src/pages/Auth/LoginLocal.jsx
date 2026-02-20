// Página de login local (email/password)
// Creada el 19/02/2026 para implementar Login, cambio de contraseña y vencimiento
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";

export default function LoginLocal() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    try {
      const res = await fetch("http://localhost:4000/api/iam/v1/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Error en login");
        return;
      }

      localStorage.setItem("token", data.token);

      if (data.mustChangePassword) {
        navigate("/change-password");
      } else {
        navigate("/");
      }

    } catch (err) {
      setError("Error de conexión");
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

        {/* <input
          className="border w-full mb-3 p-2"
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        /> */}
        <input
            className="border w-full mb-3 p-2"
            type="password"
            placeholder="Password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
        />

        {error && <div className="text-red-500 mb-2">{error}</div>}

        <button className="bg-blue-600 text-white w-full p-2">
          Ingresar
        </button>
      </form>
    </div>
  );
}
// Página de login local (email/password)
// Creada el 19/02/2026 para implementar Login, cambio de contraseña y vencimiento