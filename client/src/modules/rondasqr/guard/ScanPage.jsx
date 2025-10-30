import React, { useState, useMemo, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import SidebarGuard from "./SidebarGuard.jsx";
import QrScanner from "./QrScanner.jsx";
import { rondasqrApi } from "../api/rondasqrApi.js";
import { useAuth0 } from "@auth0/auth0-react";
/* 🆕 */
import { useAssignmentSocket } from "../hooks/useAssignmentSocket.js";

/* Utils */
function toArr(v) { return !v ? [] : Array.isArray(v) ? v : [v]; }
function uniqLower(arr) {
  return Array.from(new Set(toArr(arr).map((x) => String(x).trim().toLowerCase()).filter(Boolean)));
}

export default function ScanPage() {
  const nav = useNavigate();
  const { pathname, hash } = useLocation();
  const { user } = useAuth0();

  const [isNavOpen, setIsNavOpen] = useState(false); // drawer móvil
  useEffect(() => { setIsNavOpen(false); }, [pathname]);
  useEffect(() => {
    document.body.style.overflow = isNavOpen ? "hidden" : "";
    return () => (document.body.style.overflow = "");
  }, [isNavOpen]);

  /* 🆕: pedir permiso de notificaciones del navegador una sola vez */
  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission().catch(() => {});
    }
  }, []);

  /* 🆕: escuchar asignaciones nuevas para este guardia (user.sub)
     Nota: el hook ya muestra notificación y reproduce sonido,
     aquí solo podrías refrescar UI si hace falta. */
  useAssignmentSocket(user, (_payload) => {
    // Ejemplo: refrescar contadores/listas si necesitas
    // console.log("Nueva asignación recibida:", _payload);
  });

  const ROLES_CLAIM = "https://senaf.local/roles";
  const PERMS_CLAIM = "https://senaf.local/permissions";

  const rolesAuth0 = uniqLower(user?.roles);
  const rolesClaim = uniqLower(user?.[ROLES_CLAIM]);
  const permsClaim = uniqLower(user?.[PERMS_CLAIM]);

  const devRoles = import.meta.env.DEV
    ? uniqLower((localStorage.getItem("iamDevRoles") || "").split(","))
    : [];
  const devPerms = import.meta.env.DEV
    ? uniqLower((localStorage.getItem("iamDevPerms") || "").split(","))
    : [];

  const roles = uniqLower([...rolesAuth0, ...rolesClaim, ...devRoles]);
  const perms = uniqLower([...permsClaim, ...devPerms]);

  const isAdminLike =
    perms.includes("*") || roles.includes("admin") || roles.includes("rondasqr.admin");
  const isSupervisorLike =
    roles.includes("supervisor") || perms.includes("rondasqr.view") || perms.includes("rondasqr.reports");

  const tab = useMemo(() => {
    if (pathname.endsWith("/qr")) return "qr";
    if (pathname.endsWith("/msg")) return "msg";
    if (pathname.endsWith("/fotos")) return "fotos";
    return "home";
  }, [pathname]);

  const [msg, setMsg] = useState("");
  const [photos, setPhotos] = useState([null, null, null, null, null]);
  const [sendingAlert, setSendingAlert] = useState(false);
  const [sendingMsg, setSendingMsg] = useState(false);
  const [sendingPhotos, setSendingPhotos] = useState(false);

  // --- Carga de plan/puntos para progreso ---
  const [planMeta, setPlanMeta] = useState(null); // {siteId, roundId}
  const [points, setPoints] = useState([]);        // [{_id,name,order,qrCode}, ...]

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const plans = await rondasqrApi.listPlans(); // {items:[]}
        const plan = plans?.items?.[0] || null;
        if (!alive || !plan) return;

        setPlanMeta({ siteId: plan.siteId, roundId: plan.roundId });

        const pts = await rondasqrApi.listPoints({
          siteId: plan.siteId,
          roundId: plan.roundId,
        });
        if (!alive) return;
        setPoints(pts?.items || []);
      } catch (e) {
        console.warn("[ScanPage] No se pudieron cargar puntos", e);
      }
    })();
    return () => { alive = false; };
  }, []);

  // ---- Progreso (persistido en localStorage) ----
  const [progress, setProgress] = useState({ lastPoint: null, nextPoint: null, pct: 0 });
  function loadLocalProgress() {
    const lastPoint = localStorage.getItem("rondasqr:lastPointName") || null;
    const nextPoint = localStorage.getItem("rondasqr:nextPointName") || null;
    const pct = Math.max(0, Math.min(100, Number(localStorage.getItem("rondasqr:progressPct") || 0)));
    setProgress({ lastPoint, nextPoint, pct });
  }
  useEffect(() => { loadLocalProgress(); }, []);

  // ---- Alerta rápida (#alert) ----
  useEffect(() => {
    if (hash === "#alert") {
      (async () => {
        await sendAlert();
        nav("/rondasqr/scan", { replace: true });
      })();
    }
  }, [hash, nav]);

  async function sendAlert() {
    if (sendingAlert) return;
    setSendingAlert(true);
    try {
      let gps;
      if ("geolocation" in navigator) {
        await new Promise((resolve) => {
          navigator.geolocation.getCurrentPosition(
            (pos) => { gps = { lat: pos.coords.latitude, lon: pos.coords.longitude }; resolve(); },
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

  /* ===== Estilos listos para claro/oscuro ===== */
  const pageClass =
    "flex min-h-screen bg-transparent text-slate-800 dark:text-slate-100";

  const headerClass =
    "rounded-xl px-4 sm:px-6 py-3 mb-4 sm:mb-6 flex items-center justify-between " +
    "bg-white shadow border border-slate-200 " +
    "dark:bg-white/5 dark:shadow-none dark:border-white/10 dark:backdrop-blur";

  const cardClass =
    "rounded-xl p-4 sm:p-6 " +
    "bg-white shadow border border-slate-200 " +
    "dark:bg-white/5 dark:shadow-none dark:border-white/10 dark:backdrop-blur";

  const neutralBtn =
    "px-4 py-2 rounded-lg border font-medium " +
    "border-slate-300 bg-slate-100 hover:bg-slate-200 text-slate-800 " +
    "dark:border-white/15 dark:bg-white/10 dark:hover:bg-white/20 dark:text-white";

  const neonStyles = `
    .btn-neon { padding:.5rem 1rem;border-radius:.5rem;font-weight:600;color:#fff;
      background-image:linear-gradient(90deg,#8b5cf6,#06b6d4);
      box-shadow:0 10px 28px rgba(99,102,241,.28),0 6px 20px rgba(6,182,212,.22);
      transition:filter .2s ease, transform .2s ease; }
    .btn-neon:hover { filter:brightness(1.06); transform:translateY(-1px); }
    .btn-neon:active { transform:translateY(0); }
    .btn-neon-green  { background-image:linear-gradient(90deg,#22c55e,#06b6d4); }
    .btn-neon-rose   { background-image:linear-gradient(90deg,#f43f5e,#fb7185); }
    .btn-neon-amber  { background-image:linear-gradient(90deg,#f59e0b,#ef4444); }
    .btn-neon-purple { background-image:linear-gradient(90deg,#a855f7,#6366f1); }
    .dark .btn-neon { box-shadow:0 14px 36px rgba(99,102,241,.38),0 10px 28px rgba(6,182,212,.28); }
  `;

  const homeCols =
    (isAdminLike || isSupervisorLike) ? "md:grid-cols-2 xl:grid-cols-3" : "md:grid-cols-2";

  // ==== Handler principal de lectura ====
  // evita doble POST si ZXing entrega 2 lecturas muy seguidas
  const lastScanRef = React.useRef({ text: "", at: 0 });

  const handleScan = async (text) => {
    const now = Date.now();
    if (lastScanRef.current.text === text && now - lastScanRef.current.at < 2000) {
      return; // antirrebote
    }
    lastScanRef.current = { text, at: now };

    try {
      // GPS opcional
      let gps;
      if ("geolocation" in navigator) {
        await new Promise((resolve) => {
          navigator.geolocation.getCurrentPosition(
            (pos) => { gps = { lat: pos.coords.latitude, lon: pos.coords.longitude }; resolve(); },
            () => resolve(),
            { enableHighAccuracy: true, timeout: 4000 }
          );
        });
      }

      // 1) Enviar check-in
      await rondasqrApi.postScan({ qr: text, gps });

      // 2) Actualizar progreso buscando el punto por su qrCode
      let displayName = text;
      let pct = Number(localStorage.getItem("rondasqr:progressPct") || 0);
      if (points.length) {
        const idx = points.findIndex(p => p.qrCode && String(p.qrCode).trim() === String(text).trim());
        if (idx >= 0) {
          displayName = points[idx].name || `Punto ${idx + 1}`;
          const next = idx + 1 < points.length ? (points[idx + 1].name || `Punto ${idx + 2}`) : "";
          localStorage.setItem("rondasqr:lastPointName", displayName);
          localStorage.setItem("rondasqr:nextPointName", next);
          pct = Math.round(((idx + 1) / points.length) * 100);
          localStorage.setItem("rondasqr:progressPct", String(Math.max(0, Math.min(100, pct))));
        } else {
          // si el QR no pertenece al plan, al menos marcamos último leído
          localStorage.setItem("rondasqr:lastPointName", displayName);
          localStorage.setItem("rondasqr:progressPct", String(pct));
        }
      } else {
        // sin plan cargado: solo guardamos el último
        localStorage.setItem("rondasqr:lastPointName", displayName);
      }

      loadLocalProgress();
      alert(`✅ Punto registrado: ${displayName}`);
      nav("/rondasqr/scan");
    } catch (e) {
      console.error("[handleScan] error", e);
      alert("No se pudo registrar el punto. Reintenta.");
    }
  };

  return (
    <div className={pageClass}>
      <style>{neonStyles}</style>

      {/* Desktop sidebar */}
      <div className="hidden md:block">
        <SidebarGuard variant="desktop" />
      </div>

      {/* Backdrop + drawer móvil */}
      {isNavOpen && (
        <>
          <div
            onClick={() => setIsNavOpen(false)}
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm md:hidden"
          />
          <SidebarGuard variant="mobile" onCloseMobile={() => setIsNavOpen(false)} />
        </>
      )}

      <main className="flex-1 flex flex-col overflow-y-auto p-4 sm:p-6 relative">
        {/* Botón hamburguesa en móvil */}
        <div className="md:hidden mb-3">
          <button
            onClick={() => setIsNavOpen(true)}
            className="inline-flex items-center gap-2 rounded-lg px-3 py-2
                       border border-slate-300 bg-white text-slate-800
                       dark:border-white/15 dark:bg-white/10 dark:text-white"
            aria-label="Abrir menú"
          >
            ☰ Menú
          </button>
        </div>

        {/* Encabezado */}
        <div className={headerClass}>
          <h2 className="text-xl sm:text-2xl font-bold">Visión General</h2>
          <div className="text-xs sm:text-sm">
            Intervalo de tiempo: <span className="font-semibold">4h:00m</span>
          </div>
        </div>

        {/* ===== HOME ===== */}
        {tab === "home" && (
          <div className={`grid grid-cols-1 ${homeCols} gap-4 sm:gap-6`}>
            {/* ALERTA + accesos */}
            <section className={cardClass + " text-center"}>
              <div className="flex flex-col items-center">
                <button
                  onClick={sendAlert}
                  disabled={sendingAlert}
                  aria-label="Botón de alerta de pánico"
                  className={[
                    "rounded-full font-extrabold text-white",
                    "bg-rose-600 hover:bg-rose-500 border-4 border-rose-400",
                    "w-28 h-28 text-lg sm:w-32 sm:h-32 sm:text-xl md:w-36 md:h-36 md:text-2xl",
                    sendingAlert ? "cursor-not-allowed opacity-80" : ""
                  ].join(" ")}
                >
                  {sendingAlert ? "ENVIANDO..." : "ALERTA"}
                </button>
                <p className="text-sm mt-2 text-slate-600 dark:text-white/80">
                  Oprima en caso de emergencia
                </p>
              </div>

              <div className="mt-6 grid gap-3 max-w-md mx-auto w-full">
                <button onClick={() => nav("/rondasqr/scan/qr")} className="w-full btn-neon">
                  Registrador Punto Control
                </button>
                <button onClick={() => nav("/rondasqr/scan/msg")} className="w-full btn-neon btn-neon-purple">
                  Mensaje Incidente
                </button>
                <button onClick={() => nav("/rondasqr/scan/fotos")} className="w-full btn-neon btn-neon-green">
                  Fotos de remitentes
                </button>
              </div>
            </section>

            {/* PROGRESO DE RONDA */}
            <section className={cardClass}>
              <h3 className="font-semibold text-lg mb-3">Progreso de Ronda</h3>

              {(progress.lastPoint || progress.nextPoint || progress.pct > 0) ? (
                <>
                  <div className="text-sm space-y-1 mb-3">
                    {progress.lastPoint && (
                      <div>
                        <span className="opacity-70">Último punto: </span>
                        <span className="font-medium">{progress.lastPoint}</span>
                      </div>
                    )}
                    {progress.nextPoint && (
                      <div>
                        <span className="opacity-70">Siguiente: </span>
                        <span className="font-medium">{progress.nextPoint}</span>
                      </div>
                    )}
                  </div>

                  <div className="w-full h-3 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-indigo-500 to-cyan-400"
                      style={{ width: `${Math.max(0, Math.min(100, progress.pct))}%` }}
                    />
                  </div>
                  <div className="mt-1 text-right text-xs opacity-70">
                    {Math.max(0, Math.min(100, progress.pct))}% completado
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <button
                      onClick={() => nav("/rondasqr/scan/qr")}
                      className="w-full btn-neon btn-neon-green"
                    >
                      Abrir escáner
                    </button>
                    <button
                      onClick={() => nav("/rondasqr/scan")}
                      className="w-full btn-neon btn-neon-amber"
                    >
                      Finalizar
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <p className="text-sm text-slate-600 dark:text-white/80">
                    Para iniciar una ronda, abre el <strong>Registrador Punto Control</strong> y
                    escanea el primer punto asignado.
                  </p>
                  <ul className="mt-3 text-sm space-y-1 list-disc list-inside text-slate-600 dark:text-white/70">
                    <li>Asegúrate de dar permisos de cámara al navegador.</li>
                    <li>Si no ves los puntos, confirma que el plan de ronda esté cargado.</li>
                    <li>Puedes reportar un incidente desde “Mensaje Incidente”.</li>
                  </ul>
                  <div className="mt-4">
                    <button onClick={() => nav("/rondasqr/scan/qr")} className="btn-neon w-full">
                      Abrir escáner
                    </button>
                  </div>
                </>
              )}
            </section>

            {/* ACCIONES */}
            {(isAdminLike || isSupervisorLike) && (
              <section className={cardClass}>
                <h3 className="font-semibold text-lg mb-3">Acciones</h3>
                <p className="text-sm text-slate-600 dark:text-white/80 mb-4">
                  Acciones avanzadas disponibles para supervisores o administradores.
                </p>
                <div className="grid gap-3 max-w-sm">
                  <button onClick={() => nav("/rondasqr/reports")} className="w-full btn-neon">
                    📊 Abrir informes
                  </button>
                  {isAdminLike && (
                    <button
                      onClick={() => nav("/rondasqr/admin")}
                      className="w-full btn-neon btn-neon-purple"
                    >
                      ⚙️ Administración de rondas
                    </button>
                  )}
                </div>
              </section>
            )}
          </div>
        )}

        {/* ===== ESCÁNER QR ===== */}
        {tab === "qr" && (
          <section className={cardClass}>
            <h3 className="font-semibold text-lg mb-3">Escanear Punto</h3>

            <div className="aspect-[3/2] rounded-xl overflow-hidden relative">
              <QrScanner
                facingMode="environment"
                once={true}
                enableTorch
                enableFlip
                onResult={handleScan}
                onError={(e) => console.warn("QR error", e)}
              />
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <button onClick={() => nav("/rondasqr/scan")} className="w-full btn-neon btn-neon-amber">
                Finalizar
              </button>
              <button onClick={() => nav("/rondasqr/scan/qr")} className="w-full btn-neon btn-neon-green">
                Reintentar
              </button>
            </div>
          </section>
        )}

        {/* ===== MENSAJE ===== */}
        {tab === "msg" && (
          <section className={cardClass}>
            <h3 className="text-lg font-semibold mb-3">Mensaje / Incidente</h3>
            <textarea
              className="w-full rounded-lg px-3 py-2 border bg-white text-slate-800 placeholder-slate-400
                         border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-300
                         dark:bg-black/30 dark:text-white dark:placeholder-white/60 dark:border-white/10"
              rows={5}
              placeholder="Describa el incidente..."
              value={msg}
              onChange={(e) => setMsg(e.target.value)}
            />
            <div className="mt-4 flex justify-end gap-3">
              <button onClick={() => nav("/rondasqr/scan")} className={neutralBtn}>Cancelar</button>
              <button onClick={sendMessage} disabled={sendingMsg} className="btn-neon">
                {sendingMsg ? "Enviando…" : "Enviar"}
              </button>
            </div>
          </section>
        )}

        {/* ===== FOTOS ===== */}
        {tab === "fotos" && (
          <section className={cardClass}>
            <h3 className="font-semibold text-lg mb-3">Enviar Fotos</h3>
            <PhotoPicker photos={photos} setPhotos={setPhotos} />
            <div className="mt-4 flex justify-end gap-3">
              <button onClick={() => nav("/rondasqr/scan")} className={neutralBtn}>Cancelar</button>
              <button onClick={sendPhotos} disabled={sendingPhotos} className="btn-neon">
                {sendingPhotos ? "Enviando…" : "Enviar"}
              </button>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

/* ================= Subcomponentes ================= */

function PhotoPicker({ photos, setPhotos }) {
  return (
    <>
      {photos.map((f, i) => (
        <div key={i} className="flex items-center justify-between mb-2">
          <span className="text-sm text-slate-700 dark:text-white/90">Toma foto {i + 1}</span>
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
              className="px-3 py-1 rounded-md text-white bg-indigo-600 hover:bg-indigo-500 cursor-pointer"
            >
              Seleccionar
            </label>
            <button
              onClick={() => setPhotos((p) => p.map((f2, idx) => (idx === i ? null : f2)))}
              className="px-3 py-1 rounded-md text-white bg-rose-600 hover:bg-rose-500"
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
