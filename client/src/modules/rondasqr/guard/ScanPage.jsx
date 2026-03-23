// client/src/modules/rondasqr/guard/ScanPage.jsx
import React, { useState, useMemo, useEffect, useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import QrScanner from "../guard/QrScanner.jsx";
import { rondasqrApi } from "../api/rondasqrApi.js";

import { emitLocalPanic } from "../utils/panicBus.js";
import {
  getOutbox,
  queueCheckin,
  transmitOutbox,
  countOutbox,
} from "../utils/outbox.js";

import { useAuth } from "../../../pages/auth/AuthProvider.jsx";

/* =========================
   Helpers
========================= */
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

function safeLSGet(key, fallback = null) {
  try {
    if (typeof localStorage === "undefined") return fallback;
    return localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}

function safeLSSet(key, val) {
  try {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(key, val);
  } catch {}
}

function safeLSRemove(key) {
  try {
    if (typeof localStorage === "undefined") return;
    localStorage.removeItem(key);
  } catch {}
}

function buildAssignmentKey(a) {
  return (
    a.id ||
    a._id ||
    [
      a.date || a.day || a.assignmentDate || "",
      a.roundId || a.roundName || "",
      a.guardId || a.guard?.id || a.guard?._id || "",
    ].join("|")
  );
}

function normalizeArray(v) {
  if (Array.isArray(v)) return v.filter(Boolean).map(String);
  if (typeof v === "string" && v.trim()) return [v.trim()];
  return [];
}

function uniqLower(arr) {
  return Array.from(
    new Set(
      normalizeArray(arr)
        .map((x) => String(x).trim().toLowerCase())
        .filter(Boolean)
    )
  );
}

function resolvePrincipal(user) {
  if (!user || typeof user !== "object") return null;

  if (user.user && typeof user.user === "object") {
    const merged = {
      ...user.user,
      ...user,
      can:
        user?.can && typeof user.can === "object"
          ? user.can
          : user?.user?.can && typeof user.user.can === "object"
          ? user.user.can
          : {},
      superadmin:
        user?.superadmin === true ||
        user?.isSuperAdmin === true ||
        user?.user?.superadmin === true ||
        user?.user?.isSuperAdmin === true,
      isSuperAdmin:
        user?.isSuperAdmin === true ||
        user?.superadmin === true ||
        user?.user?.isSuperAdmin === true ||
        user?.user?.superadmin === true,
    };

    const perms = uniqLower(merged?.perms || merged?.permissions || []);
    return {
      ...merged,
      perms,
      permissions: perms,
    };
  }

  const perms = uniqLower(user?.perms || user?.permissions || []);

  return {
    ...user,
    can: user?.can && typeof user.can === "object" ? user.can : {},
    superadmin: user?.superadmin === true || user?.isSuperAdmin === true,
    isSuperAdmin: user?.isSuperAdmin === true || user?.superadmin === true,
    perms,
    permissions: perms,
  };
}

function hasPermLike(principal, key) {
  const wanted = String(key || "").trim().toLowerCase();
  if (!wanted) return false;

  const perms = uniqLower(principal?.perms || principal?.permissions || []);
  return perms.includes("*") || perms.includes(wanted);
}

function buildGuardIdentity(user) {
  const id = user?._id || user?.id || user?.sub || null;
  const name =
    user?.fullName ||
    user?.nombre ||
    user?.name ||
    user?.displayName ||
    user?.username ||
    "";
  const email = user?.email || "";
  const role =
    user?.role?.name ||
    user?.role?.label ||
    user?.role ||
    (Array.isArray(user?.roles) ? user.roles.join(", ") : user?.roles || "");

  return {
    id: id ? String(id) : null,
    name: String(name || "").trim(),
    email: String(email || "").trim(),
    role: String(role || "").trim(),
    label:
      String(name || "").trim() ||
      String(email || "").trim() ||
      "Guardia desconocido",
  };
}

function toFixedNumber(value, digits = 6) {
  const num = Number(value);
  if (!Number.isFinite(num)) return null;
  return Number(num.toFixed(digits));
}

function buildMapsUrls(lat, lon) {
  const okLat = Number.isFinite(Number(lat));
  const okLon = Number.isFinite(Number(lon));
  if (!okLat || !okLon) return { googleMapsUrl: "", wazeUrl: "" };

  const latLng = `${lat},${lon}`;
  return {
    googleMapsUrl: `https://www.google.com/maps?q=${encodeURIComponent(latLng)}`,
    wazeUrl: `https://waze.com/ul?ll=${encodeURIComponent(
      latLng
    )}&navigate=yes`,
  };
}

async function getCurrentGeo(extraOptions = {}) {
  if (
    typeof navigator === "undefined" ||
    !("geolocation" in navigator) ||
    !navigator.geolocation
  ) {
    return null;
  }

  const options = {
    enableHighAccuracy: true,
    timeout: 10000,
    maximumAge: 0,
    ...extraOptions,
  };

  return await new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = pos?.coords || {};
        const lat = toFixedNumber(coords.latitude, 6);
        const lon = toFixedNumber(coords.longitude, 6);
        const accuracy = toFixedNumber(coords.accuracy, 2);
        const altitude = toFixedNumber(coords.altitude, 2);
        const heading = toFixedNumber(coords.heading, 2);
        const speed = toFixedNumber(coords.speed, 2);
        const capturedAt = new Date(
          pos?.timestamp || Date.now()
        ).toISOString();
        const { googleMapsUrl, wazeUrl } = buildMapsUrls(lat, lon);

        resolve({
          lat,
          lon,
          accuracy,
          altitude,
          heading,
          speed,
          capturedAt,
          source: "browser-geolocation",
          googleMapsUrl,
          wazeUrl,
          coordsText:
            Number.isFinite(lat) && Number.isFinite(lon) ? `${lat}, ${lon}` : "",
        });
      },
      () => resolve(null),
      options
    );
  });
}

