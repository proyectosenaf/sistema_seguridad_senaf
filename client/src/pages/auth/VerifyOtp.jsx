// client/src/pages/auth/VerifyOtp.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import api, { setToken } from "../../lib/api.js";
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

function getOtpEmail() {
  try {
    return String(localStorage.getItem("senaf_otp_email") || "").trim().toLowerCase();
  } catch {
    return "";
  }
}

function clearOtpContext() {
  try {
    localStorage.removeItem("senaf_otp_email");
  } catch {}
  try {
    sessionStorage.removeItem("senaf_otp_flow");
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

  return codeOrMsg || "Error validando OTP";
}

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

  useEffect(() => {
    const e = getOtpEmail();
    if (e) setEmail(e);
  }, []);

  async function handleVerify(e) {
    e.preventDefault();
    setError("");
    setInfo("");

    if (!emailNorm) return setError("Falta el correo.");
    if (!otp || String(otp).trim().length < 4) return setError("Ingresa el código.");

    try {
      setSubmitting(true);

      const res = await api.post("/iam/v1/auth/verify-otp", {
        email: emailNorm,
        otp: String(otp || "").trim(),
      });

      const data = res?.data || {};

      if (data?.ok === false) {
        setError(humanOtpError(data?.error || data?.message || "Código inválido."));
        return;
      }

      const token = data?.token;
      if (!token) {
        setError("El servidor no devolvió token tras validar OTP.");
        return;
      }

      clearOtpContext();

      setToken(token);
      await auth.login({ email: emailNorm }, token);

      if (data?.mustChangePassword) {
        navigate(`/force-change-password?email=${encodeURIComponent(emailNorm)}`, {
          replace: true,
        });
        return;
      }

      const returnTo = consumeReturnTo(loc.search);
      if (returnTo) {
        navigate(returnTo, { replace: true });
        return;
      }

      navigate("/start", { replace: true });
    } catch (err) {
      const msg =
        err?.response?.data?.error ||
        err?.response?.data?.message ||
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

      // ✅ Nuevo endpoint: no requiere password
      const res = await api.post("/iam/v1/auth/resend-otp", { email: emailNorm });
      const data = res?.data || {};

      if (data?.ok === false) {
        setError(humanOtpError(data?.error || data?.message || "No se pudo reenviar."));
        return;
      }

      setInfo("Listo. Te reenviamos un nuevo código. Revisa bandeja y spam.");
    } catch (err) {
      const msg =
        err?.response?.data?.error ||
        err?.response?.data?.message ||
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
        <div className="text-xs text-slate-500 mb-4">
          Ingresa el código que enviamos a tu correo
        </div>

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