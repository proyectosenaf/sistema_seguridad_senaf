// client/src/components/GlobalPanicListener.jsx
import React, { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { useLocation } from "react-router-dom";
import { subscribeLocalPanic } from "../modules/rondasqr/utils/panicBus.js";
import { useAuth } from "../pages/auth/AuthProvider.jsx";
import { socket, joinSocketIdentity } from "../lib/socket.js";

function toArray(v) {
  if (Array.isArray(v)) return v;
  if (v == null) return [];
  return [v];
}

function normalizeRoleName(role) {
  if (!role) return "";

  if (typeof role === "string") return role.trim().toLowerCase();

  if (typeof role === "object") {
    return String(
      role.key ||
        role.code ||
        role.slug ||
        role.name ||
        role.nombre ||
        role.label ||
        ""
    )
      .trim()
      .toLowerCase();
  }

  return String(role).trim().toLowerCase();
}

function resolvePrincipal(user) {
  if (!user || typeof user !== "object") return null;

  if (user.user && typeof user.user === "object") {
    return {
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
    };
  }

  return {
    ...user,
    can: user?.can && typeof user.can === "object" ? user.can : {},
    superadmin: user?.superadmin === true || user?.isSuperAdmin === true,
  };
}

function getRolesFromUser(user) {
  const u = resolvePrincipal(user) || {};
  return [
    ...new Set(
      [...toArray(u?.roles), ...toArray(u?.role), ...toArray(u?.rol)]
        .map(normalizeRoleName)
        .filter(Boolean)
    ),
  ];
}

function isVisitorUser(user) {
  const roles = getRolesFromUser(user);

  if (
    roles.some((r) =>
      ["visitante", "visitantes", "visita", "visitor", "visitors"].includes(r)
    )
  ) {
    return true;
  }

  try {
    const hint = String(localStorage.getItem("senaf_is_visitor") || "")
      .trim()
      .toLowerCase();
    return hint === "1" || hint === "true" || hint === "yes";
  } catch {
    return false;
  }
}

function asText(v) {
  return String(v || "").trim();
}

function pickFirstText(...values) {
  for (const v of values) {
    const s = asText(v);
    if (s) return s;
  }
  return "";
}

function numberOrNull(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function buildMapLinks(lat, lon) {
  const nLat = numberOrNull(lat);
  const nLon = numberOrNull(lon);

  if (nLat == null || nLon == null) {
    return {
      googleMapsUrl: "",
      wazeUrl: "",
      coordsText: "",
      osmEmbedUrl: "",
    };
  }

  const coordsText = `${nLat}, ${nLon}`;
  const delta = 0.0035;
  const left = nLon - delta;
  const right = nLon + delta;
  const top = nLat + delta;
  const bottom = nLat - delta;

  return {
    coordsText,
    googleMapsUrl: `https://www.google.com/maps?q=${encodeURIComponent(coordsText)}`,
    wazeUrl: `https://waze.com/ul?ll=${encodeURIComponent(coordsText)}&navigate=yes`,
    osmEmbedUrl: `https://www.openstreetmap.org/export/embed.html?bbox=${left}%2C${bottom}%2C${right}%2C${top}&layer=mapnik&marker=${nLat}%2C${nLon}`,
  };
}

function normalizeRemotePayload(payload = {}) {
  const item =
    payload?.item && typeof payload.item === "object" ? payload.item : null;
  const meta =
    payload?.meta && typeof payload.meta === "object" ? payload.meta : {};
  const guard =
    payload?.guard && typeof payload.guard === "object" ? payload.guard : {};
  const gps =
    payload?.gps && typeof payload.gps === "object"
      ? payload.gps
      : payload?.location && typeof payload.location === "object"
      ? payload.location
      : item?.gps && typeof item.gps === "object"
      ? item.gps
      : {};
  const links =
    payload?.links && typeof payload.links === "object"
      ? payload.links
      : payload?.location && typeof payload.location === "object"
      ? payload.location
      : {};

  const guardName = pickFirstText(
    payload?.guardName,
    guard?.name,
    payload?.user,
    item?.guardName,
    meta?.guardName
  );

  const guardEmail = pickFirstText(
    payload?.guardEmail,
    guard?.email,
    item?.guardEmail,
    meta?.guardEmail
  );

  const lat = numberOrNull(
    gps?.lat ?? gps?.latitude ?? payload?.lat ?? payload?.latitude
  );
  const lon = numberOrNull(
    gps?.lon ??
      gps?.lng ??
      gps?.longitude ??
      payload?.lon ??
      payload?.lng ??
      payload?.longitude
  );

  const fallbackLinks = buildMapLinks(lat, lon);

  const googleMapsUrl = pickFirstText(
    links?.googleMapsUrl,
    payload?.googleMapsUrl,
    meta?.googleMapsUrl,
    fallbackLinks.googleMapsUrl
  );

  const wazeUrl = pickFirstText(
    links?.wazeUrl,
    payload?.wazeUrl,
    meta?.wazeUrl,
    fallbackLinks.wazeUrl
  );

  const coordsText = pickFirstText(
    links?.coordsText,
    gps?.coordsText,
    payload?.coordsText,
    fallbackLinks.coordsText
  );

  const accuracyRaw =
    gps?.accuracy ?? payload?.accuracy ?? payload?.location?.accuracy;
  const accuracy =
    accuracyRaw == null || accuracyRaw === "" || !Number.isFinite(Number(accuracyRaw))
      ? ""
      : `${Number(accuracyRaw).toFixed(0)} m`;

  const body = pickFirstText(
    payload?.body,
    payload?.message,
    payload?.incidentText,
    item?.text,
    meta?.body,
    payload?.kind === "panic" ? "Se activó el botón de pánico" : ""
  );

  return {
    title:
      payload?.title ||
      (payload?.kind === "panic" ? "🚨 Alerta de pánico" : null) ||
      (item?.type === "panic" ? "🚨 Alerta de pánico" : null) ||
      "ALERTA",
    body,
    source: payload?.source || payload?.kind || item?.type || "socket",
    at: payload?.ts || payload?.emittedAt || item?.at || Date.now(),
    guardName,
    guardEmail,
    guardLabel: guardName || guardEmail || "Guardia no identificado",
    lat,
    lon,
    accuracy,
    coordsText,
    googleMapsUrl,
    wazeUrl,
    osmEmbedUrl: fallbackLinks.osmEmbedUrl,
  };
}

export default function GlobalPanicListener() {
  const { isAuthenticated, user } = useAuth();
  const { pathname } = useLocation();

  const principal = resolvePrincipal(user) || {};
  const visitor = isVisitorUser(principal);

  const audioRef = useRef(null);
  const suppressRemoteUntilRef = useRef(0);
  const lastAutoOpenedRef = useRef("");

  const [hasAlert, setHasAlert] = useState(false);
  const [alertMeta, setAlertMeta] = useState(null);
  const [audioError, setAudioError] = useState("");

  const showRondasUI = pathname.startsWith("/rondasqr");

  const audioSrc = useMemo(() => {
    const base = String(import.meta.env.BASE_URL || "/");
    return `${base}audio/mixkit-sound-alert-in-hall-1006.wav`;
  }, []);

  const stopAlarm = useCallback(() => {
    try {
      const el = audioRef.current;
      if (!el) return;
      el.pause();
      el.currentTime = 0;
    } catch {}
  }, []);

  const playAlarm = useCallback(async () => {
    try {
      const el = audioRef.current;
      if (!el) {
        setAudioError("No se encontró el elemento de audio.");
        return false;
      }

      el.volume = 1;
      el.loop = true;
      el.muted = false;
      el.currentTime = 0;

      const p = el.play();
      if (p && typeof p.then === "function") await p;

      setAudioError("");
      return true;
    } catch (e) {
      const msg = e?.message || "El navegador bloqueó la reproducción.";
      setAudioError(msg);
      console.warn("[GlobalPanicListener] playAlarm blocked:", msg);
      return false;
    }
  }, []);

  const openMapNow = useCallback((meta) => {
    const url = meta?.googleMapsUrl || meta?.wazeUrl || "";
    if (!url) return false;

    try {
      window.open(url, "_blank", "noopener,noreferrer");
      return true;
    } catch (e) {
      console.warn("[GlobalPanicListener] no se pudo abrir mapa:", e?.message || e);
      return false;
    }
  }, []);

  const showVisualAlert = useCallback((payload = {}, source = "panic") => {
    const normalized = normalizeRemotePayload(payload);
    const eventKey = [
      normalized.title,
      normalized.at,
      normalized.guardLabel,
      normalized.lat,
      normalized.lon,
    ].join("::");

    setHasAlert(true);
    setAlertMeta({
      title: normalized.title || "ALERTA",
      body: normalized.body || "",
      at: new Date(normalized.at || Date.now()).toLocaleTimeString(),
      source,
      guardName: normalized.guardName || "",
      guardEmail: normalized.guardEmail || "",
      guardLabel: normalized.guardLabel || "",
      lat: normalized.lat,
      lon: normalized.lon,
      coordsText: normalized.coordsText || "",
      accuracy: normalized.accuracy || "",
      googleMapsUrl: normalized.googleMapsUrl || "",
      wazeUrl: normalized.wazeUrl || "",
      osmEmbedUrl: normalized.osmEmbedUrl || "",
      eventKey,
    });

    if (
      normalized.googleMapsUrl &&
      lastAutoOpenedRef.current !== eventKey
    ) {
      lastAutoOpenedRef.current = eventKey;
      openMapNow({
        googleMapsUrl: normalized.googleMapsUrl,
        wazeUrl: normalized.wazeUrl,
      });
    }
  }, [openMapNow]);

  const triggerRemoteAlert = useCallback(
    async (payload = {}, source = "socket") => {
      showVisualAlert(payload, source);

      const ok = await playAlarm();
      if (!ok) {
        console.warn(
          "[GlobalPanicListener] alerta remota recibida, pero sin audio"
        );
      }
    },
    [playAlarm, showVisualAlert]
  );

  const triggerLocalAlert = useCallback(
    async (payload = {}, source = "local-bus") => {
      showVisualAlert(payload, source);
      suppressRemoteUntilRef.current = Date.now() + 4000;
      stopAlarm();
    },
    [showVisualAlert, stopAlarm]
  );

  useEffect(() => {
    if (!isAuthenticated) return;

    const joinPayload = {
      userId: principal?._id || principal?.id || principal?.sub || "",
      email: principal?.email || "",
      roles: principal?.roles || principal?.role || principal?.rol || [],
    };

    const doIdentityJoin = () => {
      try {
        joinSocketIdentity(joinPayload);
      } catch (e) {
        console.warn(
          "[GlobalPanicListener] identity join error:",
          e?.message || e
        );
      }
    };

    doIdentityJoin();
    socket.on("connect", doIdentityJoin);

    return () => {
      socket.off("connect", doIdentityJoin);
    };
  }, [
    isAuthenticated,
    principal?._id,
    principal?.id,
    principal?.sub,
    principal?.email,
    principal?.roles,
    principal?.role,
    principal?.rol,
  ]);

  useEffect(() => {
    const unsub = subscribeLocalPanic((payload) => {
      if (!isAuthenticated) return;
      if (visitor) return;
      triggerLocalAlert(payload, "local-bus");
    });

    return () => {
      if (typeof unsub === "function") unsub();
    };
  }, [isAuthenticated, visitor, triggerLocalAlert]);

  useEffect(() => {
    if (!isAuthenticated) return;

    function onRemotePanic(payload = {}) {
      if (visitor) return;

      const now = Date.now();
      if (now < suppressRemoteUntilRef.current) return;

      triggerRemoteAlert(payload, "socket");
    }

    function onRemoteIncident(payload = {}) {
      if (visitor) return;
      if (payload?.kind !== "panic" && payload?.item?.type !== "panic") return;

      const now = Date.now();
      if (now < suppressRemoteUntilRef.current) return;

      triggerRemoteAlert(payload, "socket-incident");
    }

    socket.on("panic:new", onRemotePanic);
    socket.on("alerta:nueva", onRemotePanic);
    socket.on("rondasqr:alert", onRemotePanic);
    socket.on("rondasqr:incident", onRemoteIncident);

    return () => {
      socket.off("panic:new", onRemotePanic);
      socket.off("alerta:nueva", onRemotePanic);
      socket.off("rondasqr:alert", onRemotePanic);
      socket.off("rondasqr:incident", onRemoteIncident);
    };
  }, [isAuthenticated, visitor, triggerRemoteAlert]);

  if (!isAuthenticated) return null;

  return (
    <>
      <audio
        ref={audioRef}
        src={audioSrc}
        preload="auto"
        playsInline
        onCanPlayThrough={() => {
          console.log("[GlobalPanicListener] audio cargado:", audioSrc);
          setAudioError("");
        }}
        onError={() => {
          const msg = `No se pudo cargar el audio: ${audioSrc}`;
          setAudioError(msg);
          console.error("[GlobalPanicListener] audio error:", msg);
        }}
      />

      {!visitor && showRondasUI && audioError ? (
        <div className="fixed bottom-24 right-4 z-[9999] max-w-[280px] rounded-xl bg-red-600 text-white text-xs px-3 py-2 shadow-lg">
          {audioError}
        </div>
      ) : null}

      {!visitor && hasAlert && (
        <div className="fixed top-4 right-4 z-[9999] w-[420px] max-w-[calc(100vw-24px)] rounded-2xl border-2 border-red-300 bg-red-600 text-white shadow-2xl animate-pulse overflow-hidden">
          <div className="w-full text-left px-4 py-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-lg font-extrabold leading-none">
                  {alertMeta?.title || "ALERTA"}
                </div>
                <div className="text-[11px] opacity-90 mt-1">
                  {alertMeta?.at || "NUEVA"}
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  stopAlarm();
                  setHasAlert(false);
                }}
                className="shrink-0 rounded-full bg-white/20 border border-white/30 px-3 py-2 text-[10px] font-bold"
              >
                CERRAR
              </button>
            </div>

            {!!alertMeta?.guardLabel && (
              <div className="mt-3 text-sm">
                <span className="font-bold">Guardia: </span>
                <span>{alertMeta.guardLabel}</span>
              </div>
            )}

            {!!alertMeta?.body && (
              <div className="mt-2 text-sm leading-5 whitespace-pre-wrap">
                {alertMeta.body}
              </div>
            )}

            {!!alertMeta?.coordsText && (
              <div className="mt-3 text-xs leading-5 bg-black/15 rounded-xl px-3 py-3">
                <div>
                  <span className="font-bold">Ubicación: </span>
                  <span>{alertMeta.coordsText}</span>
                </div>

                {!!alertMeta?.accuracy && (
                  <div>
                    <span className="font-bold">Precisión: </span>
                    <span>{alertMeta.accuracy}</span>
                  </div>
                )}

                {!!alertMeta?.osmEmbedUrl && (
                  <div className="mt-3 overflow-hidden rounded-xl border border-white/20">
                    <iframe
                      title="Mapa de alerta"
                      src={alertMeta.osmEmbedUrl}
                      className="w-full h-[220px] bg-white"
                      loading="eager"
                    />
                  </div>
                )}

                <div className="mt-3 flex flex-wrap gap-2">
                  {!!alertMeta?.googleMapsUrl && (
                    <a
                      href={alertMeta.googleMapsUrl}
                      target="_blank"
                      rel="noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="inline-flex items-center rounded-lg bg-white text-red-700 px-3 py-1.5 text-xs font-bold hover:bg-red-50"
                    >
                      Google Maps
                    </a>
                  )}

                  {!!alertMeta?.wazeUrl && (
                    <a
                      href={alertMeta.wazeUrl}
                      target="_blank"
                      rel="noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="inline-flex items-center rounded-lg bg-white text-red-700 px-3 py-1.5 text-xs font-bold hover:bg-red-50"
                    >
                      Waze
                    </a>
                  )}

                  <button
                    type="button"
                    onClick={() => openMapNow(alertMeta)}
                    className="inline-flex items-center rounded-lg bg-white text-red-700 px-3 py-1.5 text-xs font-bold hover:bg-red-50"
                  >
                    Abrir mapa ahora
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}