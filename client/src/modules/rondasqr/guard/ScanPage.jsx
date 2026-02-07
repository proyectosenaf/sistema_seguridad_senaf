// client/src/modules/rondasqr/pages/ScanPage.jsx
import React, { useState, useMemo, useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import QrScanner from "./QrScanner.jsx";
import { rondasqrApi } from "../api/rondasqrApi.js";
import { useAuth0 } from "@auth0/auth0-react";
import { useAssignmentSocket } from "../hooks/useAssignmentSocket.js";
import { emitLocalPanic, subscribeLocalPanic } from "../utils/panicBus.js";

import {
  getOutbox,
  queueCheckin,
  transmitOutbox,
  removeById,
  countOutbox,
} from "../utils/outbox.js";

/* ===== helpers pequeños ===== */
function toArr(v) {
  return !v ? [] : Array.isArray(v) ? v : [v];
}
function uniqLower(arr) {
  return Array.from(
    new Set(
      toArr(arr)
        .map((x) => String(x).trim().toLowerCase())
        .filter(Boolean)
    )
  );
}
function readJsonLS(key, fallback) {
  try {
    if (typeof localStorage === "undefined") return fallback;
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return parsed == null ? fallback : parsed;
  } catch {
    return fallback;
  }
}
function buildAssignmentKey(a) {
  return (
    a.id ||
    a._id ||
    [
      a.date || a.day || a.assignmentDate || "",
      a.roundId || a.roundName || "",
      a.guardId || a.guard?.id || "",
    ].join("|")
  );
}

export default function ScanPage() {
  const nav = useNavigate();
  const { pathname, hash } = useLocation();

  const { user, isAuthenticated, getAccessTokenSilently } = useAuth0();
  const safeUser = user || {};

  // ✅ estado IAM (roles/perms reales desde backend)
  const [iamMe, setIamMe] = useState({ roles: [], perms: [] });

  /* ===== cargar roles/permisos reales desde IAM ===== */
  useEffect(() => {
    let alive = true;

    async function loadIamMe() {
      try {
        if (!isAuthenticated) return;

        const RAW = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000/api";
        const ROOT = RAW.replace(/\/api\/?$/, "").replace(/\/$/, "");
        const V1 = `${ROOT}/api/iam/v1`;
        const LEGACY = `${ROOT}/api/iam`;

        const candidates = [`${V1}/me`, `${V1}/auth/me`, `${LEGACY}/me`, `${LEGACY}/auth/me`];

        const audience = import.meta.env.VITE_AUTH0_AUDIENCE;

        let headers = {};
        if (audience) {
          try {
            const token = await getAccessTokenSilently({
              authorizationParams: { audience },
            });
            if (token) headers.Authorization = `Bearer ${token}`;
          } catch (err) {
            const msg = (err && (err.error || err.message)) || String(err);
            console.debug("[ScanPage] getAccessTokenSilently:", msg);
          }
        }

        // DEV fallback
        if (import.meta.env.DEV) {
          const devEmail =
            safeUser?.email ||
            (typeof localStorage !== "undefined" && localStorage.getItem("iamDevEmail")) ||
            import.meta.env.VITE_DEV_IAM_EMAIL ||
            "";

          if (devEmail) headers["x-user-email"] = devEmail;

          const devRoles =
            (typeof localStorage !== "undefined" && localStorage.getItem("iamDevRoles")) || "";
          if (devRoles) headers["x-roles"] = devRoles;
        }

        for (const url of candidates) {
          try {
            const res = await fetch(url, { credentials: "include", headers });
            if (!res.ok) continue;

            const data = (await res.json().catch(() => ({}))) || {};
            const roles = data?.roles || data?.user?.roles || [];
            const perms = data?.permissions || data?.perms || [];

            if (!alive) return;
            setIamMe({ roles, perms });
            return;
          } catch {
            // prueba siguiente candidate
          }
        }
      } catch {
        /* ignore */
      }
    }

    loadIamMe();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, getAccessTokenSilently, safeUser?.email]);

  /* ===== notificaciones ===== */
  useEffect(() => {
    try {
      if (typeof window !== "undefined" && "Notification" in window) {
        if (Notification.permission === "default") {
          Notification.requestPermission().catch(() => {});
        }
      }
    } catch {}
  }, []);

  /* ===== audio de alerta ===== */
  const alertAudioRef = useRef(null);
  const audioCtxRef = useRef(null);
  const [lastPanic, setLastPanic] = useState(null);

  function playAlarmTone() {
    try {
      if (!audioCtxRef.current) {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        if (!Ctx) return;
        audioCtxRef.current = new Ctx();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === "suspended") {
        ctx.resume().catch(() => {});
      }

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sawtooth";
      osc.connect(gain);
      gain.connect(ctx.destination);

      const now = ctx.currentTime;
      osc.frequency.setValueAtTime(500, now);
      osc.frequency.linearRampToValueAtTime(900, now + 0.4);
      osc.frequency.linearRampToValueAtTime(500, now + 0.8);
      osc.frequency.linearRampToValueAtTime(900, now + 1.2);
      osc.frequency.linearRampToValueAtTime(500, now + 1.6);

      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(0.4, now + 0.05);
      gain.gain.linearRampToValueAtTime(0.4, now + 1.6);
      gain.gain.linearRampToValueAtTime(0.0001, now + 1.9);

      osc.start(now);
      osc.stop(now + 2.0);
    } catch {
      if (alertAudioRef.current) {
        alertAudioRef.current.currentTime = 0;
        alertAudioRef.current.play().catch(() => {});
      }
    }
  }

  function handleIncomingPanic(payload) {
    setLastPanic({ at: new Date().toLocaleTimeString(), ...payload });
    playAlarmTone();
  }

  /* ===== socket: alertas entrantes ===== */
  useAssignmentSocket(safeUser, (evt) => {
    const t = evt?.type || evt?.event || evt?.kind;
    if (t === "panic" || t === "rondasqr:panic") {
      handleIncomingPanic(evt.payload || {});
    }
  });

  /* ===== bus local: alertas desde otra pestaña ===== */
  useEffect(() => {
    const unsub = subscribeLocalPanic((payload) => handleIncomingPanic(payload));
    return () => {
      if (unsub) unsub();
    };
  }, []);

  /* ===== roles/permisos ===== */
  const ROLES_CLAIM = "https://senaf.local/roles";
  const PERMS_CLAIM = "https://senaf.local/permissions";

  const rolesAuth0 = uniqLower(safeUser?.roles);
  const rolesClaim = uniqLower(safeUser?.[ROLES_CLAIM]);
  const permsClaim = uniqLower(safeUser?.[PERMS_CLAIM]);

  const devRoles = import.meta.env.DEV
    ? uniqLower((localStorage.getItem("iamDevRoles") || "").split(","))
    : [];
  const devPerms = import.meta.env.DEV
    ? uniqLower((localStorage.getItem("iamDevPerms") || "").split(","))
    : [];

  const iamRoles = uniqLower(iamMe?.roles);
  const iamPerms = uniqLower(iamMe?.perms);

  const roles = uniqLower([...rolesAuth0, ...rolesClaim, ...iamRoles, ...devRoles]);
  const perms = uniqLower([...permsClaim, ...iamPerms, ...devPerms]);

  const isAdminLike =
    perms.includes("*") || roles.includes("admin") || roles.includes("rondasqr.admin");

  const isSupervisorLike =
    roles.includes("supervisor") ||
    perms.includes("rondasqr.view") ||
    perms.includes("rondasqr.reports");

  /* ===== qué pestaña ===== */
  const tab = useMemo(() => {
    if (pathname.endsWith("/qr")) return "qr";
    if (pathname.endsWith("/msg")) return "msg";
    if (pathname.endsWith("/fotos")) return "fotos";
    if (pathname.endsWith("/outbox") || pathname.endsWith("/sync")) return "outbox";
    if (pathname.endsWith("/dump") || pathname.endsWith("/offline")) return "dump";
    return "home";
  }, [pathname]);

  // redirección de pestaña msg al módulo global de incidentes
  useEffect(() => {
    if (tab === "msg") {
      nav("/incidentes/nuevo?from=ronda", { replace: true });
    }
  }, [tab, nav]);

  /* ===== estados de formularios ===== */
  const [msg, setMsg] = useState("");
  const [photos, setPhotos] = useState([null, null, null, null, null]);
  const [sendingAlert, setSendingAlert] = useState(false);
  const [sendingMsg, setSendingMsg] = useState(false);
  const [sendingPhotos, setSendingPhotos] = useState(false);

  /* ===== puntos de ronda ===== */
  const [points, setPoints] = useState([]);
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const plans = await rondasqrApi.listPlans();
        const plan = plans?.items?.[0] || null;
        if (!alive || !plan) return;

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
    return () => {
      alive = false;
    };
  }, []);

  /* ===== progreso local ===== */
  const [progress, setProgress] = useState({
    lastPoint: null,
    nextPoint: null,
    pct: 0,
  });

  function loadLocalProgress() {
    const lastPoint = localStorage.getItem("rondasqr:lastPointName") || null;
    const nextPoint = localStorage.getItem("rondasqr:nextPointName") || null;
    const pct = Math.max(
      0,
      Math.min(100, Number(localStorage.getItem("rondasqr:progressPct") || 0))
    );
    setProgress({ lastPoint, nextPoint, pct });
  }

  useEffect(() => {
    loadLocalProgress();
  }, []);

  /* ===== RONDAS ASIGNADAS AL GUARDIA ===== */
  const [myAssignments, setMyAssignments] = useState([]);
  const [assignmentStates, setAssignmentStates] = useState({});
  const [currentAssignmentKey, setCurrentAssignmentKey] = useState(null);

  function loadAssignmentStates() {
    try {
      const raw = localStorage.getItem("rondasqr:assignmentStates");
      const keyRaw = localStorage.getItem("rondasqr:currentAssignmentKey");
      if (raw) {
        const parsed = JSON.parse(raw);
        setAssignmentStates(parsed && typeof parsed === "object" ? parsed : {});
      } else {
        setAssignmentStates({});
      }
      if (keyRaw) setCurrentAssignmentKey(keyRaw);
    } catch {
      setAssignmentStates({});
      setCurrentAssignmentKey(null);
    }
  }

  function saveAssignmentStates(next) {
    setAssignmentStates(next);
    try {
      localStorage.setItem("rondasqr:assignmentStates", JSON.stringify(next));
    } catch {
      /* ignore */
    }
  }

  function setActiveAssignment(a) {
    const key = buildAssignmentKey(a);
    if (!key) return;
    setCurrentAssignmentKey(key);
    try {
      localStorage.setItem("rondasqr:currentAssignmentKey", key);
      localStorage.setItem("rondasqr:currentAssignment", JSON.stringify(a));
    } catch {
      /* ignore */
    }
  }

  function clearActiveAssignment() {
    setCurrentAssignmentKey(null);
    try {
      localStorage.removeItem("rondasqr:currentAssignmentKey");
      localStorage.removeItem("rondasqr:currentAssignment");
    } catch {
      /* ignore */
    }
  }

  function updateAssignmentStatus(a, status, extra = {}) {
    const key = buildAssignmentKey(a);
    if (!key) return;
    const nowIso = new Date().toISOString();
    const next = {
      ...assignmentStates,
      [key]: {
        ...(assignmentStates[key] || {}),
        status,
        updatedAt: nowIso,
        ...extra,
      },
    };
    saveAssignmentStates(next);
  }

  function getAssignmentState(a) {
    const key = buildAssignmentKey(a);
    return key ? assignmentStates[key] || {} : {};
  }

  function handleStartRound(a) {
    setActiveAssignment(a);
    updateAssignmentStatus(a, "en_progreso", { startedAt: new Date().toISOString() });
    nav("/rondasqr/scan/qr");
  }

  function handleFinishRound(a) {
    updateAssignmentStatus(a, "terminada", {
      finishedAt: new Date().toISOString(),
      progressPct: progress.pct,
    });
    clearActiveAssignment();
  }

  function handleCancelRound(a) {
    updateAssignmentStatus(a, "cancelada");
    clearActiveAssignment();
  }

  function loadAssignmentsForGuard() {
    const all = readJsonLS("rondasqr:assignments", []);
    if (!Array.isArray(all)) {
      setMyAssignments([]);
      return;
    }

    const email = (safeUser?.email || "").toLowerCase();
    const sub = (safeUser?.sub || "").toLowerCase();
    const name = (safeUser?.name || "").toLowerCase();

    const mine = all.filter((a) => {
      const gEmail = (a.guardEmail || a.guard?.email || "").toLowerCase();
      const gId = (a.guardId || a.guard?.id || "").toLowerCase();
      const gName = (a.guardName || a.guard?.name || "").toLowerCase();

      const guardVals = [gEmail, gId, gName].filter(Boolean);
      const userVals = [email, sub, name].filter(Boolean);

      if (!guardVals.length || !userVals.length) return false;
      return guardVals.some((gv) => userVals.includes(gv));
    });

    setMyAssignments(mine);
  }

  useEffect(() => {
    const hasIdentity = !!(safeUser?.email || safeUser?.sub || safeUser?.name);
    if (!hasIdentity) return;

    loadAssignmentsForGuard();
    loadAssignmentStates();

    function handleStorage(e) {
      if (!e) return;
      if (e.key === "rondasqr:assignments") loadAssignmentsForGuard();
      if (e.key === "rondasqr:assignmentStates" || e.key === "rondasqr:currentAssignmentKey") {
        loadAssignmentStates();
      }
    }

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, [safeUser?.email, safeUser?.sub, safeUser?.name]);

  /* ===== alerta rápida por hash #alert ===== */
  useEffect(() => {
    if (hash === "#alert") {
      (async () => {
        await sendAlert();
        nav("/rondasqr/scan", { replace: true });
      })();
    }
  }, [hash, nav]);

  /* ===== enviar alerta de pánico ===== */
  async function sendAlert() {
    if (sendingAlert) return false;
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
      await rondasqrApi.panic(gps || null);
      emitLocalPanic({ source: "home-button", user: safeUser?.name || safeUser?.email });
      playAlarmTone();
      alert("🚨 Alerta de pánico enviada.");
      return true;
    } catch (err) {
      console.error("[ScanPage] error al enviar alerta", err);
      alert("No se pudo enviar la alerta.");
      return false;
    } finally {
      setSendingAlert(false);
    }
  }

  /* ===== manejar QR ESCANEADO ===== */
  async function handleScan(result) {
    const qr = typeof result === "string" ? result : result?.text;
    if (!qr) return;

    if (!navigator.onLine) {
      queueCheckin({ qr, gps: null });
      alert("📦 Sin conexión. QR guardado para transmitir más tarde.");
      nav("/rondasqr/scan", { replace: true });
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
      setProgress((prev) => ({ ...prev, lastPoint: qr, pct: 100 }));

      alert("✅ Punto registrado: " + qr);
      window.dispatchEvent(new CustomEvent("qrscanner:stop"));
      nav("/rondasqr/scan", { replace: true });
    } catch (err) {
      console.error("[ScanPage] error al registrar punto (se guarda en pendientes)", err);
      queueCheckin({ qr, gps: null });
      alert("📦 No se pudo enviar. Guardado para transmitir más tarde.");
      nav("/rondasqr/scan/outbox", { replace: true });
    }
  }

  /* ===== mensaje legacy ===== */
  async function sendMessage() {
    if (sendingMsg) return;
    if (!msg.trim()) {
      alert("Escribe un mensaje.");
      return;
    }
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

  /* ===== fotos ===== */
  async function sendPhotos() {
    if (sendingPhotos) return;
    const base64s = photos.filter(Boolean);
    if (!base64s.length) {
      alert("Selecciona al menos una foto.");
      return;
    }
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

  /* ===== OUTBOX ===== */
  const [outbox, setOutbox] = useState(getOutbox());
  const [syncing, setSyncing] = useState(false);
  const refreshOutbox = () => setOutbox(getOutbox());

  async function sendCheckinViaApi(it) {
    if (typeof rondasqrApi.checkinScan === "function") {
      await rondasqrApi.checkinScan({ qr: it.qr, gps: it.gps || null });
    } else if (typeof rondasqrApi.scan === "function") {
      await rondasqrApi.scan({ qr: it.qr, gps: it.gps || null });
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
  }

  async function transmitNow() {
    if (!outbox.length) {
      alert("No hay rondas pendientes.");
      return;
    }
    setSyncing(true);
    try {
      const res = await transmitOutbox(sendCheckinViaApi);
      refreshOutbox();
      alert(`Transmitidas: ${res.ok}  •  Fallidas: ${res.fail}`);
    } catch (e) {
      console.error("transmitNow error", e);
      alert("Ocurrió un error al transmitir.");
    } finally {
      setSyncing(false);
    }
  }

  useEffect(() => {
    if (tab === "outbox") refreshOutbox();
  }, [tab]);

  /* ===== payload offline ===== */
  function buildOfflinePayload(authUser) {
    const outboxData = getOutbox();
    const progressData = {
      lastPoint: localStorage.getItem("rondasqr:lastPointName") || null,
      nextPoint: localStorage.getItem("rondasqr:nextPointName") || null,
      pct: Number(localStorage.getItem("rondasqr:progressPct") || 0),
    };
    const device = {
      ua: typeof navigator !== "undefined" ? navigator.userAgent : "",
      online: typeof navigator !== "undefined" ? navigator.onLine : false,
      connection:
        typeof navigator !== "undefined" && navigator.connection
          ? {
              type: navigator.connection.effectiveType,
              downlink: navigator.connection.downlink,
            }
          : null,
    };
    const userInfo = authUser
      ? {
          id: authUser.sub || null,
          email: authUser.email || null,
          name: authUser.name || null,
        }
      : null;
    const assignments = readJsonLS("rondasqr:assignments", []);
    const logs = readJsonLS("rondasqr:logs", []);

    return {
      outbox: outboxData,
      progress: progressData,
      device,
      user: userInfo,
      assignments: Array.isArray(assignments) ? assignments : [],
      logs: Array.isArray(logs) ? logs : [],
      at: new Date().toISOString(),
    };
  }

  async function sendOfflineDump() {
    try {
      const payload = buildOfflinePayload(safeUser);
      const pending = payload.outbox;
      if (!pending || !pending.length) {
        alert("No hay información offline para enviar.");
        return;
      }

      const apiBase = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";
      const res = await fetch(`${apiBase}/api/rondasqr/v1/offline/dump`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(txt || `HTTP ${res.status}`);
      }

      const json = await res.json().catch(() => ({ ok: true }));
      alert("📤 Base de datos local enviada.\n" + (json?.message || ""));
    } catch (err) {
      console.error("[ScanPage] dump offline error", err);
      alert("No se pudo enviar la base de datos.");
    }
  }

  /* ===== AUTO-SYNC ===== */
  useEffect(() => {
    async function autoSync() {
      try {
        if (typeof navigator !== "undefined" && !navigator.onLine) return;

        const pendingOutbox = getOutbox();
        const hasOutbox = Array.isArray(pendingOutbox) && pendingOutbox.length > 0;

        if (hasOutbox) {
          try {
            await transmitOutbox(sendCheckinViaApi);
            refreshOutbox();
          } catch (e) {
            console.error("[autoSync] error transmitiendo outbox", e);
          }
        }

        const payload = buildOfflinePayload(safeUser);
        const hasDumpOutbox = Array.isArray(payload.outbox) && payload.outbox.length > 0;
        const hasAssignments =
          Array.isArray(payload.assignments) && payload.assignments.length > 0;
        const hasLogs = Array.isArray(payload.logs) && payload.logs.length > 0;

        if (!(hasDumpOutbox || hasAssignments || hasLogs)) return;

        const apiBase = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";
        try {
          const res = await fetch(`${apiBase}/api/rondasqr/v1/offline/dump`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify(payload),
          });
          if (!res.ok) {
            const txt = await res.text().catch(() => "");
            throw new Error(txt || `HTTP ${res.status}`);
          }
        } catch (e) {
          console.error("[autoSync] error enviando dump offline", e);
        }
      } catch (err) {
        console.error("[autoSync] error inesperado", err);
      }
    }

    autoSync();

    function handleOnline() {
      autoSync();
    }

    if (typeof window !== "undefined") {
      window.addEventListener("online", handleOnline);
      return () => window.removeEventListener("online", handleOnline);
    }
  }, [safeUser]);

  /* ==========================================================
     ESTILOS: ahora alineados a Layout/Home (sin doble container)
     - Quitamos min-h-screen y max-w propio
     - Usamos layer-content y fx-card si existen
     - Si no existen, seguimos con glass consistente
     ========================================================== */

  const pageClass = "space-y-6 layer-content"; // ✅ igual a Home
  const headerClass =
    "fx-card rounded-2xl px-4 sm:px-6 py-3 flex items-center justify-between gap-4";
  const cardClass = "fx-card rounded-2xl p-4 sm:p-6";
  // fallback glass (si fx-card no existe, esto igual funciona porque tailwind ignora clases desconocidas)
  const headerFallback =
    "bg-white/70 border border-neutral-300/70 shadow-sm dark:bg-white/5 dark:border-white/15 dark:shadow-none dark:backdrop-blur";
  const cardFallback =
    "bg-white/70 border border-neutral-300/70 shadow-sm dark:bg-white/5 dark:border-white/15 dark:shadow-none dark:backdrop-blur";

  const neutralBtn =
    "px-4 py-2 rounded-lg border font-medium " +
    "border-neutral-300/70 bg-white/70 hover:bg-white/80 text-neutral-900 " +
    "dark:border-white/15 dark:bg-white/5 dark:hover:bg-white/10 dark:text-white";

  const neonStyles = `
    .btn-neon {
      padding:.5rem 1rem;
      border-radius:.75rem;
      font-weight:700;
      color:#fff;
      background-image:linear-gradient(90deg,#8b5cf6,#06b6d4);
      box-shadow:0 10px 28px rgba(99,102,241,.18),0 6px 20px rgba(6,182,212,.12);
      transition:filter .2s ease, transform .2s ease;
    }
    .btn-neon:hover { filter:brightness(1.04); transform:translateY(-1px); }
    .btn-neon:active { transform:translateY(0); }
    .btn-neon-green  { background-image:linear-gradient(90deg,#22c55e,#06b6d4); }
    .btn-neon-rose   { background-image:linear-gradient(90deg,#f43f5e,#fb7185); }
    .btn-neon-amber  { background-image:linear-gradient(90deg,#f59e0b,#ef4444); }
    .btn-neon-purple { background-image:linear-gradient(90deg,#a855f7,#6366f1); }
    .dark .btn-neon {
      box-shadow:0 14px 36px rgba(99,102,241,.38),0 10px 28px rgba(6,182,212,.28);
    }
    @keyframes panic-blink {
      0%, 100% { opacity: 1; box-shadow: 0 0 25px rgba(248,113,113,.8); }
      50% { opacity: .55; box-shadow: 0 0 6px rgba(248,113,113,.2); }
    }
    .panic-indicator { animation: panic-blink 1s ease-in-out infinite; }
  `;

  const homeCols = isAdminLike || isSupervisorLike ? "md:grid-cols-3" : "md:grid-cols-2";

  const BEEP_SRC =
    "data:audio/wav;base64,UklGRo+eAABXQVZFZm10IBAAAAABAAEAIlYAAESsAAACABAAZGF0YZ+eAABW/////wAAAP///1b/////AAAA////Vv////8AAAD///9W/////wAAAP///1b/////AAAA////Vv////8AAAD///9W/////wAAAP///1b/////AAAA////Vv////8AAAD///9W/////wAAAP///1b/////AAAA////Vv////8AAAD///9W/////wAAAP///w==";

  // Para botón "Finalizar ronda" del panel de progreso:
  const activeAssignment = useMemo(() => {
    if (!currentAssignmentKey) return null;
    const raw = readJsonLS("rondasqr:currentAssignment", null);
    return raw || null;
  }, [currentAssignmentKey]);

  function finishActiveIfAny() {
    if (activeAssignment) {
      handleFinishRound(activeAssignment);
    }
    nav("/rondasqr/scan", { replace: true });
  }

  return (
    <div className={pageClass}>
      <style>{neonStyles}</style>

      <audio ref={alertAudioRef} src={BEEP_SRC} preload="auto" />

      {lastPanic && (
        <button
          onClick={() => setLastPanic(null)}
          className="fixed top-20 right-6 z-[120] w-16 h-16 rounded-full bg-red-600 border-4 border-red-300 flex flex-col items-center justify-center text-white panic-indicator shadow-lg"
          title={`Alerta recibida ${lastPanic.at}`}
        >
          <span className="text-[10px] leading-none font-bold">ALERTA</span>
          <span className="text-[9px] leading-none mt-1">¡NUEVA!</span>
        </button>
      )}

      {/* ✅ Ya NO usamos <main max-w...> porque el Layout ya contiene el ancho/padding */}
      <div className={[headerClass, headerFallback].join(" ")}>
        <div>
          <h2 className="text-xl sm:text-2xl font-bold">Visión general</h2>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-white/70 mt-0.5">
            Hola {safeUser?.name || safeUser?.email || "guardia"}, aquí verás tus rondas y alertas de
            hoy.
          </p>

          <p className="text-[10px] mt-1 opacity-60">
            roles={roles.join(",") || "—"} · perms={perms.join(",") || "—"}
          </p>
        </div>
        <div className="text-right text-xs sm:text-sm">
          <div className="opacity-70">Rondas pendientes por enviar</div>
          <div className="font-semibold text-lg sm:text-xl">{countOutbox()}</div>
        </div>
      </div>

      {/* HOME */}
      {tab === "home" && (
        <div className={`grid grid-cols-1 ${homeCols} gap-4 sm:gap-6`}>
          {/* bloque alerta */}
          <section className={[cardClass, cardFallback, "text-center"].join(" ")}>
            <div className="flex flex-col items-center">
              <button
                onClick={async () => {
                  const ok = await sendAlert();
                  if (ok) nav("/rondasqr/scan", { replace: true });
                }}
                disabled={sendingAlert}
                className={[
                  "rounded-full font-extrabold text-white",
                  "bg-rose-600 hover:bg-rose-500 border-4 border-rose-400",
                  "w-28 h-28 text-lg sm:w-32 sm:h-32 sm:text-xl md:w-36 md:h-36 md:text-2xl",
                  sendingAlert ? "cursor-not-allowed opacity-80" : "",
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
              <button
                onClick={() => nav("/incidentes/nuevo?from=ronda")}
                className="w-full btn-neon btn-neon-purple"
              >
                Mensaje Incidente
              </button>
            </div>
          </section>

          {/* progreso de ronda */}
          <section className={[cardClass, cardFallback].join(" ")}>
            <h3 className="font-semibold text-lg mb-3">Progreso de Ronda</h3>

            {progress.lastPoint || progress.nextPoint || progress.pct > 0 ? (
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

                <div className="w-full h-3 rounded-full bg-black/5 dark:bg-white/10 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-indigo-500 to-cyan-400"
                    style={{ width: `${Math.max(0, Math.min(100, progress.pct))}%` }}
                  />
                </div>

                <div className="mt-1 text-right text-xs opacity-70">
                  {Math.max(0, Math.min(100, progress.pct))}% completado
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3">
                  <button onClick={() => nav("/rondasqr/scan/qr")} className="btn-neon">
                    Continuar ronda
                  </button>
                  <button onClick={finishActiveIfAny} className="btn-neon btn-neon-amber">
                    Finalizar ronda
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
                  <li>Da permisos de cámara al navegador.</li>
                  <li>Si no ves los puntos, confirma que el plan de ronda esté cargado.</li>
                  <li>Puedes reportar un incidente desde “Mensaje Incidente”.</li>
                </ul>
              </>
            )}
          </section>

          {/* acciones admin/supervisor */}
          {(isAdminLike || isSupervisorLike) && (
            <section className={[cardClass, cardFallback].join(" ")}>
              <h3 className="font-semibold text-lg mb-3">Acciones</h3>
              <p className="text-sm text-slate-600 dark:text-white/80 mb-4">
                Acciones avanzadas disponibles para supervisores o administradores.
              </p>
              <div className="grid gap-3 max-w-sm">
                <button onClick={() => nav("/rondasqr/reports")} className="btn-neon">
                  📊 Abrir informes
                </button>
                {isAdminLike && (
                  <button onClick={() => nav("/rondasqr/admin")} className="btn-neon btn-neon-purple">
                    ⚙️ Administración de rondas
                  </button>
                )}
              </div>
            </section>
          )}

          {/* rondas asignadas */}
          <section className={[cardClass, cardFallback, "md:col-span-2 xl:col-span-3"].join(" ")}>
            <div className="flex items-center justify-between gap-3 mb-3">
              <div>
                <h3 className="font-semibold text-lg">Rondas asignadas para ti</h3>
                <p className="text-xs text-slate-500 dark:text-white/70">
                  Aquí verás las rondas que tu supervisor te asignó para hoy.
                </p>
              </div>
              <button
                type="button"
                onClick={loadAssignmentsForGuard}
                className="hidden sm:inline-flex items-center px-3 py-1 rounded-lg text-xs font-semibold
                           border border-neutral-300/70 bg-white/70 hover:bg-white/80 text-neutral-700
                           dark:border-white/15 dark:bg-white/5 dark:hover:bg-white/10 dark:text-white"
              >
                Actualizar lista
              </button>
            </div>

            {myAssignments.length === 0 ? (
              <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 py-4">
                <div className="w-12 h-12 rounded-full bg-indigo-500/15 text-indigo-400 flex items-center justify-center text-2xl">
                  🕒
                </div>
                <div className="text-sm text-slate-600 dark:text-white/80">
                  <p className="font-medium mb-1">No tienes rondas asignadas por el momento.</p>
                  <p className="mb-2">
                    Cuando tu supervisor te asigne rondas, aparecerán aquí con la hora, el sitio y un botón
                    para <strong>empezar la ronda</strong>.
                  </p>
                  <button
                    type="button"
                    onClick={loadAssignmentsForGuard}
                    className="inline-flex items-center px-3 py-1 rounded-lg text-xs font-semibold btn-neon"
                  >
                    🔄 Volver a comprobar
                  </button>
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto -mx-2 sm:mx-0">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs uppercase tracking-wide text-slate-500 dark:text-white/60">
                      <th className="px-2 py-2 sm:px-3 sm:py-2">Ronda</th>
                      <th className="px-2 py-2 sm:px-3 sm:py-2">Sitio</th>
                      <th className="px-2 py-2 sm:px-3 sm:py-2">Fecha / Hora</th>
                      <th className="px-2 py-2 sm:px-3 sm:py-2">Estado</th>
                      <th className="px-2 py-2 sm:px-3 sm:py-2 text-right">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-200/70 dark:divide-white/10">
                    {myAssignments.map((a, idx) => {
                      const st = getAssignmentState(a);
                      const status = st.status || "pendiente";
                      const key = buildAssignmentKey(a);
                      const isActive = key && key === currentAssignmentKey;

                      let badgeClass =
                        "inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ";
                      if (status === "en_progreso") {
                        badgeClass += "bg-amber-500/15 text-amber-600 border border-amber-500/40";
                      } else if (status === "terminada") {
                        badgeClass += "bg-emerald-500/15 text-emerald-600 border border-emerald-500/40";
                      } else if (status === "cancelada") {
                        badgeClass += "bg-rose-500/15 text-rose-600 border border-rose-500/40";
                      } else {
                        badgeClass += "bg-slate-500/10 text-slate-600 border border-slate-500/30";
                      }

                      let mainBtnLabel = "Empezar ronda";
                      let mainBtnOnClick = () => handleStartRound(a);
                      let mainBtnDisabled = false;

                      if (status === "en_progreso") {
                        mainBtnLabel = isActive ? "Ronda en curso" : "Marcar como terminada";
                        mainBtnOnClick = () => (isActive ? nav("/rondasqr/scan/qr") : handleFinishRound(a));
                      } else if (status === "terminada") {
                        mainBtnLabel = "Terminada";
                        mainBtnDisabled = true;
                      } else if (status === "cancelada") {
                        mainBtnLabel = "Cancelada";
                        mainBtnDisabled = true;
                      }

                      const rondaLabel = a.roundName || a.roundId || a.ronda || "Ronda sin nombre";
                      const siteLabel = a.siteName || a.site || a.sitio || "—";
                      const dateLabel = a.date || a.day || a.assignmentDate || "—";
                      const timeLabel = a.startTime || a.start || a.inicio || "";

                      return (
                        <tr key={idx} className="align-middle">
                          <td className="px-2 py-2 sm:px-3 sm:py-2">
                            <div className="font-medium text-slate-900 dark:text-white">
                              {rondaLabel}
                              {isActive && status === "en_progreso" && (
                                <span className="ml-2 text-xs text-emerald-500">(ronda activa)</span>
                              )}
                            </div>
                            <div className="text-xs text-slate-500 dark:text-white/60">
                              Guardia:{" "}
                              {a.guardName ||
                                a.guard?.name ||
                                a.guardEmail ||
                                a.guard?.email ||
                                "—"}
                            </div>
                          </td>
                          <td className="px-2 py-2 sm:px-3 sm:py-2">
                            <div className="text-sm">{siteLabel}</div>
                          </td>
                          <td className="px-2 py-2 sm:px-3 sm:py-2">
                            <div className="text-xs text-slate-500 dark:text-white/70">
                              {dateLabel}
                              {timeLabel ? ` • ${timeLabel}` : ""}
                            </div>
                          </td>
                          <td className="px-2 py-2 sm:px-3 sm:py-2">
                            <span className={badgeClass}>
                              {status === "en_progreso"
                                ? "En progreso"
                                : status === "terminada"
                                ? "Terminada"
                                : status === "cancelada"
                                ? "Cancelada"
                                : "Pendiente"}
                            </span>
                          </td>
                          <td className="px-2 py-2 sm:px-3 sm:py-2">
                            <div className="flex justify-end gap-2">
                              <button
                                onClick={mainBtnOnClick}
                                disabled={mainBtnDisabled}
                                className={[
                                  "px-3 py-1 rounded-md text-xs font-semibold btn-neon",
                                  mainBtnDisabled ? "opacity-60 cursor-not-allowed" : "",
                                ].join(" ")}
                              >
                                {mainBtnLabel}
                              </button>

                              {status === "en_progreso" && (
                                <button
                                  type="button"
                                  onClick={() => handleCancelRound(a)}
                                  className="px-3 py-1 rounded-md text-xs font-semibold
                                             bg-rose-600/10 text-rose-600 border border-rose-500/40
                                             hover:bg-rose-600/20 dark:text-rose-300"
                                >
                                  Cancelar
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      )}

      {/* QR */}
      {tab === "qr" && (
        <section className={[cardClass, cardFallback].join(" ")}>
          <h3 className="font-semibold text-lg mb-3">Escanear Punto</h3>
          <div className="aspect-[3/2] rounded-xl overflow-hidden relative bg-black/5 dark:bg-black/40">
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
            <button
              onClick={() => {
                window.dispatchEvent(new CustomEvent("qrscanner:stop"));
                nav("/rondasqr/scan");
              }}
              className="btn-neon btn-neon-amber"
            >
              Finalizar
            </button>
            <button
              onClick={() => {
                window.dispatchEvent(new CustomEvent("qrscanner:stop"));
                nav("/rondasqr/scan/qr");
              }}
              className="btn-neon btn-neon-green"
            >
              Reintentar
            </button>
          </div>
        </section>
      )}

      {/* OUTBOX */}
      {tab === "outbox" && (
        <section className={[cardClass, cardFallback].join(" ")}>
          <div className="flex items-center justify-between gap-4 mb-3">
            <h3 className="font-semibold text-lg">Transmitir Rondas Pendientes</h3>
            <div className="text-sm opacity-70">Pendientes: {outbox.length}</div>
          </div>
          {outbox.length === 0 ? (
            <div className="text-slate-600 dark:text-white/80">No hay check-ins pendientes. ✨</div>
          ) : (
            <>
              <ul className="divide-y divide-neutral-200 dark:divide-white/10 mb-4">
                {outbox.map((it) => (
                  <li key={it.id} className="py-2 flex items-center justify-between gap-4">
                    <div className="text-sm">
                      <div className="font-medium">{it.qr}</div>
                      <div className="opacity-70">
                        {new Date(it.at).toLocaleString()}
                        {it.gps
                          ? ` • (${it.gps.lat.toFixed?.(4)}, ${it.gps.lon?.toFixed?.(4)})`
                          : ""}
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        removeById(it.id);
                        refreshOutbox();
                      }}
                      className="px-2 py-1 rounded border text-sm
                                 border-rose-300 bg-rose-50 hover:bg-rose-100 text-rose-700
                                 dark:border-rose-600/40 dark:bg-rose-500/10 dark:hover:bg-rose-500/20 dark:text-rose-300"
                    >
                      Quitar
                    </button>
                  </li>
                ))}
              </ul>
              <div className="flex justify-end gap-3">
                <button onClick={transmitNow} disabled={syncing} className="btn-neon">
                  {syncing ? "Transmitiendo…" : "Transmitir ahora"}
                </button>
              </div>
            </>
          )}
        </section>
      )}

      {/* BASE OFFLINE */}
      {tab === "dump" && (
        <section className={[cardClass, cardFallback].join(" ")}>
          <div className="flex items-center justify-between gap-4 mb-4">
            <h3 className="font-semibold text-lg">Base de datos offline</h3>
            <span className="text-sm opacity-70">{getOutbox().length} check-ins almacenados</span>
          </div>

          {getOutbox().length === 0 ? (
            <div className="text-slate-600 dark:text-white/80 mb-4">
              No hay información offline guardada en este dispositivo.
            </div>
          ) : (
            <p className="text-sm text-slate-600 dark:text-white/70 mb-3">
              Esto es lo que se enviará al servidor. Incluye check-ins, progreso, datos del guardia y
              algunos registros locales.
            </p>
          )}

          <div className="flex justify-end gap-3">
            <button onClick={() => nav("/rondasqr/scan")} className={neutralBtn}>
              Volver
            </button>
            <button
              onClick={sendOfflineDump}
              className="btn-neon btn-neon-green"
              disabled={getOutbox().length === 0}
            >
              Enviar base de datos
            </button>
          </div>
        </section>
      )}

      {/* FOTOS / MENSAJE legacy quedan igual */}
      {tab === "fotos" && (
        <section className={[cardClass, cardFallback].join(" ")}>
          <h3 className="font-semibold text-lg mb-3">Enviar Fotos</h3>
          <PhotoPicker photos={photos} setPhotos={setPhotos} />
          <div className="mt-4 flex justify-end gap-3">
            <button onClick={() => nav("/rondasqr/scan")} className={neutralBtn}>
              Cancelar
            </button>
            <button onClick={sendPhotos} disabled={sendingPhotos} className="btn-neon">
              {sendingPhotos ? "Enviando…" : "Enviar"}
            </button>
          </div>
        </section>
      )}

      {tab === "msg" && (
        <section className={[cardClass, cardFallback].join(" ")}>
          <h3 className="text-lg font-semibold mb-3">Mensaje / Incidente</h3>
          <textarea
            className="w-full rounded-lg px-3 py-2 border bg-white/70 text-slate-800 placeholder-slate-400
                       border-neutral-300/70 focus:outline-none focus:ring-2 focus:ring-indigo-300
                       dark:bg-white/5 dark:text-white dark:placeholder-white/60 dark:border-white/15"
            rows={5}
            placeholder="Describa el incidente..."
            value={msg}
            onChange={(e) => setMsg(e.target.value)}
          />
          <div className="mt-4 flex justify-end gap-3">
            <button onClick={() => nav("/rondasqr/scan")} className={neutralBtn}>
              Cancelar
            </button>
            <button onClick={sendMessage} disabled={sendingMsg} className="btn-neon">
              {sendingMsg ? "Enviando…" : "Enviar"}
            </button>
          </div>
        </section>
      )}
    </div>
  );
}

/* ========== subcomponentes ========== */
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
