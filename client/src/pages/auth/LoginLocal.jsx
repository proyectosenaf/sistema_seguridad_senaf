// client/src/pages/auth/LoginLocal.jsx
// Login local (email/password) - SENAF
import React, { useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import api, { getToken, clearToken, setToken } from "../../lib/api.js";
import { useAuth } from "./AuthProvider.jsx";

function safeInternalPath(p) {
  return typeof p === "string" && p.startsWith("/") && !p.startsWith("//");
}

function readReturnTo(locationSearch) {
  const qs = new URLSearchParams(locationSearch || "");
  const fromQuery = qs.get("to");

  const fromSession = (() => {
    try {
      return sessionStorage.getItem("auth:returnTo");
    } catch {
      return null;
    }
  })();

  const picked =
    (safeInternalPath(fromQuery) && fromQuery) ||
    (safeInternalPath(fromSession) && fromSession) ||
    null;

  return picked;
}

function consumeReturnTo(locationSearch) {
  const picked = readReturnTo(locationSearch);
  try {
    sessionStorage.removeItem("auth:returnTo");
  } catch {}
  return picked;
}

export default function LoginLocal() {
  const navigate = useNavigate();
  const loc = useLocation();
  const auth = useAuth();

  // mode: "internal" | "visitor"
  const [mode, setMode] = useState("internal");

  // interno
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");

  // visitante registro (pendiente backend)
  const [fullName, setFullName] = useState("");
  const [vEmail, setVEmail] = useState("");
  const [vPassword, setVPassword] = useState("");
  const [vPassword2, setVPassword2] = useState("");

  // visibilidad password (separado por tab)
  const [showPassInternal, setShowPassInternal] = useState(false);
  const [showPassVisitor, setShowPassVisitor] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const emailNorm = useMemo(() => String(identifier || "").trim().toLowerCase(), [identifier]);
  const visitorEmailNorm = useMemo(() => String(vEmail || "").trim().toLowerCase(), [vEmail]);

  function stashOtpContext({ email, flow, returnTo }) {
    try {
      localStorage.setItem("senaf_otp_email", String(email || ""));
    } catch {}
    try {
      sessionStorage.setItem("senaf_otp_flow", String(flow || "login")); // login | register
    } catch {}
    if (returnTo) {
      try {
        sessionStorage.setItem("auth:returnTo", returnTo);
      } catch {}
    }
  }

  async function submitInternal(e) {
    e.preventDefault();
    if (submitting) return;
    setError("");

    if (!emailNorm || !emailNorm.includes("@")) return setError("Ingresa tu correo (email).");
    if (!password) return setError("Ingresa tu contraseña.");

    const returnTo = consumeReturnTo(loc.search);

    try {
      setSubmitting(true);
      clearToken();

      const res = await api.post("/iam/v1/auth/login-otp", {
        email: emailNorm,
        password: String(password || ""),
      });

      const data = res?.data || {};

      if (data?.ok === false) {
        setError(data?.error || data?.message || "Login fallido.");
        return;
      }

      // ✅ Caso A: NO requiere OTP => token directo
      if (data?.otpRequired === false && data?.token) {
        const tkn = String(data.token || "").trim();
        setToken(tkn);
        await auth.login({ email: emailNorm }, tkn);

        if (data?.mustChangePassword) {
          navigate(`/force-change-password?email=${encodeURIComponent(emailNorm)}`, {
            replace: true,
          });
          return;
        }

        if (returnTo) {
          navigate(returnTo, { replace: true });
          return;
        }

        navigate("/start", { replace: true });
        return;
      }

      // ✅ Caso B: requiere OTP => ir a /otp
      stashOtpContext({ email: emailNorm, flow: "login", returnTo });
      navigate("/otp", { replace: true });
    } catch (err) {
      const base = api?.defaults?.baseURL || "";
      const msg =
        err?.response?.data?.error ||
        err?.response?.data?.message ||
        err?.message ||
        `Error de conexión (${base})`;

      setError(msg);

      const st = err?.response?.status || err?.status;
      if (st === 401 || st === 403) clearToken();
    } finally {
      setSubmitting(false);
    }
  }

  async function submitVisitor(e) {
    e.preventDefault();
    if (submitting) return;
    setError("");

    if (!String(fullName || "").trim()) return setError("Ingresa tu nombre.");
    if (!visitorEmailNorm) return setError("Ingresa tu correo.");
    if (!vPassword) return setError("Ingresa tu contraseña.");
    if (String(vPassword) !== String(vPassword2)) return setError("Las contraseñas no coinciden.");

    try {
      setSubmitting(true);
      setError("Registro de visitas pendiente: falta endpoint en backend (register + enviar OTP).");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100">
      <div className="w-[360px] bg-white shadow-sm border rounded">
        {/* Tabs */}
        <div className="flex border-b">
          <button
            type="button"
            onClick={() => {
              setMode("internal");
              setError("");
            }}
            className={`flex-1 p-3 text-sm font-semibold ${
              mode === "internal" ? "bg-white" : "bg-slate-50 text-slate-600"
            }`}
          >
            Ingreso interno
          </button>
          <button
            type="button"
            onClick={() => {
              setMode("visitor");
              setError("");
            }}
            className={`flex-1 p-3 text-sm font-semibold ${
              mode === "visitor" ? "bg-white" : "bg-slate-50 text-slate-600"
            }`}
          >
            Registro visita
          </button>
        </div>

        <div className="p-6">
          <h2 className="text-lg mb-4 font-bold">
            {mode === "internal" ? "Login" : "Registro de visita"}
          </h2>

          {mode === "internal" ? (
            <form onSubmit={submitInternal}>
              <input
                className="border w-full mb-3 p-2"
                type="email"
                placeholder="Correo (email)"
                value={identifier}
                onChange={(e) => {
                  setIdentifier(e.target.value);
                  if (error) setError("");
                }}
                autoComplete="username"
                inputMode="email"
              />

              <div className="relative mb-3">
                <input
                  className="border w-full p-2 pr-10"
                  type={showPassInternal ? "text" : "password"}
                  placeholder="Contraseña"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (error) setError("");
                  }}
                />

                <button
                  type="button"
                  onClick={() => setShowPassInternal((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-600 hover:text-gray-900"
                  aria-label={showPassInternal ? "Ocultar contraseña" : "Mostrar contraseña"}
                  title={showPassInternal ? "Ocultar" : "Mostrar"}
                >
                  {showPassInternal ? "🙈" : "👁️"}
                </button>
              </div>

              {error && <div className="text-red-600 mb-2 text-sm">{error}</div>}

              <button
                type="submit"
                disabled={submitting}
                className="bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white w-full p-2 rounded"
              >
                {submitting ? "Procesando..." : "Continuar"}
              </button>

              <div className="mt-3 text-xs text-gray-500">
                API: <span className="font-mono">{api?.defaults?.baseURL || "—"}</span>
                {getToken() ? <span className="ml-2 text-emerald-700">(token)</span> : null}
              </div>
            </form>
          ) : (
            <form onSubmit={submitVisitor}>
              <input
                className="border w-full mb-3 p-2"
                type="text"
                placeholder="Nombre completo"
                value={fullName}
                onChange={(e) => {
                  setFullName(e.target.value);
                  if (error) setError("");
                }}
                autoComplete="name"
              />

              <input
                className="border w-full mb-3 p-2"
                type="email"
                placeholder="Email"
                value={vEmail}
                onChange={(e) => {
                  setVEmail(e.target.value);
                  if (error) setError("");
                }}
                autoComplete="email"
                inputMode="email"
              />

              <div className="relative mb-3">
                <input
                  className="border w-full p-2 pr-10"
                  type={showPassVisitor ? "text" : "password"}
                  placeholder="Contraseña"
                  autoComplete="new-password"
                  value={vPassword}
                  onChange={(e) => {
                    setVPassword(e.target.value);
                    if (error) setError("");
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassVisitor((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-600 hover:text-gray-900"
                  aria-label={showPassVisitor ? "Ocultar contraseña" : "Mostrar contraseña"}
                  title={showPassVisitor ? "Ocultar" : "Mostrar"}
                >
                  {showPassVisitor ? "🙈" : "👁️"}
                </button>
              </div>

              <input
                className="border w-full mb-3 p-2"
                type={showPassVisitor ? "text" : "password"}
                placeholder="Confirmar contraseña"
                autoComplete="new-password"
                value={vPassword2}
                onChange={(e) => {
                  setVPassword2(e.target.value);
                  if (error) setError("");
                }}
              />

              {error && <div className="text-red-600 mb-2 text-sm">{error}</div>}

              <button
                type="submit"
                disabled={submitting}
                className="bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white w-full p-2 rounded"
              >
                {submitting ? "Procesando..." : "Continuar"}
              </button>

              <button
                type="button"
                disabled
                className="mt-3 w-full p-2 rounded border text-slate-500 bg-slate-50 cursor-not-allowed"
                title="Pendiente de integrar (Google OAuth)"
              >
                Continuar con Google (pendiente)
              </button>

              <div className="mt-3 text-xs text-gray-500">
                API: <span className="font-mono">{api?.defaults?.baseURL || "—"}</span>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}