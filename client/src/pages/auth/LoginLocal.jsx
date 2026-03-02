// client/src/pages/auth/LoginLocal.jsx
// Login local (email/password) + Registro visitante - SENAF
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

function stashReturnTo(returnTo) {
  if (!returnTo) return;
  try {
    sessionStorage.setItem("auth:returnTo", returnTo);
  } catch {}
}

function humanLoginError(codeOrMsg) {
  const s = String(codeOrMsg || "").toLowerCase();

  if (s.includes("user_not_found"))
    return "No existe una cuenta con ese correo. Regístrate en la pestaña de registro.";
  if (s.includes("invalid_credentials"))
    return "Credenciales inválidas. Revisa correo y contraseña.";
  if (s.includes("password_not_set"))
    return "Tu usuario no tiene contraseña configurada. Contacta al administrador.";
  if (s.includes("user_inactive")) return "Tu usuario está inactivo. Contacta al administrador.";
  if (s.includes("not_local_user")) return "Usuario no permitido para login local.";
  if (s.includes("employee_otp_disabled")) return "OTP deshabilitado por configuración.";
  if (s.includes("otp_resend_cooldown")) return "Espera unos segundos y vuelve a intentar.";
  if (s.includes("otp_required")) return "Debes validar el código OTP para continuar.";

  return codeOrMsg || "Login fallido.";
}

