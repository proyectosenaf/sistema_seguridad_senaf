// src/modules/rondasqr/hooks/useRondasData.js
import React from "react";
import { rondasqrApi } from "../api/rondasqrApi.js";
import {
  getOutbox,
  queueCheckin,
  transmitOutbox,
  removeById,
  countOutbox,
} from "../utils/outbox.js";

export function useRondasData() {
  // roles/permisos (mínimo)
  const [isAdminLike, setIsAdminLike] = React.useState(false);
  const [isSupervisorLike, setIsSupervisorLike] = React.useState(false);

  // progreso
  const [progress, setProgress] = React.useState({ lastPoint: null, nextPoint: null, pct: 0 });

  // outbox
  const [outbox, setOutbox] = React.useState(getOutbox());
  const [syncing, setSyncing] = React.useState(false);

  // estilos compartidos
  const neonStyles = `
    .btn-neon { padding:.5rem 1rem;border-radius:.5rem;font-weight:600;color:#fff;
      background-image:linear-gradient(90deg,#8b5cf6,#06b6d4);
      box-shadow:0 10px 28px rgba(99,102,241,.28),0 6px 20px rgba(6,182,212,.22);
      transition:filter .2s ease, transform .2s ease; }
    .btn-neon:hover { filter:brightness(1.06); transform:translateY(-1px); }
    .btn-neon-green  { background-image:linear-gradient(90deg,#22c55e,#06b6d4); }
    .btn-neon-amber  { background-image:linear-gradient(90deg,#f59e0b,#ef4444); }
  `;

  // cargar progreso desde localStorage
  React.useEffect(() => {
    const lastPoint = localStorage.getItem("rondasqr:lastPointName") || null;
    const nextPoint = localStorage.getItem("rondasqr:nextPointName") || null;
    const pct = Math.max(
      0,
      Math.min(100, Number(localStorage.getItem("rondasqr:progressPct") || 0))
    );
    setProgress({ lastPoint, nextPoint, pct });
  }, []);

  const refreshOutbox = () => setOutbox(getOutbox());

  // ==== manejar escaneo ====
  const handleScan = React.useCallback(
    async (result) => {
      const qr = typeof result === "string" ? result : result?.text;
      if (!qr) return;

      // offline → guardar
      if (!navigator.onLine) {
        queueCheckin({ qr, gps: null });
        refreshOutbox();
        alert("📦 Sin conexión. Guardado en pendientes.");
        return;
      }

      try {
        let gps = null;
        if ("geolocation" in navigator) {
          await new Promise((resolve) => {
            navigator.geolocation.getCurrentPosition(
              (pos) => {
                gps = { lat: pos.coords.latitude, lon: pos.coords.longitude };
                resolve();
              },
              () => resolve(),
              { enableHighAccuracy: true, timeout: 3000 }
            );
          });
        }

        if (typeof rondasqrApi.checkinScan === "function") {
          await rondasqrApi.checkinScan({ qr, gps });
        } else if (typeof rondasqrApi.scan === "function") {
          await rondasqrApi.scan({ qr, gps });
        } else {
          await fetch(
            (import.meta.env.VITE_API_BASE_URL || "http://localhost:4000") +
              "/api/rondasqr/v1/checkin/scan",
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              credentials: "include",
              body: JSON.stringify({ qr, gps }),
            }
          ).then((r) => {
            if (!r.ok) throw new Error("HTTP " + r.status);
          });
        }

        localStorage.setItem("rondasqr:lastPointName", qr);
        localStorage.setItem("rondasqr:progressPct", "100");
        setProgress((p) => ({ ...p, lastPoint: qr, pct: 100 }));

        alert("✅ Punto registrado: " + qr);
        window.dispatchEvent(new CustomEvent("qrscanner:stop"));
      } catch (err) {
        console.error("scan failed, enqueue", err);
        queueCheckin({ qr, gps: null });
        refreshOutbox();
        alert("📦 No se pudo enviar. Guardado en pendientes.");
      }
    },
    []
  );

  // ==== transmitir todo ====
  async function transmitAll() {
    if (!outbox.length) {
      alert("No hay pendientes.");
      return;
    }
    setSyncing(true);
    try {
      const res = await transmitOutbox(async (it) => {
        if (typeof rondasqrApi.checkinScan === "function") {
          await rondasqrApi.checkinScan({ qr: it.qr, gps: it.gps || null });
        } else {
          await fetch(
            (import.meta.env.VITE_API_BASE_URL || "http://localhost:4000") +
              "/api/rondasqr/v1/checkin/scan",
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              credentials: "include",
              body: JSON.stringify({ qr: it.qr, gps: it.gps || null }),
            }
          ).then((r) => {
            if (!r.ok) throw new Error("HTTP " + r.status);
          });
        }
      });
      refreshOutbox();
      alert(`Transmitidas: ${res.ok} • Fallidas: ${res.fail}`);
    } catch (e) {
      console.error(e);
      alert("Error al transmitir.");
    } finally {
      setSyncing(false);
    }
  }

  async function sendOnePending(id) {
    const it = getOutbox().find((x) => x.id === id);
    if (!it) return;
    try {
      if (typeof rondasqrApi.checkinScan === "function") {
        await rondasqrApi.checkinScan({ qr: it.qr, gps: it.gps || null });
      }
      removeById(id);
      refreshOutbox();
    } catch {
      alert("No se pudo enviar ese item.");
    }
  }

  return {
    isAdminLike,
    isSupervisorLike,
    progress,
    outbox,
    outboxCount: countOutbox(),
    syncing,
    neonStyles,
    handleScan,
    transmitAll,
    sendOnePending,
  };
}
