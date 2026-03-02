// client/src/pages/ForceChangePassword.jsx
import React from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";

import { APP_CONFIG } from "../config/app.config.js";
import api, { API, setToken } from "../lib/api.js";
import { useAuth } from "./auth/AuthProvider.jsx";

function getParam(name) {
  const sp = new URLSearchParams(window.location.search);
  return sp.get(name);
}

function getOtpEmailFallback() {
  try {
    return String(localStorage.getItem("senaf_otp_email") || "").trim().toLowerCase();
  } catch {
    return "";
  }
}

function getResetTokenFallback() {
  try {
    return String(sessionStorage.getItem("senaf_pwreset_token") || "").trim();
  } catch {
    return "";
  }
}

function clearOtpResetContext() {
  try {
    sessionStorage.removeItem("senaf_pwreset_token");
  } catch {}
  try {
    localStorage.removeItem("senaf_otp_email");
  } catch {}
}

function humanResetError(codeOrMsg) {
  const s = String(codeOrMsg || "").toLowerCase();

  if (s.includes("missing_fields")) return "Faltan datos para restablecer contraseña.";
  if (s.includes("password_too_short")) return "La contraseña es muy corta.";

  if (s.includes("reset_token_invalid_or_expired"))
    return "La sesión de restablecimiento venció. Vuelve a iniciar sesión y valida el OTP otra vez.";
  if (s.includes("reset_token_email_mismatch"))
    return "El token no corresponde a este correo. Vuelve a iniciar sesión y valida el OTP otra vez.";
  if (s.includes("reset_token_user_mismatch"))
    return "Token inválido. Vuelve a iniciar sesión y valida el OTP otra vez.";

  if (s.includes("user_not_found")) return "Usuario no encontrado.";
  if (s.includes("user_inactive")) return "Usuario inactivo. Contacta al administrador.";
  if (s.includes("not_local_user")) return "Este usuario no es local. No se puede restablecer aquí.";
  if (s.includes("visitor_reset_not_allowed"))
    return "Los usuarios 'visita' no restablecen contraseña por este flujo.";

  // Si tu backend devuelve otp_* en algún punto
  if (s.includes("otp")) return "Debes validar OTP otra vez (código vencido o inválido).";

  // Errores HTTP genéricos
  if (s.includes("forbidden") || s === "403") return "Acceso denegado (403). Repite el OTP e intenta de nuevo.";
  if (s.includes("unauthorized") || s === "401") return "No autorizado (401). Repite el OTP e intenta de nuevo.";

  return codeOrMsg || "No se pudo restablecer la contraseña.";
}

