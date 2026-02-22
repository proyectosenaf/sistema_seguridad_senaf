// client/src/pages/ForceChangePassword.jsx
import React from "react";

function getParam(name) {
  const sp = new URLSearchParams(window.location.search);
  return sp.get(name);
}

function apiBase() {
  // Tu convención ya usada en App.jsx: VITE_API_BASE_URL incluye /api
  const RAW = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000/api";
  return String(RAW).replace(/\/$/, "");
}

export default function ForceChangePassword() {
  const [status, setStatus] = React.useState("idle"); // idle | sending | sent | error
  const [msg, setMsg] = React.useState("");

  const email = (getParam("email") || "").trim().toLowerCase();

  // ✅ Evita doble auto-disparo (StrictMode) y reenvíos sin querer
  const ranRef = React.useRef(false);

  async function send({ silent = false } = {}) {
    if (!email) {
      setStatus("error");
      setMsg("No se recibió el email. Vuelve a iniciar sesión.");
      return;
    }

    // si ya está enviando, no dupliques
    if (status === "sending") return;

    setStatus("sending");
    if (!silent) setMsg("");

    try {
      const url = `${apiBase()}/iam/v1/auth/request-password-reset`;

      const res = await fetch(url, {
        method: "POST",
        credentials: "omit",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setStatus("error");
        setMsg(
          data?.message ||
            data?.details ||
            data?.error ||
            "No se pudo enviar el correo. Intenta de nuevo o contacta al administrador."
        );
        return;
      }

      setStatus("sent");
      setMsg(
        "Listo. Te enviamos un correo para establecer tu contraseña. Revisa tu bandeja y spam."
      );
    } catch (e) {
      setStatus("error");
      setMsg(e?.message || "Error de red.");
    }
  }

  React.useEffect(() => {
    // ✅ auto-disparo UNA vez si viene email
    if (!email) return;
    if (ranRef.current) return;
    ranRef.current = true;

    send({ silent: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [email]);

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-neutral-50">
      <div className="w-full max-w-md rounded-2xl border bg-white p-6 shadow-sm">
        <h1 className="text-xl font-semibold">Configura tu contraseña</h1>

        <p className="mt-2 text-sm text-neutral-600">
          Esta cuenta fue creada por un administrador. Por seguridad, debes establecer tu contraseña en el primer inicio de sesión.
        </p>

        <div className="mt-4 rounded-xl border p-3 bg-neutral-50">
          <div className="text-xs text-neutral-500">Cuenta</div>
          <div className="text-sm font-medium">{email || "(sin email)"}</div>
        </div>

        {status === "sending" && (
          <p className="mt-4 text-sm">Enviando correo de restablecimiento…</p>
        )}

        {status === "sent" && (
          <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
            {msg}
          </div>
        )}

        {status === "error" && (
          <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
            {msg || "Ocurrió un error."}
          </div>
        )}

        <div className="mt-5 flex gap-3">
          <button
            onClick={() => send()}
            disabled={status === "sending" || !email}
            className="flex-1 h-11 rounded-xl bg-neutral-900 text-white text-sm font-semibold disabled:opacity-60"
          >
            Reenviar correo
          </button>

          <a
            href="/entry"
            className="h-11 px-4 rounded-xl border flex items-center justify-center text-sm font-semibold"
          >
            Volver
          </a>
        </div>

        <p className="mt-4 text-xs text-neutral-500">
          Si no recibes el correo en 2–3 minutos, revisa Spam/Promociones.
        </p>

        <p className="mt-2 text-[11px] text-neutral-400 break-all">
          API: {apiBase()}
        </p>
      </div>
    </div>
  );
}