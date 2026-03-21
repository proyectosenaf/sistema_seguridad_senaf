import React, { useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import axios from "axios";
import { Eye, EyeOff } from "lucide-react";
import api, {
  API as API_BASE,
  getToken,
  clearToken,
  setToken,
} from "../../lib/api.js";
import { useAuth } from "./AuthProvider.jsx";
import AuthBackground from "../../components/AuthBackground.jsx";

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

  return (
    (safeInternalPath(fromQuery) && fromQuery) ||
    (safeInternalPath(fromSession) && fromSession) ||
    null
  );
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

  if (s.includes("user_not_found")) {
    return "No existe una cuenta con ese correo. Regístrate en la pestaña de registro.";
  }
  if (s.includes("invalid_credentials")) {
    return "Credenciales inválidas. Revisa correo y contraseña.";
  }
  if (
    s.includes("password_not_set") ||
    s.includes("password_not_configured")
  ) {
    return "Tu usuario no tiene contraseña configurada. Contacta al administrador.";
  }
  if (s.includes("user_inactive")) {
    return "Tu usuario está inactivo. Contacta al administrador.";
  }
  if (s.includes("not_local_user")) {
    return "Usuario no permitido para login local.";
  }
  if (s.includes("employee_otp_disabled")) {
    return "OTP deshabilitado por configuración.";
  }
  if (s.includes("otp_resend_cooldown")) {
    return "Espera unos segundos y vuelve a intentar.";
  }
  if (s.includes("otp_required")) {
    return "Debes validar el código OTP para continuar.";
  }
  if (s.includes("forbidden")) {
    return "Acceso denegado para este usuario. Revisa su configuración.";
  }
  if (s.includes("network error")) {
    return "Error de conexión con el servidor.";
  }

  return codeOrMsg || "Login fallido.";
}

function humanRegisterError(codeOrMsg) {
  const s = String(codeOrMsg || "").toLowerCase();

  if (s.includes("name_required")) return "Ingresa tu nombre completo.";
  if (s.includes("email_required")) return "Ingresa tu correo.";
  if (s.includes("password_required")) return "Ingresa una contraseña.";
  if (s.includes("password_too_short")) {
    return "La contraseña debe tener al menos 8 caracteres.";
  }
  if (s.includes("email_invalid")) return "Correo inválido. Revisa el formato.";
  if (s.includes("email_taken") || s.includes("user_exists")) {
    return "Ya existe una cuenta con ese correo. Inicia sesión.";
  }
  if (s.includes("user_inactive")) {
    return "Tu usuario está inactivo. Contacta al administrador.";
  }

  return codeOrMsg || "No se pudo completar el registro.";
}

function passwordPolicyErrorLettersNumbersSpecial(pw) {
  const s = String(pw || "");

  if (s.length < 8) return "La contraseña debe tener al menos 8 caracteres.";
  if (!/[A-Za-z]/.test(s)) {
    return "La contraseña debe incluir al menos 1 letra.";
  }
  if (!/[0-9]/.test(s)) return "La contraseña debe incluir al menos 1 número.";
  if (!/[^A-Za-z0-9]/.test(s)) {
    return "La contraseña debe incluir al menos 1 carácter especial (ej: !@#$%).";
  }

  return "";
}

const VISITOR_HINT_KEY = "senaf_is_visitor";

function setVisitorHint(isVisitor) {
  try {
    if (isVisitor) localStorage.setItem(VISITOR_HINT_KEY, "1");
    else localStorage.removeItem(VISITOR_HINT_KEY);
  } catch {}
}

function clearOtpContext() {
  try {
    localStorage.removeItem("senaf_otp_email");
  } catch {}
  try {
    sessionStorage.removeItem("senaf_otp_flow");
  } catch {}
  try {
    sessionStorage.removeItem("senaf_otp_mustChange");
  } catch {}
}

function readTokenFromPayload(data) {
  return String(
    data?.token ||
      data?.accessToken ||
      data?.jwt ||
      data?.data?.token ||
      data?.data?.accessToken ||
      ""
  ).trim();
}

function inputClass() {
  return "border border-slate-300/80 dark:border-slate-700/80 bg-white/80 dark:bg-slate-950/40 text-slate-900 dark:text-slate-100 w-full p-2 rounded outline-none focus:ring-2 focus:ring-blue-500/30";
}

