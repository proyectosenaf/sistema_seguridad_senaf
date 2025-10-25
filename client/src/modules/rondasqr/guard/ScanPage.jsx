// client/src/modules/rondasqr/guard/ScanPage.jsx
import React, { useState, useMemo, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import SidebarGuard from "./SidebarGuard.jsx";
import { rondasqrApi } from "../api/rondasqrApi";
import { useAuth0 } from "@auth0/auth0-react";

/* ────────────── helpers ────────────── */
function toArr(v) {
  if (!v) return [];
  return Array.isArray(v) ? v : [v];
}
function uniqLower(arr) {
  return Array.from(new Set(toArr(arr).map((x) => String(x).trim().toLowerCase()).filter(Boolean)));
}

/* ──────────────────────────────────────────────────────── */
export default function ScanPage() {
  const nav = useNavigate();
  const { pathname, hash } = useLocation();
  const { user } = useAuth0();

  /* Namespaces Auth0 */
  const ROLES_CLAIM = "https://senaf.local/roles";
  const PERMS_CLAIM = "https://senaf.local/permissions";

  // roles/permisos desde distintos orígenes
  const rolesAuth0 = uniqLower(user?.roles);
  const rolesClaim = uniqLower(user?.[ROLES_CLAIM]);
  const permsClaim = uniqLower(user?.[PERMS_CLAIM]);

  // Overrides locales (modo DEV)
  const devRoles = import.meta.env.DEV
    ? uniqLower((localStorage.getItem("iamDevRoles") || "").split(","))
    : [];
  const devPerms = import.meta.env.DEV
    ? uniqLower((localStorage.getItem("iamDevPerms") || "").split(","))
    : [];

  // Combinamos todos
  const roles = uniqLower([...rolesAuth0, ...rolesClaim, ...devRoles]);
  const perms = uniqLower([...permsClaim, ...devPerms]);

  // Reglas de visibilidad
  const isAdminLike =
    perms.includes("*") || roles.includes("admin") || roles.includes("rondasqr.admin");
  const isSupervisorLike =
    roles.includes("supervisor") || perms.includes("rondasqr.view") || perms.includes("rondasqr.reports");

  // pestaña activa
  const tab = useMemo(() => {
    if (pathname.endsWith("/qr")) return "qr";
    if (pathname.endsWith("/msg")) return "msg";
    if (pathname.endsWith("/fotos")) return "fotos";
    return "home";
  }, [pathname]);

  /* Estado local */
  const [msg, setMsg] = useState("");
  const [photos, setPhotos] = useState([null, null, null, null, null]);
  const [sendingAlert, setSendingAlert] = useState(false);
  const [sendingMsg, setSendingMsg] = useState(false);
  const [sendingPhotos, setSendingPhotos] = useState(false);

  /* disparar alerta si llega con hash */
  useEffect(() => {
    if (hash === "#alert") {
      (async () => {
        await sendAlert();
        nav("/rondasqr/scan", { replace: true });
      })();
    }
  }, [hash, nav]);

  /* Funciones principales */
  async function sendAlert() {
    if (sendingAlert) return;
    setSendingAlert(true);
    try {
      let gps;
      if ("geolocation" in navigator) {
        await new Promise((resolve) => {
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              gps = { lat: pos.coords.latitude, lon: pos.coords.longitude };
              resolve();
            },
            () => resolve(),
            { enableHighAccuracy: true, timeout: 5000 }
          );
        });
      }
      await rondasqrApi.panic(gps);
      alert("🚨 Alerta de pánico enviada.");
    } catch {
      alert("No se pudo enviar la alerta.");
    } finally {
      setSendingAlert(false);
    }
  }

  async function sendMessage() {
    if (sendingMsg) return;
    if (!msg.trim()) return alert("Escribe un mensaje.");
    setSendingMsg(true);
    try {
      await rondasqrApi.postIncident({ text: msg.trim() });
      alert("✅ Mensaje enviado.");
      setMsg("");
      nav("/rondasqr/scan");
    } catch {
      alert("No se pudo enviar el mensaje.");
    } finally {
      setSendingMsg(false);
    }
  }

  async function sendPhotos() {
    if (sendingPhotos) return;
    const base64s = photos.filter(Boolean);
    if (!base64s.length) return alert("Selecciona al menos una foto.");
    setSendingPhotos(true);
    try {
      await rondasqrApi.postIncident({ text: "Fotos de ronda", photosBase64: base64s });
      alert("📤 Fotos enviadas.");
      setPhotos([null, null, null, null, null]);
      nav("/rondasqr/scan");
    } catch {
      alert("No se pudieron enviar las fotos.");
    } finally {
      setSendingPhotos(false);
    }
  }

  /* Estilos comunes */
  const pageClass = "flex min-h-screen bg-transparent text-white";
  const headerClass =
    "glass-card glass-header neon-border px-6 py-3 mb-5 rounded-2xl flex justify-between items-center";
  const cardClass = "glass-card neon-border rounded-2xl p-6";
  const neutralBtn =
    "px-4 py-2 rounded-lg border border-white/10 bg-white/10 hover:bg-white/20 transition";
  const coloredBtn = (color) =>
    `btn-neon ${
      color === "red"
        ? "btn-red"
        : color === "green"
        ? "btn-green"
        : color === "blue"
        ? "btn-blue"
        : color === "orange"
        ? "btn-orange"
        : ""
    } px-4 py-2 rounded-lg font-semibold transition`;

  const homeCols = isAdminLike || isSupervisorLike ? "md:grid-cols-3" : "md:grid-cols-2";

  /* Render principal */
  return (
    <div className={pageClass}>
      <SidebarGuard />

      <main className="flex-1 flex flex-col overflow-y-auto p-6">
        <div className={headerClass}>
          <h2 className="text-2xl font-bold">Panel Principal de Rondas de Vigilancia</h2>
          <div className="text-sm">
            Intervalo de tiempo: <span className="font-semibold">4h:00m</span>
          </div>
        </div>

        {tab === "home" && (
          <div className={`grid grid-cols-1 ${homeCols} gap-6`}>
            {/* ALERTA */}
            <div className={cardClass + " text-center"}>
              <button
                onClick={sendAlert}
                disabled={sendingAlert}
                className={`btn-neon btn-red w-44 h-44 rounded-full text-2xl font-extrabold border-4 border-red-400 ${
                  sendingAlert ? "cursor-not-allowed" : ""
                }`}
              >
                {sendingAlert ? "ENVIANDO..." : "ALERTA"}
              </button>
              <div className="text-sm mt-2 opacity-80">Oprima en caso de emergencia</div>

              <div className="mt-6 grid gap-3">
                <button onClick={() => nav("/rondasqr/scan/qr")} className={coloredBtn("blue")}>
                  Registrador Punto Control
                </button>
                <button onClick={() => nav("/rondasqr/scan/msg")} className={coloredBtn("blue")}>
                  Mensaje Incidente
                </button>
                <button onClick={() => nav("/rondasqr/scan/fotos")} className={coloredBtn("blue")}>
                  Fotos de remitentes
                </button>
              </div>
            </div>

            {/* ESCANEAR */}
            <div className={cardClass}>
              <h3 className="font-semibold text-lg mb-3">Escanear Punto</h3>
              <div className="aspect-[3/2] bg-black/60 rounded-xl border-4 border-yellow-500 flex items-center justify-center text-yellow-400 text-4xl">
                ☐
              </div>
              <div className="mt-4 flex gap-3">
                <button onClick={() => nav("/rondasqr/scan/qr")} className={coloredBtn("green") + " flex-1"}>
                  Escanear
                </button>
                <button className={coloredBtn("orange") + " flex-1"}>Finalizar</button>
              </div>
            </div>

            {/* ACCIONES (solo admin/supervisor) */}
            {(isAdminLike || isSupervisorLike) && (
              <div className={cardClass}>
                <h3 className="font-semibold text-lg mb-3">Acciones</h3>
                <p className="text-white/80 text-sm mb-4">
                  Acciones avanzadas disponibles para supervisores o administradores.
                </p>
                <div className="grid gap-3">
                  <button onClick={() => nav("/rondasqr/reports")} className={neutralBtn}>
                    Abrir informes
                  </button>
                  {isAdminLike && (
                    <button onClick={() => nav("/rondasqr/admin")} className={neutralBtn}>
                      Administración de rondas
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* MENSAJE */}
        {tab === "msg" && (
          <div className={cardClass}>
            <h3 className="text-lg font-semibold mb-3">Mensaje / Incidente</h3>
            <textarea
              className="w-full rounded-lg bg-black/30 border border-white/10 px-3 py-2 text-white placeholder-white/60"
              rows={5}
              placeholder="Describa el incidente..."
              value={msg}
              onChange={(e) => setMsg(e.target.value)}
            />
            <div className="mt-4 flex justify-end gap-3">
              <button onClick={() => nav("/rondasqr/scan")} className={neutralBtn}>
                Cancelar
              </button>
              <button onClick={sendMessage} disabled={sendingMsg} className={coloredBtn("blue")}>
                {sendingMsg ? "Enviando…" : "Enviar"}
              </button>
            </div>
          </div>
        )}

        {/* FOTOS */}
        {tab === "fotos" && (
          <div className={cardClass}>
            <h3 className="font-semibold text-lg mb-3">Enviar Fotos</h3>
            <PhotoPicker photos={photos} setPhotos={setPhotos} />
            <div className="mt-4 flex justify-end gap-3">
              <button onClick={() => nav("/rondasqr/scan")} className={neutralBtn}>
                Cancelar
              </button>
              <button onClick={sendPhotos} disabled={sendingPhotos} className={coloredBtn("blue")}>
                {sendingPhotos ? "Enviando…" : "Enviar"}
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

/* Subcomponente para fotos */
function PhotoPicker({ photos, setPhotos }) {
  return (
    <>
      {photos.map((f, i) => (
        <div key={i} className="flex items-center justify-between mb-2">
          <span className="text-sm text-white/90">Toma foto {i + 1}</span>
          <div className="flex gap-2">
            <input
              type="file"
              accept="image/*"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const base64 = await fileToBase64(file);
                setPhotos((p) => {
                  const n = [...p];
                  n[i] = base64;
                  return n;
                });
              }}
              className="hidden"
              id={`foto-${i}`}
            />
            <label
              htmlFor={`foto-${i}`}
              className="px-3 py-1 rounded-md bg-blue-600 hover:bg-blue-500 text-white cursor-pointer"
            >
              Seleccionar
            </label>
            <button
              onClick={() => setPhotos((p) => p.map((f2, idx) => (idx === i ? null : f2)))}
              className="px-3 py-1 rounded-md bg-red-600 hover:bg-red-500 text-white"
            >
              Eliminar
            </button>
          </div>
        </div>
      ))}
    </>
  );
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}
