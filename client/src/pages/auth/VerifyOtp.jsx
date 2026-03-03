// client/src/pages/auth/VerifyOtp.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import axios from "axios";

import { setToken } from "../../lib/api.js";
import { useAuth } from "./AuthProvider.jsx";

/* ───────────────── constants ───────────────── */
const USER_KEY = "senaf_user";
const RETURN_TO_KEY = "auth:returnTo";
const VISITOR_HINT_KEY = "senaf_is_visitor"; // ✅ hint para ocultar sidebar en refresh

const SUPERADMIN_EMAIL = String(import.meta.env.VITE_SUPERADMIN_EMAIL || "")
  .trim()
  .toLowerCase();

/* ───────────────── helpers ───────────────── */
function safeInternalPath(p) {
  return typeof p === "string" && p.startsWith("/") && !p.startsWith("//");
}

function readReturnTo(locationSearch) {
  const qs = new URLSearchParams(locationSearch || "");
  const fromQuery = qs.get("to");

  const fromSession = (() => {
    try {
      return sessionStorage.getItem(RETURN_TO_KEY);
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
    sessionStorage.removeItem(RETURN_TO_KEY);
  } catch {}
  return picked;
}

function getOtpEmail() {
  try {
    return String(localStorage.getItem("senaf_otp_email") || "")
      .trim()
      .toLowerCase();
  } catch {
    return "";
  }
}

function clearOtpFlowOnly() {
  try {
    sessionStorage.removeItem("senaf_otp_flow");
  } catch {}
}

function clearOtpAll() {
  try {
    localStorage.removeItem("senaf_otp_email");
  } catch {}
  try {
    sessionStorage.removeItem("senaf_otp_flow");
  } catch {}
  try {
    sessionStorage.removeItem("senaf_pwreset_token");
  } catch {}
  try {
    sessionStorage.removeItem("senaf_otp_mustChange");
  } catch {}
}

function humanOtpError(codeOrMsg) {
  const s = String(codeOrMsg || "").toLowerCase();

  if (s.includes("otp_expired")) return "El código venció. Reenvía el código e intenta de nuevo.";
  if (s.includes("otp_not_found")) return "No hay un código activo. Reenvía el código.";
  if (s.includes("otp_invalid")) return "Código incorrecto. Revisa e intenta de nuevo.";
  if (s.includes("otp_max_attempts")) return "Demasiados intentos. Reenvía el código.";
  if (s.includes("otp_resend_cooldown")) return "Espera unos segundos antes de reenviar el código.";
  if (s.includes("employee_otp_disabled")) return "OTP deshabilitado por configuración.";
  if (s.includes("email_and_otp_required")) return "Faltan datos (correo/código).";

  if (s.includes("reset_token_invalid_or_expired"))
    return "Tu sesión de restablecimiento venció. Repite el OTP.";
  if (s.includes("reset_token"))
    return "No se pudo iniciar el restablecimiento. Repite el OTP.";

  if (s.includes("user_inactive")) return "Tu usuario está inactivo. Contacta al administrador.";
  if (s.includes("user_not_found")) return "No se encontró el usuario. Repite el proceso.";
  if (s.includes("email_required")) return "Falta el correo.";

  return codeOrMsg || "Error validando OTP";
}

function isVisitorPayload(data, emailNorm) {
  // Respeta flags explícitos del backend
  const me = data?.me || data?.user || null;
  const roles = Array.isArray(me?.roles) ? me.roles : Array.isArray(data?.roles) ? data.roles : [];

  const roleSet = new Set((roles || []).map((r) => String(r || "").toLowerCase()));

  const flag =
    !!data?.visitor ||
    !!data?.isVisitor ||
    !!me?.visitor ||
    !!me?.isVisitor;

  const byRole = roleSet.has("visita") || roleSet.has("visitor");

  // ✅ superadmin NUNCA se trata como visitor
  if (SUPERADMIN_EMAIL && emailNorm === SUPERADMIN_EMAIL) return false;

  return flag || byRole;
}

function persistMeForAuthProvider(data, emailNorm) {
  // Preferir objeto "me" si backend lo manda
  const me = data?.me || data?.user || null;

  const stored = {
    ...(me && typeof me === "object" ? me : {}),
    email: String((me?.email || data?.email || emailNorm || "")).trim().toLowerCase(),
    roles:
      Array.isArray(me?.roles) ? me.roles :
      Array.isArray(data?.roles) ? data.roles :
      Array.isArray(me?.user?.roles) ? me.user.roles :
      [],
    visitor: !!(me?.visitor || me?.isVisitor || data?.visitor || data?.isVisitor),
    isVisitor: !!(me?.isVisitor || data?.isVisitor),
    can: (me?.can && typeof me.can === "object") ? me.can : (data?.can && typeof data.can === "object") ? data.can : undefined,
    routeRules:
      (me?.routeRules && typeof me.routeRules === "object") ? me.routeRules :
      (data?.routeRules && typeof data.routeRules === "object") ? data.routeRules :
      undefined,
    defaultRoute: me?.defaultRoute || data?.defaultRoute || undefined,
  };

  try {
    localStorage.setItem(USER_KEY, JSON.stringify(stored));
  } catch {}

  return stored;
}

/* ───────────────── component ───────────────── */
export default function VerifyOtp() {
  const navigate = useNavigate();
  const loc = useLocation();
  const auth = useAuth();

  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  const [info, setInfo] = useState("");
  const [error, setError] = useState("");

  const emailNorm = useMemo(() => String(email || "").trim().toLowerCase(), [email]);

  // ✅ Usa la misma convención que tu lib/api.js
  // VITE_API_BASE_URL debe incluir /api
  const publicAuth = useMemo(() => {
    const base = String(import.meta.env.VITE_API_BASE_URL || "http://localhost:4000/api").trim();
    return axios.create({
      baseURL: base.replace(/\/$/, ""),
      headers: {
        "Cache-Control": "no-store",
        Pragma: "no-cache",
      },
      withCredentials: false,
      timeout: 30000,
    });
  }, []);

  useEffect(() => {
    const e = getOtpEmail();
    if (e) setEmail(e);
  }, []);

  async function handleVerify(e) {
    e.preventDefault();
    setError("");
    setInfo("");

    const otpNorm = String(otp || "").replace(/\D/g, "");

    if (!emailNorm) return setError("Falta el correo.");
    if (!otpNorm || otpNorm.length < 4) return setError("Ingresa el código.");

    try {
      setSubmitting(true);

      const res = await publicAuth.post("/public/v1/auth/verify-otp", {
        email: emailNorm,
        otp: otpNorm,
        code: otpNorm, // compat
      });

      const data = res?.data || {};

      if (data?.ok === false) {
        setError(humanOtpError(data?.error || data?.message || "Código inválido."));
        return;
      }

      // OTP válido pero debe resetear password
      if (data?.mustChangePassword) {
        const rt = String(data?.resetToken || "").trim();
        if (!rt) {
          setError("OTP validado, pero el servidor no devolvió resetToken. Repite el proceso.");
          return;
        }

        try {
          sessionStorage.setItem("senaf_pwreset_token", rt);
        } catch {}

        clearOtpFlowOnly();

        // En reset todavía NO definimos visitor hint (aún no hay sesión normal)
        try {
          localStorage.removeItem(VISITOR_HINT_KEY);
        } catch {}

        navigate(
          `/force-change-password?email=${encodeURIComponent(emailNorm)}&rt=${encodeURIComponent(rt)}`,
          { replace: true }
        );
        return;
      }

      // Caso normal: token
      const token = String(data?.token || "").trim();
      if (!token) {
        setError("El servidor no devolvió token tras validar OTP.");
        return;
      }

      // ✅ Persistencias
      clearOtpAll();

      setToken(token);

      // ✅ Persistir "me" / user para que AuthProvider y navConfig tengan estado estable
      const storedMe = persistMeForAuthProvider(data, emailNorm);

      // ✅ Visitor hint (para ocultar sidebar en refresh)
      const isVisitor = isVisitorPayload(data, emailNorm);
      try {
        if (isVisitor) localStorage.setItem(VISITOR_HINT_KEY, "1");
        else localStorage.removeItem(VISITOR_HINT_KEY);
      } catch {}

      // ✅ AuthProvider: guarda token + user en contexto
      await auth.login(storedMe, token);

      // 1) si backend manda next, respétalo
      const nextPath = typeof data?.next === "string" ? data.next : null;
      if (safeInternalPath(nextPath)) {
        navigate(nextPath, { replace: true });
        return;
      }

      // 2) si hay returnTo, úsalo (pero si es visitor, fuerza a visitas)
      const returnTo = consumeReturnTo(loc.search);
      if (returnTo) {
        if (isVisitor && !returnTo.startsWith("/visitas")) {
          navigate("/visitas/agenda", { replace: true });
        } else {
          navigate(returnTo, { replace: true });
        }
        return;
      }

      // 3) default
      if (isVisitor) {
        navigate("/visitas/agenda", { replace: true });
        return;
      }

      navigate("/start", { replace: true });
    } catch (err) {
      const d = err?.response?.data;

      const msg =
        (d && typeof d === "object" && (d.error || d.message)) ||
        (typeof d === "string" ? d : null) ||
        err?.message ||
        "Error validando OTP";

      setError(humanOtpError(msg));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleResend() {
    setError("");
    setInfo("");

    if (!emailNorm) {
      setError("Falta el correo.");
      return;
    }

    try {
      setResending(true);

      const res = await publicAuth.post("/public/v1/auth/resend-otp", {
        email: emailNorm,
      });

      const data = res?.data || {};

      if (data?.ok === false) {
        setError(humanOtpError(data?.error || data?.message || "No se pudo reenviar."));
        return;
      }

      setInfo("Listo. Te reenviamos un nuevo código. Revisa bandeja y spam.");
    } catch (err) {
      const d = err?.response?.data;

      const msg =
        (d && typeof d === "object" && (d.error || d.message)) ||
        (typeof d === "string" ? d : null) ||
        err?.message ||
        "Error reenviando OTP";

      setError(humanOtpError(msg));
    } finally {
      setResending(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100">
      <form onSubmit={handleVerify} className="p-6 border rounded w-96 bg-white shadow-sm">
        <h2 className="text-lg mb-1 font-bold">Verificar código</h2>
        <div className="text-xs text-slate-500 mb-4">Ingresa el código que enviamos a tu correo</div>

        <input
          className="border w-full mb-3 p-2"
          type="email"
          placeholder="Correo"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          inputMode="email"
        />

        <input
          className="border w-full mb-3 p-2 tracking-widest text-center"
          type="text"
          placeholder="Código OTP"
          value={otp}
          onChange={(e) => setOtp(e.target.value)}
          inputMode="numeric"
          autoComplete="one-time-code"
        />

        {info && <div className="text-emerald-700 mb-2 text-sm">{info}</div>}
        {error && <div className="text-red-600 mb-2 text-sm">{error}</div>}

        <button
          type="submit"
          disabled={submitting}
          className="bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white w-full p-2 rounded"
        >
          {submitting ? "Validando..." : "Confirmar"}
        </button>

        <button
          type="button"
          onClick={handleResend}
          disabled={resending || submitting || !emailNorm}
          className="mt-3 w-full p-2 rounded border text-slate-700 bg-white hover:bg-slate-50 disabled:opacity-60"
        >
          {resending ? "Reenviando..." : "Reenviar código"}
        </button>

        <div className="mt-3 text-xs text-slate-500">
          Si no te llega, revisa SPAM. El código puede tardar 1–2 minutos.
        </div>
      </form>
    </div>
  );
}