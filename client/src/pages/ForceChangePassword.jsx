import React from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { Eye, EyeOff } from "lucide-react";

import { APP_CONFIG } from "../config/app.config.js";
import { API, setToken } from "../lib/api.js";
import { useAuth } from "./auth/AuthProvider.jsx";

function getParam(name) {
  const sp = new URLSearchParams(window.location.search);
  return sp.get(name);
}

function getOtpEmailFallback() {
  try {
    return String(localStorage.getItem("senaf_otp_email") || "")
      .trim()
      .toLowerCase();
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

  if (s.includes("missing_fields"))
    return "Faltan datos para restablecer contraseña.";
  if (s.includes("password_too_short"))
    return "La contraseña es muy corta.";

  if (s.includes("reset_token_invalid_or_expired"))
    return "La sesión de restablecimiento venció. Vuelve a iniciar sesión y valida el OTP otra vez.";
  if (s.includes("reset_token_email_mismatch"))
    return "El token no corresponde a este correo. Vuelve a iniciar sesión y valida el OTP otra vez.";
  if (s.includes("reset_token_user_mismatch"))
    return "Token inválido. Vuelve a iniciar sesión y valida el OTP otra vez.";

  if (s.includes("user_not_found")) return "Usuario no encontrado.";
  if (s.includes("user_inactive"))
    return "Usuario inactivo. Contacta al administrador.";
  if (s.includes("not_local_user"))
    return "Este usuario no es local. No se puede restablecer aquí.";
  if (s.includes("visitor_reset_not_allowed"))
    return "Los usuarios 'visita' no restablecen contraseña por este flujo.";

  if (s.includes("otp"))
    return "Debes validar OTP otra vez (código vencido o inválido).";

  if (s.includes("forbidden") || s === "403")
    return "Acceso denegado (403). Repite el OTP e intenta de nuevo.";
  if (s.includes("unauthorized") || s === "401")
    return "No autorizado (401). Repite el OTP e intenta de nuevo.";

  return codeOrMsg || "No se pudo restablecer la contraseña.";
}

function passwordRules(p = "") {
  return {
    length: p.length >= 8,
    upper: /[A-Z]/.test(p),
    lower: /[a-z]/.test(p),
    digit: /\d/.test(p),
  };
}

function sxCard(extra = {}) {
  return {
    background: "color-mix(in srgb, var(--card, #ffffff) 94%, transparent)",
    border: "1px solid var(--border, #d4d4d8)",
    boxShadow: "0 10px 30px rgba(0,0,0,.08)",
    ...extra,
  };
}

function sxInput(extra = {}) {
  return {
    background: "var(--input-bg, #ffffff)",
    color: "var(--text, #0f172a)",
    border: "1px solid var(--input-border, #cbd5e1)",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,.04)",
    ...extra,
  };
}

function sxGhostBtn(extra = {}) {
  return {
    background: "color-mix(in srgb, var(--card-solid, #ffffff) 92%, transparent)",
    color: "var(--text, #0f172a)",
    border: "1px solid var(--border, #d4d4d8)",
    boxShadow: "0 2px 10px rgba(0,0,0,.04)",
    ...extra,
  };
}

function sxPrimaryBtn(extra = {}) {
  return {
    background: "linear-gradient(135deg, #2563eb, #06b6d4)",
    color: "#fff",
    border: "1px solid transparent",
    boxShadow: "0 10px 20px rgba(37,99,235,.18)",
    ...extra,
  };
}