function humanRegisterError(codeOrMsg) {
  const s = String(codeOrMsg || "").toLowerCase();

  if (s.includes("name_required")) return "Ingresa tu nombre completo.";
  if (s.includes("email_required")) return "Ingresa tu correo.";
  if (s.includes("password_required")) return "Ingresa una contraseña.";
  if (s.includes("password_too_short")) return "La contraseña debe tener al menos 8 caracteres.";
  if (s.includes("email_invalid")) return "Correo inválido. Revisa el formato.";
  if (s.includes("email_taken")) return "Ya existe una cuenta con ese correo. Inicia sesión.";
  if (s.includes("user_exists")) return "Ya existe una cuenta con ese correo. Inicia sesión.";
  if (s.includes("user_inactive")) return "Tu usuario está inactivo. Contacta al administrador.";

  return codeOrMsg || "No se pudo completar el registro.";
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

  // visitante registro
  const [fullName, setFullName] = useState("");
  const [vEmail, setVEmail] = useState("");
  const [vPassword, setVPassword] = useState("");
  const [vPassword2, setVPassword2] = useState("");

  // UI state
  const [showPassInternal, setShowPassInternal] = useState(false);
  const [showPassVisitor, setShowPassVisitor] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  const emailNorm = useMemo(() => String(identifier || "").trim().toLowerCase(), [identifier]);
  const visitorEmailNorm = useMemo(() => String(vEmail || "").trim().toLowerCase(), [vEmail]);

  function stashOtpContext({ email, flow, returnTo, mustChangePassword } = {}) {
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
    // ✅ Guardamos flag por si tu pantalla /otp quiere mostrar mensaje
    try {
      sessionStorage.setItem("senaf_otp_mustChange", mustChangePassword ? "1" : "0");
    } catch {}
  }

  async function submitInternal(e) {
    e.preventDefault();
    if (submitting) return;
    setError("");
    setInfo("");

    if (!emailNorm || !emailNorm.includes("@")) return setError("Ingresa tu correo (email).");
    if (!password) return setError("Ingresa tu contraseña.");

    const returnTo = consumeReturnTo(loc.search);

    try {
      setSubmitting(true);
      clearToken();

      // ✅ CORRECCIÓN:
      // Tu server OTP router está montado aquí:
      //   app.use("/api/public/v1/auth", iamOtpAuthRoutes);
      // Y tu axios "api" usualmente ya apunta a ".../api"
      // Entonces debes llamar:
      //   POST /public/v1/auth/login-otp
      const res = await api.post("/public/v1/auth/login-otp", {
        email: emailNorm,
        password: String(password || ""),
      });

      const data = res?.data || {};

      if (data?.ok === false) {
        setError(humanLoginError(data?.error || data?.message));
        return;
      }

      // ✅ Caso A: NO requiere OTP => token directo
      if (data?.otpRequired === false && data?.token) {
        const tkn = String(data.token || "").trim();
        setToken(tkn);
        await auth.login({ email: emailNorm }, tkn);

        // Si el server dice mustChangePassword, entonces lo llevas a forzar reset
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
      stashOtpContext({
        email: emailNorm,
        flow: "login",
        returnTo,
        mustChangePassword: !!data?.mustChangePassword,
      });
      navigate("/otp", { replace: true });
    } catch (err) {
      const msg =
        err?.response?.data?.error ||
        err?.response?.data?.message ||
        err?.message ||
        "Error de conexión";

      setError(humanLoginError(msg));

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
    setInfo("");

    const name = String(fullName || "").trim();
    if (!name) return setError("Ingresa tu nombre.");
    if (!visitorEmailNorm || !visitorEmailNorm.includes("@")) return setError("Ingresa tu correo.");
    if (!vPassword) return setError("Ingresa tu contraseña.");
    if (String(vPassword).length < 8) return setError("La contraseña debe tener al menos 8 caracteres.");
    if (String(vPassword) !== String(vPassword2)) return setError("Las contraseñas no coinciden.");

    // Mantener returnTo si venía desde una ruta protegida
    const returnTo = readReturnTo(loc.search);
    stashReturnTo(returnTo);

    try {
      setSubmitting(true);
      clearToken();

      // ✅ Registro visitante (endpoint nuevo)
      // Esperado: POST /api/iam/v1/auth/register-visitor
      // body: { name, email, password }
      const res = await api.post("/iam/v1/auth/register-visitor", {
        name,
        email: visitorEmailNorm,
        password: String(vPassword),
      });

      const data = res?.data || {};

      if (data?.ok === false) {
        setError(humanRegisterError(data?.error || data?.message));
        return;
      }

      // Puede devolver token directo (si backend decide loguear) o pedir OTP
      if (data?.token) {
        const tkn = String(data.token || "").trim();
        setToken(tkn);
        await auth.login({ email: visitorEmailNorm }, tkn);

        const picked = consumeReturnTo(loc.search);
        navigate(picked || "/start", { replace: true });
        return;
      }

      if (data?.otpRequired) {
        stashOtpContext({
          email: visitorEmailNorm,
          flow: "register",
          returnTo,
          mustChangePassword: false,
        });
        navigate("/otp", { replace: true });
        return;
      }

      // Fallback UX si backend respondió ok pero no devolvió token/otpRequired
      setInfo("Registro completado. Ahora puedes iniciar sesión en la pestaña de acceso.");
      setMode("internal");
      setIdentifier(visitorEmailNorm);
      setPassword("");
      setVPassword("");
      setVPassword2("");
    } catch (err) {
      const msg =
        err?.response?.data?.error ||
        err?.response?.data?.message ||
        err?.message ||
        "Error registrando visitante";
      setError(humanRegisterError(msg));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100">
      <div className="w-[360px] bg-white shadow-sm border rounded">
        <div className="flex border-b">
          <button
            type="button"
            onClick={() => {
              setMode("internal");
              setError("");
              setInfo("");
            }}
            className={`flex-1 p-3 text-sm font-semibold ${
              mode === "internal" ? "bg-white" : "bg-slate-50 text-slate-600"
            }`}
          >
            Si Tienes cuenta creada Ingresar a SENAF
          </button>

          <button
            type="button"
            onClick={() => {
              setMode("visitor");
              setError("");
              setInfo("");
            }}
            className={`flex-1 p-3 text-sm font-semibold ${
              mode === "visitor" ? "bg-white" : "bg-slate-50 text-slate-600"
            }`}
          >
            Si aun no Tienes cuenta Registrate
          </button>
        </div>

        <div className="p-6">
          <h2 className="text-lg mb-4 font-bold">
            {mode === "internal" ? "Acceso" : "Registro de visita"}
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
                  if (info) setInfo("");
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
                    if (info) setInfo("");
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

              {info && <div className="text-emerald-700 mb-2 text-sm">{info}</div>}
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
                  if (info) setInfo("");
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
                  if (info) setInfo("");
                }}
                autoComplete="email"
                inputMode="email"
              />

              <div className="relative mb-3">
                <input
                  className="border w-full p-2 pr-10"
                  type={showPassVisitor ? "text" : "password"}
                  placeholder="Contraseña (mínimo 8)"
                  autoComplete="new-password"
                  value={vPassword}
                  onChange={(e) => {
                    setVPassword(e.target.value);
                    if (error) setError("");
                    if (info) setInfo("");
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
                  if (info) setInfo("");
                }}
              />

              {info && <div className="text-emerald-700 mb-2 text-sm">{info}</div>}
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
              </div>

              <div className="mt-2 text-[11px] text-gray-400">
                Al registrarte como visitante, podrás iniciar sesión normalmente en la pestaña de acceso.
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}