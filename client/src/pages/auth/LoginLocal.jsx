// client/src/pages/auth/LoginLocal.jsx
// Login local (email/password)
// 19/02/2026 - SENAF
import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import api, { API } from "../../lib/api.js";

export default function LoginLocal() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [showPass, setShowPass] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const emailNorm = useMemo(() => String(email || "").trim().toLowerCase(), [email]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (!emailNorm) return setError("Ingresa tu correo.");
    if (!password) return setError("Ingresa tu contraseña.");

    try {
      setSubmitting(true);

      // ✅ endpoint correcto (API ya incluye /api)
      const res = await api.post("/iam/v1/auth/login", {
        email: emailNorm,
        password,
      });

      const data = res?.data || {};

      // ✅ si tu backend responde con error aunque sea 200
      if (data?.ok === false) {
        setError(data?.error || "Login fallido.");
        return;
      }

      // ✅ flujo OTP (si tu backend lo usa)
      // Ajusta estos flags según tu backend real:
      const otpRequired = !!(data?.otpRequired || data?.requireOtp || data?.require_otp);
      if (otpRequired) {
        // Guardamos email para VerifyOtp.jsx
        localStorage.setItem("senaf_otp_email", emailNorm);
        navigate("/otp", { replace: true });
        return;
      }

      // ✅ token obligatorio
      if (!data?.token) {
        setError(data?.error || "El servidor no devolvió token.");
        return;
      }

      // ✅ clave correcta: tu App.jsx busca "senaf_token"
      localStorage.setItem("senaf_token", data.token);

      // (opcional) guarda info simple para mostrar nombre/email en UI
      // Si tu backend retorna user
      if (data?.user) {
        try {
          localStorage.setItem("senaf_user", JSON.stringify(data.user));
        } catch {}
      } else {
        // al menos email
        try {
          localStorage.setItem("senaf_user", JSON.stringify({ email: emailNorm }));
        } catch {}
      }

      // ✅ flags posibles de "debe cambiar contraseña"
      const mustChangePassword = !!(
        data?.mustChangePassword ||
        data?.must_change_password ||
        data?.must_reset ||
        data?.forcePasswordChange
      );

      if (mustChangePassword) {
        navigate("/change-password", { replace: true });
        return;
      }

      // ✅ deja que /start consulte /me y redirija a Home según roles/permisos
      navigate("/start", { replace: true });
    } catch (err) {
      const msg =
        err?.response?.data?.error ||
        err?.response?.data?.message ||
        `Error de conexión (${API})`;
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100">
      <form onSubmit={handleSubmit} className="p-6 border rounded w-80 bg-white shadow-sm">
        <h2 className="text-lg mb-4 font-bold">Login</h2>

        <input
          className="border w-full mb-3 p-2"
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="username"
          inputMode="email"
        />

        {/* Password con ojito */}
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

        {error && <div className="text-red-600 mb-2 text-sm">{error}</div>}

        <button
          type="submit"
          disabled={submitting}
          className="bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white w-full p-2 rounded"
        >
          {submitting ? "Ingresando..." : "Ingresar"}
        </button>

        <div className="mt-3 text-xs text-gray-500">
          API: <span className="font-mono">{API}</span>
        </div>
      </form>
    </div>
  );
}