export default function ForceChangePassword() {
  const navigate = useNavigate();
  const auth = useAuth();

  const loginRoute =
    String(APP_CONFIG?.routes?.login || "/login").trim() || "/login";

  const emailFromQuery = (getParam("email") || "").trim().toLowerCase();
  const email = emailFromQuery || getOtpEmailFallback();

  const resetTokenFromQuery = (getParam("rt") || "").trim();
  const resetToken = resetTokenFromQuery || getResetTokenFallback();

  const [newPassword, setNewPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");

  const [showNewPassword, setShowNewPassword] = React.useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = React.useState(false);

  const [status, setStatus] = React.useState("idle"); // idle | saving | ok | error
  const [msg, setMsg] = React.useState("");

  const pwdRules = passwordRules(newPassword);
  const passwordsMatch =
    !!newPassword && !!confirmPassword && newPassword === confirmPassword;
  const showRules = newPassword.length > 0 || confirmPassword.length > 0;

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
      setMsg(
        "No hay sesión de restablecimiento. Vuelve a iniciar sesión y valida el OTP otra vez."
      );
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
        setMsg(
          "El servidor no devolvió token tras restablecer la contraseña."
        );
        return;
      }

      clearOtpResetContext();

      setToken(token);

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
    <div
      className="min-h-screen flex items-center justify-center p-6"
      style={{ background: "var(--bg, #f5f5f5)" }}
    >
      <div className="w-full max-w-md rounded-[24px] p-6" style={sxCard()}>
        <h1
          className="text-xl font-semibold"
          style={{ color: "var(--text, #0f172a)" }}
        >
          Establecer nueva contraseña
        </h1>

        <p
          className="mt-2 text-sm"
          style={{ color: "var(--text-muted, #52525b)" }}
        >
          Verificaste el OTP. Ahora crea tu nueva contraseña para continuar.
        </p>

        <div
          className="mt-4 rounded-xl p-3"
          style={sxGhostBtn({ background: "var(--input-bg, #fafafa)" })}
        >
          <div
            className="text-xs"
            style={{ color: "var(--text-muted, #71717a)" }}
          >
            Cuenta
          </div>
          <div
            className="text-sm font-medium"
            style={{ color: "var(--text, #0f172a)" }}
          >
            {email || "(sin email)"}
          </div>
        </div>

        {!resetToken && (
          <div
            className="mt-4 rounded-xl p-3 text-sm"
            style={{
              background: "color-mix(in srgb, #ef4444 10%, white)",
              border: "1px solid color-mix(in srgb, #ef4444 25%, white)",
              color: "#991b1b",
            }}
          >
            No hay sesión de restablecimiento (resetToken). Vuelve a iniciar
            sesión y valida el OTP otra vez.
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4">
          <label
            className="block text-sm font-medium mb-1"
            style={{ color: "var(--text, #0f172a)" }}
          >
            Nueva contraseña
          </label>

          <div className="relative">
            <input
              className="w-full p-3 pr-12 rounded-xl outline-none"
              style={sxInput()}
              type={showNewPassword ? "text" : "password"}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              autoComplete="new-password"
              placeholder="Mínimo 8 caracteres"
            />
            <button
              type="button"
              onClick={() => setShowNewPassword((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 inline-flex items-center justify-center"
              style={{ color: "var(--text-muted, #64748b)" }}
              aria-label={showNewPassword ? "Ocultar contraseña" : "Ver contraseña"}
              title={showNewPassword ? "Ocultar contraseña" : "Ver contraseña"}
            >
              {showNewPassword ? (
                <EyeOff className="h-5 w-5" />
              ) : (
                <Eye className="h-5 w-5" />
              )}
            </button>
          </div>

          <label
            className="block text-sm font-medium mb-1 mt-3"
            style={{ color: "var(--text, #0f172a)" }}
          >
            Confirmar contraseña
          </label>

          <div className="relative">
            <input
              className="w-full p-3 pr-12 rounded-xl outline-none"
              style={sxInput()}
              type={showConfirmPassword ? "text" : "password"}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
              placeholder="Repite la contraseña"
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 inline-flex items-center justify-center"
              style={{ color: "var(--text-muted, #64748b)" }}
              aria-label={
                showConfirmPassword ? "Ocultar confirmación" : "Ver confirmación"
              }
              title={
                showConfirmPassword ? "Ocultar confirmación" : "Ver confirmación"
              }
            >
              {showConfirmPassword ? (
                <EyeOff className="h-5 w-5" />
              ) : (
                <Eye className="h-5 w-5" />
              )}
            </button>
          </div>

          {showRules && (
            <div
              className="mt-3 rounded-xl p-3 text-xs space-y-1"
              style={sxGhostBtn({ background: "var(--input-bg, #fafafa)" })}
            >
              <div className="font-semibold" style={{ color: "#0891b2" }}>
                Requisitos de contraseña:
              </div>
              <div style={{ color: pwdRules.length ? "#16a34a" : "#dc2626" }}>
                • Al menos 8 caracteres
              </div>
              <div style={{ color: pwdRules.upper ? "#16a34a" : "#dc2626" }}>
                • Una letra mayúscula
              </div>
              <div style={{ color: pwdRules.lower ? "#16a34a" : "#dc2626" }}>
                • Una letra minúscula
              </div>
              <div style={{ color: pwdRules.digit ? "#16a34a" : "#dc2626" }}>
                • Un número
              </div>
              <div style={{ color: passwordsMatch ? "#16a34a" : "#dc2626" }}>
                • Coincidencia entre contraseña y confirmación
              </div>
            </div>
          )}

          {status === "error" && (
            <div
              className="mt-3 rounded-xl p-3 text-sm"
              style={{
                background: "color-mix(in srgb, #ef4444 10%, white)",
                border: "1px solid color-mix(in srgb, #ef4444 25%, white)",
                color: "#991b1b",
              }}
            >
              {msg || "Ocurrió un error."}
            </div>
          )}

          {status === "ok" && (
            <div
              className="mt-3 rounded-xl p-3 text-sm"
              style={{
                background: "color-mix(in srgb, #22c55e 10%, white)",
                border: "1px solid color-mix(in srgb, #22c55e 25%, white)",
                color: "#166534",
              }}
            >
              {msg}
            </div>
          )}

          <button
            type="submit"
            disabled={!canSubmit}
            className="mt-4 w-full h-12 rounded-xl text-sm font-semibold disabled:opacity-60"
            style={sxPrimaryBtn()}
          >
            {status === "saving" ? "Guardando…" : "Guardar y entrar"}
          </button>
        </form>

        <div className="mt-5 flex gap-3">
          <a
            href={loginRoute}
            className="h-12 flex-1 rounded-xl flex items-center justify-center text-sm font-semibold"
            style={sxGhostBtn()}
          >
            Volver al login
          </a>
        </div>

        <p
          className="mt-4 text-xs"
          style={{ color: "var(--text-muted, #71717a)" }}
        >
          Tip: usa una contraseña fuerte y no la compartas.
        </p>
      </div>
    </div>
  );
}