// client/src/pages/auth/ForgotPassword.jsx
import React, { useMemo, useState } from "react";
import axios from "axios";
import { Link } from "react-router-dom";
import { API as API_BASE } from "../../lib/api.js";
import AuthBackground from "../../components/AuthBackground.jsx";

function inputClass() {
  return "border border-slate-300/80 dark:border-slate-700/80 bg-white/80 dark:bg-slate-950/40 text-slate-900 dark:text-slate-100 w-full p-2 rounded outline-none focus:ring-2 focus:ring-blue-500/30";
}

function humanResetRequestError(codeOrMsg) {
  const s = String(codeOrMsg || "").toLowerCase();

  if (s.includes("email_required")) return "Ingresa tu correo.";
  if (s.includes("network error")) return "Error de conexión con el servidor.";
  if (s.includes("cors")) return "Error de conexión con el servidor.";
  if (s.includes("not found")) return "La ruta de recuperación no existe en el backend.";
  if (s.includes("server_error")) return "Error interno del servidor.";

  return codeOrMsg || "No se pudo procesar la solicitud.";
}

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [devToken, setDevToken] = useState("");
  const [expiresAt, setExpiresAt] = useState("");

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

  async function handleSubmit(e) {
    e.preventDefault();
    setMsg("");
    setError("");
    setDevToken("");
    setExpiresAt("");
    setLoading(true);

    try {
      const { data } = await publicApi.post("/public/v1/password/request-password-reset", {
        email: String(email || "").trim().toLowerCase(),
      });

      if (data?.ok === false) {
        setError(humanResetRequestError(data?.error || data?.message));
        return;
      }

      setMsg(
        data?.message ||
          "Si el correo existe, se enviaron instrucciones para restablecer la contraseña."
      );

      if (data?.token) setDevToken(String(data.token));
      if (data?.expiresAt) setExpiresAt(String(data.expiresAt));
    } catch (err) {
      const d = err?.response?.data;
      const msg =
        (d && typeof d === "object" && (d.error || d.message || d.details)) ||
        err?.message ||
        "No se pudo procesar la solicitud.";

      console.error("[ForgotPassword] error:", {
        status: err?.response?.status,
        data: err?.response?.data,
        message: err?.message,
      });

      setError(humanResetRequestError(msg));
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
              Recuperar contraseña
            </h1>

            <p className="mb-6 text-sm text-slate-600 dark:text-slate-300">
              Ingresa tu correo y te enviaremos un código temporal.
            </p>

            <form onSubmit={handleSubmit}>
              <input
                className={`${inputClass()} mb-4`}
                type="email"
                placeholder="Correo electrónico"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (error) setError("");
                  if (msg) setMsg("");
                }}
                autoComplete="email"
                inputMode="email"
              />

              <button
                type="submit"
                disabled={loading}
                className="bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white w-full p-2 rounded"
              >
                {loading ? "Enviando..." : "Enviar código"}
              </button>
            </form>

            {msg ? <div className="mt-4 text-sm text-emerald-700">{msg}</div> : null}
            {error ? <div className="mt-4 text-sm text-red-600">{error}</div> : null}

            {devToken ? (
              <div className="mt-4 rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
                <div className="font-semibold">Modo desarrollo</div>
                <div>Código: {devToken}</div>
                <div>Expira: {expiresAt}</div>
              </div>
            ) : null}

            <div className="mt-6 flex items-center justify-between">
              <Link to="/reset-password" className="text-blue-600 hover:underline">
                Ya tengo código
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