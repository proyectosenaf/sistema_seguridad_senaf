// client/src/pages/Auth/Entry.jsx
import React from "react";
import { useLocation, useNavigate } from "react-router-dom";

/** Solo permitimos rutas internas tipo /algo */
function safeInternalPath(p) {
  return typeof p === "string" && p.startsWith("/") && !p.startsWith("//");
}

function getReturnToFromSession() {
  try {
    const rt = sessionStorage.getItem("auth:returnTo");
    return safeInternalPath(rt) ? rt : "/start";
  } catch {
    return "/start";
  }
}

async function fetchMe() {
  // VITE_API_BASE_URL incluye /api
  const RAW = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000/api";
  const API_ROOT = String(RAW || "").replace(/\/$/, "");
  const url = `${API_ROOT}/iam/v1/me`;

  const res = await fetch(url, { credentials: "include" });
  if (!res.ok) return null;

  try {
    return await res.json();
  } catch {
    return {};
  }
}

export default function Entry() {
  const { search } = useLocation();
  const nav = useNavigate();

  const [status, setStatus] = React.useState("checking"); // checking | redirecting | error
  const [errMsg, setErrMsg] = React.useState("");

  // 1) captura ?to=/ruta y guárdalo para redirección post-login
  React.useEffect(() => {
    const qs = new URLSearchParams(search);
    const to = qs.get("to");

    try {
      if (safeInternalPath(to)) sessionStorage.setItem("auth:returnTo", to);
      else sessionStorage.removeItem("auth:returnTo");
    } catch {
      // ignore
    }
  }, [search]);

  // 2) check sesión local; si no hay → /login
  React.useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setStatus("checking");
        const me = await fetchMe();

        if (!alive) return;

        // ✅ si me existe, asumimos sesión válida
        if (me) {
          setStatus("redirecting");
          nav(getReturnToFromSession(), { replace: true });
          return;
        }

        // ❌ no autenticado → login local
        setStatus("redirecting");
        nav("/login", { replace: true });
      } catch (e) {
        if (!alive) return;
        setStatus("error");
        setErrMsg(e?.message || "No se pudo verificar la sesión.");
      }
    })();

    return () => {
      alive = false;
    };
  }, [nav]);

  if (status === "error") {
    return (
      <div className="p-6">
        <div className="font-semibold">Error</div>
        <div className="mt-2 text-sm opacity-80">{errMsg}</div>
        <div className="mt-4">
          <button className="underline" onClick={() => nav("/login", { replace: true })}>
            Ir a login
          </button>
        </div>
      </div>
    );
  }

  return <div className="p-6">Verificando sesión…</div>;
}