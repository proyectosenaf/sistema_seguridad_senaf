import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

const RAW = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000/api";
const API_ROOT = String(RAW).replace(/\/$/, "");

export default function VerifyOtp() {
  const navigate = useNavigate();

  const [code, setCode] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  useEffect(() => {
    const savedEmail = localStorage.getItem("senaf_otp_email");
    if (savedEmail) setEmail(savedEmail);
  }, []);

  async function handleVerify(e) {
    e.preventDefault();
    setError("");
    setInfo("");

    if (!code || code.length < 4) {
      setError("Ingresa un código válido.");
      return;
    }

    try {
      setLoading(true);

      const res = await fetch(`${API_ROOT}/iam/v1/otp/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data?.error || "Código inválido.");
      }

      // Guardar token si backend lo devuelve
      if (data?.token) {
        localStorage.setItem("senaf_token", data.token);
      }

      localStorage.removeItem("senaf_otp_email");

      navigate("/start", { replace: true });
    } catch (err) {
      setError(err.message || "Error verificando código.");
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    setError("");
    setInfo("");

    if (!email) {
      setError("No se encontró el correo.");
      return;
    }

    try {
      setLoading(true);

      const res = await fetch(`${API_ROOT}/iam/v1/otp/resend`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data?.error || "No se pudo reenviar el código.");
      }

      setInfo("Código reenviado correctamente.");
    } catch (err) {
      setError(err.message || "Error reenviando código.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900 text-white px-4">
      <div className="w-full max-w-md bg-slate-800 p-8 rounded-xl shadow-xl">
        <h2 className="text-2xl font-bold mb-2 text-center">Verificación OTP</h2>

        <p className="text-sm text-slate-400 text-center mb-6">
          Ingresa el código enviado a tu correo.
        </p>

        <form onSubmit={handleVerify} className="space-y-4">
          <div>
            <label className="block text-sm mb-1">Código</label>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              maxLength={6}
              className="w-full px-3 py-2 rounded bg-slate-700 border border-slate-600 focus:outline-none focus:ring-2 focus:ring-purple-500 text-center tracking-widest text-lg"
              placeholder="000000"
            />
          </div>

          {error && (
            <div className="text-red-400 text-sm text-center">{error}</div>
          )}

          {info && (
            <div className="text-green-400 text-sm text-center">{info}</div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 rounded bg-purple-600 hover:bg-purple-700 transition disabled:opacity-50"
          >
            {loading ? "Verificando..." : "Verificar"}
          </button>
        </form>

        <div className="mt-4 text-center">
          <button
            onClick={handleResend}
            disabled={loading}
            className="text-sm text-purple-400 hover:underline disabled:opacity-50"
          >
            Reenviar código
          </button>
        </div>
      </div>
    </div>
  );
}