export default function LoginLocal() {
  const navigate = useNavigate();
  const loc = useLocation();
  const auth = useAuth();

  const internalSubmitLock = useRef(false);
  const visitorSubmitLock = useRef(false);

  const [mode, setMode] = useState("internal");

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");

  const [fullName, setFullName] = useState("");
  const [vEmail, setVEmail] = useState("");
  const [vPassword, setVPassword] = useState("");
  const [vPassword2, setVPassword2] = useState("");

  const [showPassInternal, setShowPassInternal] = useState(false);
  const [showPassVisitor, setShowPassVisitor] = useState(false);
  const [showPassVisitor2, setShowPassVisitor2] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  const emailNorm = useMemo(
    () => String(identifier || "").trim().toLowerCase(),
    [identifier]
  );

  const visitorEmailNorm = useMemo(
    () => String(vEmail || "").trim().toLowerCase(),
    [vEmail]
  );

  function stashOtpContext({ email, flow, returnTo, mustChangePassword } = {}) {
    try {
      localStorage.setItem("senaf_otp_email", String(email || ""));
    } catch {}
    try {
      sessionStorage.setItem("senaf_otp_flow", String(flow || "login"));
    } catch {}
    if (returnTo) {
      try {
        sessionStorage.setItem("auth:returnTo", returnTo);
      } catch {}
    }
    try {
      sessionStorage.setItem(
        "senaf_otp_mustChange",
        mustChangePassword ? "1" : "0"
      );
    } catch {}
  }

  const publicAuth = useMemo(() => {
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

  async function submitInternal(e) {
    e.preventDefault();

    if (internalSubmitLock.current) return;
    internalSubmitLock.current = true;

    setError("");
    setInfo("");

    try {
      if (!emailNorm || !emailNorm.includes("@")) {
        setError("Ingresa tu correo (email).");
        return;
      }
      if (!password) {
        setError("Ingresa tu contraseña.");
        return;
      }

      const returnTo = consumeReturnTo(loc.search);

      setSubmitting(true);

      clearToken();
      clearOtpContext();
      setVisitorHint(false);

      const res = await publicAuth.post("/public/v1/auth/login-otp", {
        email: emailNorm,
        password: String(password || ""),
      });

      const data = res?.data || {};

      if (data?.ok === false) {
        setError(humanLoginError(data?.error || data?.message));
        return;
      }

      const directToken = readTokenFromPayload(data);

      if (data?.otpRequired === false && directToken) {
        setToken(directToken);
        setVisitorHint(false);

        await auth.login({ email: emailNorm }, directToken);

        if (data?.mustChangePassword) {
          navigate(
            `/force-change-password?email=${encodeURIComponent(emailNorm)}`,
            {
              replace: true,
            }
          );
          return;
        }

        navigate(returnTo || "/start", { replace: true });
        return;
      }

      if (data?.otpRequired) {
        setVisitorHint(false);

        stashOtpContext({
          email: emailNorm,
          flow: "login",
          returnTo,
          mustChangePassword: !!data?.mustChangePassword,
        });

        navigate("/otp", { replace: true });
        return;
      }

      setError("Respuesta inesperada del servidor (sin token/otpRequired).");
    } catch (err) {
      const d = err?.response?.data;
      const msg =
        (d &&
          typeof d === "object" &&
          (d.error || d.message || d.details)) ||
        err?.message ||
        "Error de conexión";

      setError(humanLoginError(msg));

      const st = err?.response?.status || err?.status;
      if (st === 401 || st === 403) {
        clearToken();
        setVisitorHint(false);
      }
    } finally {
      setSubmitting(false);
      internalSubmitLock.current = false;
    }
  }

  async function submitVisitor(e) {
    e.preventDefault();

    if (visitorSubmitLock.current) return;
    visitorSubmitLock.current = true;

    setError("");
    setInfo("");

    try {
      const name = String(fullName || "").trim();
      if (!name) {
        setError("Ingresa tu nombre.");
        return;
      }
      if (!visitorEmailNorm || !visitorEmailNorm.includes("@")) {
        setError("Ingresa tu correo.");
        return;
      }

      if (!vPassword) {
        setError("Ingresa tu contraseña.");
        return;
      }

      const policyMsg = passwordPolicyErrorLettersNumbersSpecial(vPassword);
      if (policyMsg) {
        setError(policyMsg);
        return;
      }

      if (String(vPassword) !== String(vPassword2)) {
        setError("Las contraseñas no coinciden.");
        return;
      }

      const returnTo = readReturnTo(loc.search);
      stashReturnTo(returnTo);

      setSubmitting(true);
      clearToken();
      clearOtpContext();

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

      setVisitorHint(true);

      const directToken = readTokenFromPayload(data);

      if (directToken) {
        setToken(directToken);
        await auth.login({ email: visitorEmailNorm }, directToken);
        navigate("/visitas/agenda", { replace: true });
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

      setInfo(
        "Registro completado. Ahora puedes iniciar sesión en la pestaña de acceso."
      );
      setMode("internal");
      setIdentifier(visitorEmailNorm);
      setPassword("");
      setVPassword("");
      setVPassword2("");
      setVisitorHint(false);
    } catch (err) {
      const d = err?.response?.data;
      const msg =
        (d &&
          typeof d === "object" &&
          (d.error || d.message || d.details)) ||
        err?.message ||
        "Error registrando visitante";

      setError(humanRegisterError(msg));
      setVisitorHint(false);
    } finally {
      setSubmitting(false);
      visitorSubmitLock.current = false;
    }
  }

  return (
    <AuthBackground
      imageUrl="/images/senaf-bg.png"
      variant="cover"
      opacity={0.5}
      blurPx={0}
    >
      <div className="w-[400px]">
        <div className="relative rounded border border-slate-200/80 bg-white/90 shadow-sm backdrop-blur-md dark:border-slate-800/80 dark:bg-slate-900/85">
          <div
            className="pointer-events-none absolute inset-0 bg-contain bg-center bg-no-repeat opacity-[0.06] dark:opacity-[0.05]"
            style={{ backgroundImage: "url('/images/senaf-bg.png')" }}
          />

          <div className="relative z-10">
            <div className="flex border-b border-slate-200/80 dark:border-slate-800/80">
              <button
                type="button"
                onClick={() => {
                  setMode("internal");
                  setError("");
                  setInfo("");
                }}
                className={`flex-1 p-3 text-sm font-semibold ${
                  mode === "internal"
                    ? "bg-white/70 dark:bg-slate-900/60"
                    : "bg-slate-50/60 text-slate-600 dark:bg-slate-950/40 dark:text-slate-300"
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
                  mode === "visitor"
                    ? "bg-white/70 dark:bg-slate-900/60"
                    : "bg-slate-50/60 text-slate-600 dark:bg-slate-950/40 dark:text-slate-300"
                }`}
              >
                Si aun no Tienes cuenta Registrate
              </button>
            </div>

            <div className="p-6">
              <h2 className="mb-4 text-lg font-bold text-slate-900 dark:text-slate-100">
                {mode === "internal" ? "Acceso" : "Registro de visita"}
              </h2>

              {mode === "internal" ? (
                <form onSubmit={submitInternal}>
                  <input
                    className={`${inputClass()} mb-3`}
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
                      className={`${inputClass()} pr-10`}
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
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
                      aria-label={
                        showPassInternal
                          ? "Ocultar contraseña"
                          : "Mostrar contraseña"
                      }
                      title={showPassInternal ? "Ocultar" : "Mostrar"}
                    >
                      {showPassInternal ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>

                  {info && (
                    <div className="mb-2 text-sm text-emerald-700 dark:text-emerald-400">
                      {info}
                    </div>
                  )}
                  {error && (
                    <div className="mb-2 text-sm text-red-600 dark:text-red-400">
                      {error}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full rounded bg-blue-600 p-2 text-white hover:bg-blue-700 disabled:opacity-60"
                  >
                    {submitting ? "Procesando..." : "Continuar"}
                  </button>

                  <div className="mt-3 flex justify-end">
                    <button
                      type="button"
                      onClick={() => navigate("/forgot-password")}
                      className="text-sm text-blue-600 hover:underline"
                    >
                      ¿Olvidaste tu contraseña?
                    </button>
                  </div>

                  <div className="mt-3 text-xs text-slate-500 dark:text-slate-400">
                    API: <span className="font-mono">{API_BASE || "—"}</span>
                    {getToken() ? (
                      <span className="ml-2 text-emerald-700 dark:text-emerald-400">
                        (token)
                      </span>
                    ) : null}
                  </div>
                </form>
              ) : (
                <form onSubmit={submitVisitor}>
                  <input
                    className={`${inputClass()} mb-3`}
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
                    className={`${inputClass()} mb-3`}
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

                  <div className="relative mb-2">
                    <input
                      className={`${inputClass()} pr-10`}
                      type={showPassVisitor ? "text" : "password"}
                      placeholder="Contraseña (8+, letras, números y especial)"
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
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
                      aria-label={
                        showPassVisitor
                          ? "Ocultar contraseña"
                          : "Mostrar contraseña"
                      }
                      title={showPassVisitor ? "Ocultar" : "Mostrar"}
                    >
                      {showPassVisitor ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>

                  <div className="mb-3 text-[11px] text-slate-500 dark:text-slate-400">
                    Mínimo 8 caracteres, debe incluir letras, números y un
                    carácter especial.
                  </div>

                  <div className="relative mb-3">
                    <input
                      className={`${inputClass()} pr-10`}
                      type={showPassVisitor2 ? "text" : "password"}
                      placeholder="Confirmar contraseña"
                      autoComplete="new-password"
                      value={vPassword2}
                      onChange={(e) => {
                        setVPassword2(e.target.value);
                        if (error) setError("");
                        if (info) setInfo("");
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassVisitor2((v) => !v)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
                      aria-label={
                        showPassVisitor2
                          ? "Ocultar contraseña"
                          : "Mostrar contraseña"
                      }
                      title={showPassVisitor2 ? "Ocultar" : "Mostrar"}
                    >
                      {showPassVisitor2 ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>

                  {info && (
                    <div className="mb-2 text-sm text-emerald-700 dark:text-emerald-400">
                      {info}
                    </div>
                  )}
                  {error && (
                    <div className="mb-2 text-sm text-red-600 dark:text-red-400">
                      {error}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full rounded bg-blue-600 p-2 text-white hover:bg-blue-700 disabled:opacity-60"
                  >
                    {submitting ? "Procesando..." : "Continuar"}
                  </button>

                  <div className="mt-3 text-xs text-slate-500 dark:text-slate-400">
                    API: <span className="font-mono">{API_BASE || "—"}</span>
                  </div>

                  <div className="mt-2 text-[11px] text-slate-400 dark:text-slate-500">
                    Al registrarte como visitante, entrarás al flujo de visitas
                    (sin menú del sistema).
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      </div>
    </AuthBackground>
  );
}