export default function ForceChangePassword() {
  const navigate = useNavigate();
  const auth = useAuth();

  const loginRoute = String(APP_CONFIG?.routes?.login || "/login").trim() || "/login";

  // email por query o fallback del OTP flow
  const emailFromQuery = (getParam("email") || "").trim().toLowerCase();
  const email = emailFromQuery || getOtpEmailFallback();

  // resetToken por query o fallback
  const resetTokenFromQuery = (getParam("rt") || "").trim();
  const resetToken = resetTokenFromQuery || getResetTokenFallback();

  const [newPassword, setNewPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");

  const [status, setStatus] = React.useState("idle"); // idle | saving | ok | error
  const [msg, setMsg] = React.useState("");

  const canSubmit =
    !!email &&
    !!resetToken &&
    newPassword.trim().length >= 8 &&
    confirmPassword.trim().length >= 8 &&
    newPassword === confirmPassword &&
    status !== "saving";

  async function handleSubmit(e) {
    e.preventDefault();
    setMsg("");

    if (!email) {
      setStatus("error");
      setMsg("No se recibió el email. Vuelve a iniciar sesión.");
      return;
    }

    if (!resetToken) {
      setStatus("error");
      setMsg("No hay sesión de restablecimiento. Vuelve a iniciar sesión y valida el OTP otra vez.");
      return;
    }

    const pwd = String(newPassword || "").trim();
    const cpwd = String(confirmPassword || "").trim();

    if (pwd.length < 8) {
      setStatus("error");
      setMsg("La contraseña debe tener al menos 8 caracteres.");
      return;
    }

    if (pwd !== cpwd) {
      setStatus("error");
      setMsg("Las contraseñas no coinciden.");
      return;
    }

    try {
      setStatus("saving");

      /**
       * ✅ CLAVE:
       * Usar axios "limpio" para NO mandar Authorization automático.
       *
       * API (desde lib/api.js) ya incluye /api
       * Ej: http://localhost:4000/api
       * entonces aquí pegamos:
       * POST {API}/public/v1/auth/reset-password-otp
       */
      const url = `${String(API).replace(/\/$/, "")}/public/v1/auth/reset-password-otp`;

      const res = await axios.post(
        url,
        { email, resetToken, newPassword: pwd },
        { headers: { "Content-Type": "application/json" } }
      );

      const data = res?.data || {};

      if (data?.ok === false) {
        setStatus("error");
        setMsg(humanResetError(data?.error || data?.message));
        return;
      }

      const token = data?.token;
      if (!token) {
        setStatus("error");
        setMsg("El servidor no devolvió token tras restablecer la contraseña.");
        return;
      }

      // limpiar contexto y loguear
      clearOtpResetContext();

      // guarda token en tu capa global (api.js)
      setToken(token);

      // si tu auth local necesita setear estado interno
      await auth.login({ email }, token);

      setStatus("ok");
      setMsg("Contraseña actualizada. Entrando…");

      navigate("/start", { replace: true });
    } catch (err) {
      const errorMsg =
        err?.response?.data?.error ||
        err?.response?.data?.message ||
        err?.message ||
        String(err);

      setStatus("error");
      setMsg(humanResetError(errorMsg));
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-neutral-50">
      <div className="w-full max-w-md rounded-2xl border bg-white p-6 shadow-sm">
        <h1 className="text-xl font-semibold">Establecer nueva contraseña</h1>

        <p className="mt-2 text-sm text-neutral-600">
          Verificaste el OTP. Ahora crea tu nueva contraseña para continuar.
        </p>

        <div className="mt-4 rounded-xl border p-3 bg-neutral-50">
          <div className="text-xs text-neutral-500">Cuenta</div>
          <div className="text-sm font-medium">{email || "(sin email)"}</div>
        </div>

        {!resetToken && (
          <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
            No hay sesión de restablecimiento (resetToken). Vuelve a iniciar sesión y valida el OTP otra vez.
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4">
          <label className="block text-sm font-medium mb-1">Nueva contraseña</label>
          <input
            className="border w-full p-2 rounded-lg"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            autoComplete="new-password"
            placeholder="Mínimo 8 caracteres"
          />

          <label className="block text-sm font-medium mb-1 mt-3">Confirmar contraseña</label>
          <input
            className="border w-full p-2 rounded-lg"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            autoComplete="new-password"
            placeholder="Repite la contraseña"
          />

          {status === "error" && (
            <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
              {msg || "Ocurrió un error."}
            </div>
          )}

          {status === "ok" && (
            <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
              {msg}
            </div>
          )}

          <button
            type="submit"
            disabled={!canSubmit}
            className="mt-4 w-full h-11 rounded-xl bg-neutral-900 text-white text-sm font-semibold disabled:opacity-60"
          >
            {status === "saving" ? "Guardando…" : "Guardar y entrar"}
          </button>
        </form>

        <div className="mt-5 flex gap-3">
          <a
            href={loginRoute}
            className="h-11 flex-1 rounded-xl border flex items-center justify-center text-sm font-semibold"
          >
            Volver al login
          </a>
        </div>

        <p className="mt-4 text-xs text-neutral-500">Tip: usa una contraseña fuerte y no la compartas.</p>
      </div>
    </div>
  );
}