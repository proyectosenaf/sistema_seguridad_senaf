// client/src/pages/auth/ResetPassword.jsx
import React, { useMemo, useState } from "react";
import axios from "axios";
import { Link, useNavigate } from "react-router-dom";
import { API as API_BASE } from "../../lib/api.js";
import AuthBackground from "../../components/AuthBackground.jsx";

function inputClass() {
  return "border border-slate-300/80 dark:border-slate-700/80 bg-white/80 dark:bg-slate-950/40 text-slate-900 dark:text-slate-100 w-full p-2 rounded outline-none focus:ring-2 focus:ring-blue-500/30";
}

function humanResetError(codeOrMsg) {
  const s = String(codeOrMsg || "").toLowerCase();

  if (s.includes("missing_fields")) return "Completa todos los campos.";
  if (s.includes("password_mismatch")) return "Las contraseñas no coinciden.";
  if (s.includes("invalid_password")) return "La contraseña no cumple la política mínima.";
  if (s.includes("invalid_reset")) return "Solicitud inválida.";
  if (s.includes("reset_not_requested")) return "Primero debes solicitar un código.";
  if (s.includes("reset_already_used")) return "Ese código ya fue utilizado.";
  if (s.includes("reset_expired")) return "El código ha expirado.";
  if (s.includes("too_many_attempts")) return "Demasiados intentos. Solicita un nuevo código.";
  if (s.includes("invalid_reset_token")) return "El código es incorrecto.";
  if (s.includes("network error")) return "Error de conexión con el servidor.";

  return codeOrMsg || "No se pudo restablecer la contraseña.";
}

export default function ResetPassword() {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    email: "",
    token: "",
    passwordNueva: "",
    confirmarPassword: "",
  });

  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const publicApi = useMemo(() => {
    const base = String(API_BASE || "http://localhost:4000/api")
      .trim()
      .replace(/\/$/, "");

    return axios.create({
      baseURL: base,
      withCredentials: false,
      timeout: 30000,
      headers: {
        "Cache-Control": "no-store",
        Pragma: "no-cache",
        "Content-Type": "application/json",
      },
    });
  }, []);

  function onChange(e) {
    const { name, value } = e.target;
    setForm((s) => ({ ...s, [name]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setMsg("");
    setError("");
    setLoading(true);

    try {
      const { data } = await publicApi.post("/public/v1/password/reset-password", {
        email: String(form.email || "").trim().toLowerCase(),
        token: String(form.token || "").trim().toUpperCase(),
        passwordNueva: String(form.passwordNueva || ""),
        confirmarPassword: String(form.confirmarPassword || ""),
      });

      if (data?.ok === false) {
        setError(humanResetError(data?.error || data?.message));
        return;
      }

      setMsg(data?.message || "Contraseña actualizada correctamente.");
      setTimeout(() => navigate("/login", { replace: true }), 1200);
    } catch (err) {
      const d = err?.response?.data;
      const msg =
        (d && typeof d === "object" && (d.error || d.message || d.details)) ||
        err?.message ||
        "No se pudo restablecer la contraseña.";

      console.error("[ResetPassword] error:", {
        status: err?.response?.status,
        data: err?.response?.data,
        message: err?.message,
      });

      setError(humanResetError(msg));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthBackground imageUrl="/images/senaf-bg.png" variant="cover" opacity={0.5} blurPx={0}>
      <div className="w-[400px]">
        <div className="relative bg-white/90 dark:bg-slate-900/85 shadow-sm border border-slate-200/80 dark:border-slate-800/80 rounded backdrop-blur-md">
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.06] dark:opacity-[0.05] bg-center bg-no-repeat bg-contain"
            style={{ backgroundImage: "url('/images/senaf-bg.png')" }}
          />

          <div className="relative z-10 p-6">
            <h1 className="text-3xl mb-2 font-bold text-slate-900 dark:text-slate-100">
              Restablecer contraseña
            </h1>

            <p className="mb-6 text-sm text-slate-600 dark:text-slate-300">
              Escribe tu correo, el código recibido y tu nueva contraseña.
            </p>

            <form onSubmit={handleSubmit}>
              <input
                className={`${inputClass()} mb-3`}
                name="email"
                type="email"
                placeholder="Correo electrónico"
                value={form.email}
                onChange={onChange}
                autoComplete="email"
              />

              <input
                className={`${inputClass()} mb-3`}
                name="token"
                type="text"
                placeholder="Código temporal"
                value={form.token}
                onChange={(e) =>
                  setForm((s) => ({
                    ...s,
                    token: e.target.value.toUpperCase().replace(/\s+/g, ""),
                  }))
                }
              />

              <input
                className={`${inputClass()} mb-3`}
                name="passwordNueva"
                type="password"
                placeholder="Nueva contraseña"
                value={form.passwordNueva}
                onChange={onChange}
                autoComplete="new-password"
              />

              <input
                className={`${inputClass()} mb-3`}
                name="confirmarPassword"
                type="password"
                placeholder="Confirmar contraseña"
                value={form.confirmarPassword}
                onChange={onChange}
                autoComplete="new-password"
              />

              <button
                type="submit"
                disabled={loading}
                className="bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white w-full p-2 rounded"
              >
                {loading ? "Actualizando..." : "Guardar nueva contraseña"}
              </button>
            </form>

            {msg ? <div className="mt-4 text-sm text-emerald-700">{msg}</div> : null}
            {error ? <div className="mt-4 text-sm text-red-600">{error}</div> : null}

            <div className="mt-6 flex items-center justify-between">
              <Link to="/forgot-password" className="text-blue-600 hover:underline">
                Solicitar nuevo código
              </Link>

              <Link to="/login" className="text-slate-600 hover:underline">
                Volver al login
              </Link>
            </div>
          </div>
        </div>
      </div>
    </AuthBackground>
  );
}