async function panicApiCompat(payload) {
  if (!rondasqrApi || typeof rondasqrApi.panic !== "function") {
    throw new Error("rondasqrApi no implementa panic");
  }

  try {
    return await rondasqrApi.panic(payload);
  } catch (err) {
    const gpsOnly =
      payload?.gps && typeof payload.gps === "object"
        ? {
            lat: payload.gps.lat ?? null,
            lon: payload.gps.lon ?? null,
          }
        : null;

    if (gpsOnly?.lat != null && gpsOnly?.lon != null) {
      return await rondasqrApi.panic(gpsOnly);
    }

    return await rondasqrApi.panic(null);
  }
}

export default function ScanPage() {
  const nav = useNavigate();
  const { pathname, hash } = useLocation();

  const { user, isLoading, hasPerm, isSuperAdmin } = useAuth();
  const principal = resolvePrincipal(user) || {};
  const safeUser = principal;

  const can =
    safeUser?.can && typeof safeUser.can === "object" ? safeUser.can : {};
  const isSuperadmin =
    safeUser?.superadmin === true ||
    safeUser?.isSuperAdmin === true ||
    isSuperAdmin === true;

  const authHasPerm =
    typeof hasPerm === "function"
      ? hasPerm
      : (key) => hasPermLike(safeUser, key);

  const allowModule =
    isSuperadmin ||
    can["nav.rondas"] === true ||
    can["rondas.panel"] === true ||
    can["rondasqr.scan"] === true ||
    can["rondasqr.reports"] === true ||
    can["rondasqr.admin"] === true ||
    authHasPerm("rondasqr.scan.execute") ||
    authHasPerm("rondasqr.scan.manual") ||
    authHasPerm("rondasqr.checks.write") ||
    authHasPerm("rondasqr.assignments.read") ||
    authHasPerm("rondasqr.rounds.read") ||
    authHasPerm("rondasqr.panic.read") ||
    authHasPerm("rondasqr.panic.write") ||
    authHasPerm("rondasqr.offline.read") ||
    authHasPerm("rondasqr.offline.write");

  const allowScan =
    isSuperadmin ||
    can["rondasqr.scan"] === true ||
    can["rondas.panel"] === true ||
    authHasPerm("rondasqr.scan.execute") ||
    authHasPerm("rondasqr.scan.manual") ||
    authHasPerm("rondasqr.checks.write");

  const allowPanic =
    isSuperadmin ||
    authHasPerm("rondasqr.panic.write") ||
    authHasPerm("rondasqr.panic.read");

  const allowOffline =
    isSuperadmin ||
    authHasPerm("rondasqr.offline.read") ||
    authHasPerm("rondasqr.offline.write");

  const allowIncidentMessage =
    isSuperadmin ||
    authHasPerm("incidentes.records.write") ||
    authHasPerm("incidentes.create") ||
    authHasPerm("incidentes.evidences.write");

  const DEBUG_PERMS = import.meta.env.DEV && false;

  useEffect(() => {
    if (!allowModule) return;

    try {
      if (typeof window !== "undefined" && "Notification" in window) {
        if (Notification.permission === "default") {
          Notification.requestPermission().catch(() => {});
        }
      }
    } catch {}
  }, [allowModule]);

  const tab = useMemo(() => {
    if (pathname.endsWith("/qr")) return "qr";
    if (pathname.endsWith("/msg")) return "msg";
    if (pathname.endsWith("/fotos")) return "fotos";
    if (pathname.endsWith("/outbox") || pathname.endsWith("/sync"))
      return "outbox";
    if (pathname.endsWith("/dump") || pathname.endsWith("/offline"))
      return "dump";
    return "home";
  }, [pathname]);

  useEffect(() => {
    if (tab === "msg" && allowIncidentMessage) {
      nav("/incidentes/nuevo?from=ronda", { replace: true });
    }
  }, [tab, nav, allowIncidentMessage]);

  const [msg, setMsg] = useState("");
  const [photos, setPhotos] = useState([null, null, null, null, null]);
  const [sendingAlert, setSendingAlert] = useState(false);
  const [sendingMsg, setSendingMsg] = useState(false);
  const [sendingPhotos, setSendingPhotos] = useState(false);

  const [points, setPoints] = useState([]);
  useEffect(() => {
    if (!allowScan) return;

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
  }, [allowScan]);

  const [progress, setProgress] = useState({
    lastPoint: null,
    nextPoint: null,
    pct: 0,
  });

  function loadLocalProgress() {
    const lastPoint = safeLSGet("rondasqr:lastPointName", null);
    const nextPoint = safeLSGet("rondasqr:nextPointName", null);
    const pct = Math.max(
      0,
      Math.min(100, Number(safeLSGet("rondasqr:progressPct", 0) || 0))
    );
    setProgress({ lastPoint, nextPoint, pct });
  }

  useEffect(() => {
    if (!allowModule) return;
    loadLocalProgress();
  }, [allowModule]);

  const [myAssignments, setMyAssignments] = useState([]);
  const [assignmentStates, setAssignmentStates] = useState({});
  const [currentAssignmentKey, setCurrentAssignmentKey] = useState(null);

  function loadAssignmentStates() {
    try {
      const raw = safeLSGet("rondasqr:assignmentStates", null);
      const keyRaw = safeLSGet("rondasqr:currentAssignmentKey", null);

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
      safeLSSet("rondasqr:assignmentStates", JSON.stringify(next));
    } catch {}
  }

  function setActiveAssignment(a) {
    const key = buildAssignmentKey(a);
    if (!key) return;
    setCurrentAssignmentKey(key);
    try {
      safeLSSet("rondasqr:currentAssignmentKey", key);
      safeLSSet("rondasqr:currentAssignment", JSON.stringify(a));
    } catch {}
  }

  function clearActiveAssignment() {
    setCurrentAssignmentKey(null);
    safeLSRemove("rondasqr:currentAssignmentKey");
    safeLSRemove("rondasqr:currentAssignment");
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

  function handleStartRound(a) {
    if (!allowScan) {
      alert("No tienes permiso para iniciar rondas.");
      return;
    }

    setActiveAssignment(a);
    updateAssignmentStatus(a, "en_progreso", {
      startedAt: new Date().toISOString(),
    });
    nav("/rondasqr/scan/qr");
  }

  function handleFinishRound(a) {
    if (!allowScan) {
      alert("No tienes permiso para finalizar rondas.");
      return;
    }

    updateAssignmentStatus(a, "terminada", {
      finishedAt: new Date().toISOString(),
      progressPct: progress.pct,
    });
    clearActiveAssignment();
  }

  function loadAssignmentsForGuard() {
    const all = readJsonLS("rondasqr:assignments", []);
    if (!Array.isArray(all)) {
      setMyAssignments([]);
      return;
    }

    const myId = String(safeUser?._id || safeUser?.id || "").trim();
    const myEmail = String(safeUser?.email || "").toLowerCase().trim();
    const myName = String(safeUser?.name || "").toLowerCase().trim();

    const mine = all.filter((a) => {
      const gId = String(a.guardId || a.guard?._id || a.guard?.id || "").trim();
      const gEmail = String(a.guardEmail || a.guard?.email || "")
        .toLowerCase()
        .trim();
      const gName = String(a.guardName || a.guard?.name || "")
        .toLowerCase()
        .trim();

      if (myId && gId) return gId === myId;
      if (myEmail && gEmail) return gEmail === myEmail;
      if (myName && gName) return myName === gName;
      return false;
    });

    setMyAssignments(mine);
  }

  useEffect(() => {
    if (!allowModule) return;

    const hasIdentity = !!(safeUser?._id || safeUser?.email || safeUser?.name);
    if (!hasIdentity) return;

    loadAssignmentsForGuard();
    loadAssignmentStates();

    function handleStorage(e) {
      if (!e) return;
      if (e.key === "rondasqr:assignments") loadAssignmentsForGuard();
      if (
        e.key === "rondasqr:assignmentStates" ||
        e.key === "rondasqr:currentAssignmentKey"
      ) {
        loadAssignmentStates();
      }
    }

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, [safeUser?._id, safeUser?.email, safeUser?.name, allowModule]);

  const sendAlert = useCallback(async () => {
    if (!allowPanic) {
      alert("No tienes permiso para enviar alertas de pánico.");
      return false;
    }

    if (sendingAlert) return false;
    setSendingAlert(true);

    try {
      const guard = buildGuardIdentity(safeUser);
      const geo = await getCurrentGeo({
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      });

      const payload = {
        type: "panic",
        source: "rondasqr.scan.home-button",
        title: "🚨 Alerta de pánico",
        message: "Alerta de pánico enviada desde ronda",
        incidentText: "Alerta de pánico enviada desde ronda",
        emittedAt: new Date().toISOString(),
        guard,
        guardId: guard.id,
        guardName: guard.name,
        guardEmail: guard.email,
        gps: geo
          ? {
              lat: geo.lat,
              lon: geo.lon,
              accuracy: geo.accuracy,
              altitude: geo.altitude,
              heading: geo.heading,
              speed: geo.speed,
              capturedAt: geo.capturedAt,
              source: geo.source,
            }
          : null,
        location: geo
          ? {
              lat: geo.lat,
              lon: geo.lon,
              accuracy: geo.accuracy,
              coordsText: geo.coordsText,
              googleMapsUrl: geo.googleMapsUrl,
              wazeUrl: geo.wazeUrl,
              capturedAt: geo.capturedAt,
            }
          : null,
        links: geo
          ? {
              googleMapsUrl: geo.googleMapsUrl,
              wazeUrl: geo.wazeUrl,
            }
          : null,
      };

      await panicApiCompat(payload);

      emitLocalPanic({
        ...payload,
        user: guard.label,
      });

      try {
        if (
          typeof window !== "undefined" &&
          "Notification" in window &&
          Notification.permission === "granted"
        ) {
          new Notification("🚨 Alerta de pánico", {
            body: `${guard.label} reportó una alerta${
              geo?.coordsText ? ` · ${geo.coordsText}` : ""
            }`,
          });
        }
      } catch {}

      alert("🚨 Alerta de pánico enviada.");
      return true;
    } catch (err) {
      console.error("[ScanPage] error al enviar alerta", err);
      alert("No se pudo enviar la alerta.");
      return false;
    } finally {
      setSendingAlert(false);
    }
  }, [sendingAlert, safeUser, allowPanic]);

  useEffect(() => {
    if (hash === "#alert" && allowPanic) {
      (async () => {
        const ok = await sendAlert();
        if (ok) nav("/rondasqr/scan", { replace: true });
      })();
    }
  }, [hash, nav, sendAlert, allowPanic]);

  async function handleScan(result) {
    if (!allowScan) {
      alert("No tienes permiso para registrar puntos.");
      return;
    }

    const qr = typeof result === "string" ? result : result?.text;
    if (!qr) return;

    if (typeof navigator !== "undefined" && !navigator.onLine) {
      queueCheckin({ qr, gps: null });
      alert("📦 Sin conexión. QR guardado para transmitir más tarde.");
      nav("/rondasqr/scan", { replace: true });
      return;
    }

    try {
      let gps = null;
      const geo = await getCurrentGeo({
        enableHighAccuracy: true,
        timeout: 3000,
        maximumAge: 0,
      });

      if (geo) {
        gps = { lat: geo.lat, lon: geo.lon };
      }

      if (typeof rondasqrApi.checkinScan === "function") {
        await rondasqrApi.checkinScan({ qr, gps });
      } else if (typeof rondasqrApi.scan === "function") {
        await rondasqrApi.scan({ qr, gps });
      } else {
        throw new Error("rondasqrApi no implementa checkinScan/scan");
      }

      safeLSSet("rondasqr:lastPointName", qr);
      safeLSSet("rondasqr:progressPct", "100");
      setProgress((prev) => ({ ...prev, lastPoint: qr, pct: 100 }));

      alert("✅ Punto registrado: " + qr);
      window.dispatchEvent(new CustomEvent("qrscanner:stop"));
      nav("/rondasqr/scan", { replace: true });
    } catch (err) {
      console.error(
        "[ScanPage] error al registrar punto (se guarda en pendientes)",
        err
      );
      queueCheckin({ qr, gps: null });
      alert("📦 No se pudo enviar. Guardado para transmitir más tarde.");
      nav("/rondasqr/scan/outbox", { replace: true });
    }
  }

  async function sendMessage() {
    if (!allowIncidentMessage) {
      alert("No tienes permiso para enviar incidentes.");
      return;
    }

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

  async function sendPhotos() {
    if (!allowIncidentMessage) {
      alert("No tienes permiso para enviar fotos/incidentes.");
      return;
    }

    if (sendingPhotos) return;
    const base64s = photos.filter(Boolean);
    if (!base64s.length) {
      alert("Selecciona al menos una foto.");
      return;
    }

    setSendingPhotos(true);
    try {
      await rondasqrApi.postIncident({
        text: "Fotos de ronda",
        photosBase64: base64s,
      });
      alert("📤 Fotos enviadas.");
      setPhotos([null, null, null, null, null]);
      nav("/rondasqr/scan");
    } catch {
      alert("No se pudieron enviar las fotos.");
    } finally {
      setSendingPhotos(false);
    }
  }

  const [outbox, setOutbox] = useState(getOutbox());
  const [syncing, setSyncing] = useState(false);
  const refreshOutbox = () => setOutbox(getOutbox());

  async function sendCheckinViaApi(it) {
    if (!allowScan) {
      throw new Error("Sin permiso para transmitir checkins");
    }

    if (typeof rondasqrApi.checkinScan === "function") {
      await rondasqrApi.checkinScan({ qr: it.qr, gps: it.gps || null });
      return;
    }
    if (typeof rondasqrApi.scan === "function") {
      await rondasqrApi.scan({ qr: it.qr, gps: it.gps || null });
      return;
    }
    throw new Error("rondasqrApi no implementa checkinScan/scan");
  }

  async function transmitNow() {
    if (!allowScan) {
      alert("No tienes permiso para transmitir rondas.");
      return;
    }

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
    if (tab === "outbox" && allowModule) refreshOutbox();
  }, [tab, allowModule]);

  function buildOfflinePayload(currentUser) {
    const outboxData = getOutbox();
    const progressData = {
      lastPoint: safeLSGet("rondasqr:lastPointName", null),
      nextPoint: safeLSGet("rondasqr:nextPointName", null),
      pct: Number(safeLSGet("rondasqr:progressPct", 0) || 0),
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

    const userInfo = currentUser
      ? {
          id: currentUser._id || currentUser.id || null,
          email: currentUser.email || null,
          name: currentUser.name || null,
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
    if (!allowOffline) {
      alert("No tienes permiso para manejar modo offline.");
      return;
    }

    try {
      const payload = buildOfflinePayload(safeUser);
      const pending = payload.outbox;

      if (!pending || !pending.length) {
        alert("No hay información offline para enviar.");
        return;
      }

      if (typeof rondasqrApi.offlineDump === "function") {
        const json = await rondasqrApi.offlineDump(payload);
        alert("📤 Base de datos local enviada.\n" + (json?.message || ""));
        return;
      }

      throw new Error("rondasqrApi no implementa offlineDump(payload)");
    } catch (err) {
      console.error("[ScanPage] dump offline error", err);
      alert("No se pudo enviar la base de datos.");
    }
  }

  useEffect(() => {
    if (!allowModule) return;

    let stop = false;

    async function autoSync() {
      try {
        if (stop) return;
        if (typeof navigator !== "undefined" && !navigator.onLine) return;

        const pendingOutbox = getOutbox();
        const hasOutbox =
          Array.isArray(pendingOutbox) && pendingOutbox.length > 0;

        if (hasOutbox && allowScan) {
          try {
            await transmitOutbox(sendCheckinViaApi);
            refreshOutbox();
          } catch (e) {
            console.error("[autoSync] error transmitiendo outbox", e);
          }
        }

        const payload = buildOfflinePayload(safeUser);
        const hasDumpOutbox =
          Array.isArray(payload.outbox) && payload.outbox.length > 0;
        const hasAssignments =
          Array.isArray(payload.assignments) && payload.assignments.length > 0;
        const hasLogs = Array.isArray(payload.logs) && payload.logs.length > 0;

        if (!(hasDumpOutbox || hasAssignments || hasLogs)) return;

        if (allowOffline && typeof rondasqrApi.offlineDump === "function") {
          try {
            await rondasqrApi.offlineDump(payload);
          } catch (e) {
            console.error("[autoSync] error enviando dump offline", e);
          }
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
      return () => {
        stop = true;
        window.removeEventListener("online", handleOnline);
      };
    }
  }, [safeUser?._id, allowModule, allowScan, allowOffline]);

  const pageClass = "space-y-6 layer-content";
  const headerClass =
    "fx-card rounded-2xl px-4 sm:px-6 py-3 flex items-center justify-between gap-4";
  const cardClass = "fx-card rounded-2xl p-4 sm:p-6";
  const headerFallback =
    "bg-white/70 border border-neutral-300/70 shadow-sm dark:bg-white/5 dark:border-white/15 dark:shadow-none dark:backdrop-blur";
  const cardFallback =
    "bg-white/70 border border-neutral-300/70 shadow-sm dark:bg-white/5 dark:border-white/15 dark:shadow-none dark:backdrop-blur";

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
  `;

  const homeCols = "md:grid-cols-2";

  const activeAssignment = useMemo(() => {
    if (!currentAssignmentKey) return null;
    const raw = readJsonLS("rondasqr:currentAssignment", null);
    return raw || null;
  }, [currentAssignmentKey]);

  function finishActiveIfAny() {
    if (!allowScan) {
      alert("No tienes permiso para finalizar rondas.");
      return;
    }

    if (activeAssignment) handleFinishRound(activeAssignment);
    nav("/rondasqr/scan", { replace: true });
  }

  if (isLoading) {
    return (
      <div className={pageClass}>
        <section className={[cardClass, cardFallback].join(" ")}>
          <div className="text-sm opacity-70">Cargando sesión...</div>
        </section>
      </div>
    );
  }

  if (!allowModule) {
    return (
      <div className={pageClass}>
        <section className={[cardClass, cardFallback].join(" ")}>
          <h3 className="text-lg font-semibold">Acceso denegado</h3>
          <p className="mt-2 text-sm text-slate-600 dark:text-white/80">
            No tienes permisos para acceder al módulo de Rondas de Vigilancia.
          </p>

          {DEBUG_PERMS && (
            <pre className="mt-4 text-[10px] opacity-60 overflow-auto">
              {JSON.stringify(
                {
                  can,
                  perms: safeUser?.perms || safeUser?.permissions || [],
                  isSuperadmin,
                },
                null,
                2
              )}
            </pre>
          )}
        </section>
      </div>
    );
  }

  return (
    <div className={pageClass}>
      <style>{neonStyles}</style>

      <div className={[headerClass, headerFallback].join(" ")}>
        <div>
          <h2 className="text-xl sm:text-2xl font-bold">Visión general</h2>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-white/70 mt-0.5">
            Hola {safeUser?.name || safeUser?.email || "guardia"}, aquí verás
            tus rondas y alertas de hoy.
          </p>

          {DEBUG_PERMS && (
            <p className="text-[10px] mt-1 opacity-60">
              superadmin={String(!!isSuperadmin)} · can={can ? "sí" : "no"}
            </p>
          )}
        </div>

        <div className="text-right text-xs sm:text-sm">
          <div className="opacity-70">Rondas pendientes por enviar</div>
          <div className="font-semibold text-lg sm:text-xl">
            {allowScan ? countOutbox() : 0}
          </div>
        </div>
      </div>

      {tab === "home" && (
        <div className={`grid grid-cols-1 ${homeCols} gap-4 sm:gap-6`}>
          <section className={[cardClass, cardFallback, "text-center"].join(" ")}>
            <div className="flex flex-col items-center">
              <button
                onClick={async () => {
                  const ok = await sendAlert();
                  if (ok) nav("/rondasqr/scan", { replace: true });
                }}
                disabled={sendingAlert || !allowPanic}
                className={[
                  "rounded-full font-extrabold text-white",
                  "bg-rose-600 hover:bg-rose-500 border-4 border-rose-400",
                  "w-28 h-28 text-lg sm:w-32 sm:h-32 sm:text-xl md:w-36 md:h-36 md:text-2xl",
                  sendingAlert || !allowPanic
                    ? "cursor-not-allowed opacity-80"
                    : "",
                ].join(" ")}
                type="button"
              >
                {sendingAlert ? "ENVIANDO..." : "ALERTA"}
              </button>
              <p className="text-sm mt-2 text-slate-600 dark:text-white/80">
                {allowPanic
                  ? "Oprima en caso de emergencia"
                  : "No autorizado para alertas"}
              </p>
            </div>

            <div className="mt-6 grid gap-3 max-w-md mx-auto w-full">
              {allowScan && (
                <button
                  type="button"
                  onClick={() => nav("/rondasqr/scan/qr")}
                  className="w-full btn-neon"
                >
                  Registrador Punto Control
                </button>
              )}

              {allowIncidentMessage && (
                <button
                  type="button"
                  onClick={() => nav("/incidentes/nuevo?from=ronda")}
                  className="w-full btn-neon btn-neon-purple"
                >
                  Mensaje Incidente
                </button>
              )}

              {!allowScan && !allowIncidentMessage && !allowPanic && (
                <div className="text-sm opacity-70">
                  No tienes acciones disponibles en este módulo.
                </div>
              )}
            </div>
          </section>

          <section className={[cardClass, cardFallback].join(" ")}>
            <h3 className="font-semibold text-lg mb-3">Progreso de Ronda</h3>

            {!allowScan ? (
              <p className="text-sm text-slate-600 dark:text-white/80">
                No tienes permiso para operar rondas.
              </p>
            ) : progress.lastPoint || progress.nextPoint || progress.pct > 0 ? (
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
                    style={{
                      width: `${Math.max(
                        0,
                        Math.min(100, progress.pct)
                      )}%`,
                    }}
                  />
                </div>

                <div className="mt-1 text-right text-xs opacity-70">
                  {Math.max(0, Math.min(100, progress.pct))}% completado
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => nav("/rondasqr/scan/qr")}
                    className="btn-neon"
                  >
                    Continuar ronda
                  </button>
                  <button
                    type="button"
                    onClick={finishActiveIfAny}
                    className="btn-neon btn-neon-amber"
                  >
                    Finalizar ronda
                  </button>
                </div>
              </>
            ) : (
              <p className="text-sm text-slate-600 dark:text-white/80">
                Para iniciar una ronda, abre el{" "}
                <strong>Registrador Punto Control</strong> y escanea el primer
                punto asignado.
              </p>
            )}
          </section>

          <section
            className={[cardClass, cardFallback, "md:col-span-2"].join(" ")}
          >
            <div className="text-sm opacity-70">
              Asignaciones cargadas: <b>{allowScan ? myAssignments.length : 0}</b>
            </div>

            {!!myAssignments.length && allowScan && (
              <div className="mt-4 grid gap-3">
                {myAssignments.map((a, idx) => {
                  const key = buildAssignmentKey(a);
                  const st = assignmentStates[key] || {};
                  const isActive = currentAssignmentKey === key;

                  return (
                    <div
                      key={key || idx}
                      className="rounded-xl border border-black/10 dark:border-white/10 p-3 flex flex-col md:flex-row md:items-center md:justify-between gap-3"
                    >
                      <div>
                        <div className="font-semibold">
                          {a.roundName || a.round?.name || "Ronda"}
                        </div>
                        <div className="text-sm opacity-70">
                          {a.siteName || a.site?.name || "Sitio"} ·{" "}
                          {a.date || a.day || "—"}
                        </div>
                        <div className="text-xs opacity-70 mt-1">
                          Estado: {st.status || "pendiente"}
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => handleStartRound(a)}
                          className="btn-neon btn-neon-green"
                        >
                          {isActive ? "Continuar" : "Iniciar"}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleFinishRound(a)}
                          className="btn-neon btn-neon-amber"
                        >
                          Finalizar
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      )}

      {tab === "qr" && (
        <section className={[cardClass, cardFallback].join(" ")}>
          <h3 className="font-semibold text-lg mb-3">Escanear Punto</h3>

          {!allowScan ? (
            <p className="text-sm text-slate-600 dark:text-white/80">
              No tienes permiso para registrar puntos de control.
            </p>
          ) : (
            <>
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
                  type="button"
                  onClick={() => {
                    window.dispatchEvent(new CustomEvent("qrscanner:stop"));
                    nav("/rondasqr/scan");
                  }}
                  className="btn-neon btn-neon-amber"
                >
                  Finalizar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    window.dispatchEvent(new CustomEvent("qrscanner:stop"));
                    nav("/rondasqr/scan/qr");
                  }}
                  className="btn-neon btn-neon-green"
                >
                  Reintentar
                </button>
              </div>
            </>
          )}
        </section>
      )}

      {tab === "outbox" && (
        <section className={[cardClass, cardFallback].join(" ")}>
          <div className="flex items-center justify-between gap-3 mb-3">
            <h3 className="font-semibold text-lg">Pendientes por enviar</h3>
            <button
              type="button"
              disabled={syncing || !allowScan}
              onClick={transmitNow}
              className="btn-neon btn-neon-green"
            >
              {syncing ? "Enviando..." : "Transmitir ahora"}
            </button>
          </div>

          <div className="text-sm opacity-80">
            Pendientes: {allowScan ? outbox.length : 0}
          </div>
        </section>
      )}

      {tab === "dump" && (
        <section className={[cardClass, cardFallback].join(" ")}>
          <h3 className="font-semibold text-lg mb-3">Enviar base offline</h3>
          <button
            type="button"
            onClick={sendOfflineDump}
            disabled={!allowOffline}
            className="btn-neon"
          >
            Enviar
          </button>
        </section>
      )}

      {tab === "fotos" && (
        <section className={[cardClass, cardFallback].join(" ")}>
          <h3 className="font-semibold text-lg mb-3">Fotos</h3>

          {!allowIncidentMessage ? (
            <p className="text-sm text-slate-600 dark:text-white/80">
              No tienes permiso para adjuntar evidencias o incidentes.
            </p>
          ) : (
            <>
              <PhotoPicker photos={photos} setPhotos={setPhotos} />
              <div className="mt-4">
                <button
                  type="button"
                  disabled={sendingPhotos}
                  onClick={sendPhotos}
                  className="btn-neon btn-neon-green"
                >
                  {sendingPhotos ? "Enviando..." : "Enviar fotos"}
                </button>
              </div>
            </>
          )}
        </section>
      )}
    </div>
  );
}

function PhotoPicker({ photos, setPhotos }) {
  return (
    <>
      {photos.map((f, i) => (
        <div key={i} className="flex items-center justify-between mb-2">
          <span className="text-sm text-slate-700 dark:text-white/90">
            Toma foto {i + 1}
          </span>
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
              onClick={() =>
                setPhotos((p) => p.map((f2, idx) => (idx === i ? null : f2)))
              }
              className="px-3 py-1 rounded-md text-white bg-rose-600 hover:bg-rose-500"
              type="button"
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