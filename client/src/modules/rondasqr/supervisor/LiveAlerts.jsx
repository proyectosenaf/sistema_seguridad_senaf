// src/modules/rondasqr/supervisor/LiveAlerts.jsx
import React from "react";
import { socket } from "../../../lib/socket.js";

function classNames(...xs) {
  return xs.filter(Boolean).join(" ");
}

function badgeClasses(type) {
  const t = String(type || "").toLowerCase();
  switch (t) {
    case "panic":
      return "bg-red-100 text-red-800 border-red-200 dark:bg-red-600/20 dark:text-red-200 dark:border-red-500/40";
    case "fall":
      return "bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-600/20 dark:text-orange-200 dark:border-orange-500/40";
    case "inactivity":
    case "immobility":
      return "bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-600/20 dark:text-yellow-100 dark:border-yellow-500/40";
    case "noncompliance":
      return "bg-fuchsia-100 text-fuchsia-800 border-fuchsia-200 dark:bg-fuchsia-600/20 dark:text-fuchsia-200 dark:border-fuchsia-500/40";
    case "incident":
    case "custom":
    default:
      return "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-600/20 dark:text-slate-200 dark:border-slate-500/40";
  }
}

function asText(v) {
  return String(v || "").trim();
}

function numberOrNull(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function pickFirstText(...values) {
  for (const v of values) {
    const s = asText(v);
    if (s) return s;
  }
  return "";
}

function buildFallbackLinks(lat, lon) {
  const nLat = numberOrNull(lat);
  const nLon = numberOrNull(lon);

  if (nLat == null || nLon == null) {
    return {
      coordsText: "",
      googleMapsUrl: "",
      wazeUrl: "",
    };
  }

  const coordsText = `${nLat}, ${nLon}`;
  return {
    coordsText,
    googleMapsUrl: `https://www.google.com/maps?q=${encodeURIComponent(coordsText)}`,
    wazeUrl: `https://waze.com/ul?ll=${encodeURIComponent(coordsText)}&navigate=yes`,
  };
}

function normalizeIncomingAlert(evt = {}) {
  const item = evt?.item && typeof evt.item === "object" ? evt.item : null;
  const guard = evt?.guard && typeof evt.guard === "object" ? evt.guard : {};
  const gps =
    evt?.gps && typeof evt.gps === "object"
      ? evt.gps
      : evt?.location && typeof evt.location === "object"
      ? evt.location
      : item?.gps && typeof item.gps === "object"
      ? item.gps
      : {};
  const location =
    evt?.location && typeof evt.location === "object" ? evt.location : {};
  const links =
    evt?.links && typeof evt.links === "object" ? evt.links : location;

  const lat = numberOrNull(
    gps?.lat ?? gps?.latitude ?? location?.lat ?? evt?.lat ?? evt?.latitude
  );
  const lon = numberOrNull(
    gps?.lon ??
      gps?.lng ??
      gps?.longitude ??
      location?.lon ??
      location?.lng ??
      evt?.lon ??
      evt?.lng ??
      evt?.longitude
  );

  const fallbackLinks = buildFallbackLinks(lat, lon);

  const type = pickFirstText(
    evt?.type,
    evt?.kind,
    item?.type,
    "incident"
  ).toLowerCase();

  const guardName = pickFirstText(
    evt?.guardName,
    guard?.name,
    evt?.officerName,
    item?.guardName,
    item?.officerName,
    evt?.user
  );

  const guardEmail = pickFirstText(
    evt?.guardEmail,
    guard?.email,
    evt?.officerEmail,
    item?.guardEmail,
    item?.officerEmail
  );

  const siteName = pickFirstText(evt?.siteName, item?.siteName);

  const roundName = pickFirstText(evt?.roundName, item?.roundName);

  const pointName = pickFirstText(
    evt?.pointName,
    item?.pointName,
    item?.qr,
    evt?.qr
  );

  const text = pickFirstText(
    evt?.text,
    evt?.message,
    evt?.body,
    evt?.incidentText,
    item?.text,
    item?.message,
    item?.body,
    item?.incidentText
  );

  const accuracyRaw =
    gps?.accuracy ?? location?.accuracy ?? evt?.accuracy ?? item?.accuracy;
  const accuracy =
    accuracyRaw == null || accuracyRaw === "" || !Number.isFinite(Number(accuracyRaw))
      ? ""
      : `${Number(accuracyRaw).toFixed(0)} m`;

  const when =
    evt?.at ||
    evt?.ts ||
    evt?.emittedAt ||
    item?.at ||
    item?.createdAt ||
    Date.now();

  return {
    raw: evt,
    _id: evt?._id || item?._id || item?.id || "",
    type,
    title: pickFirstText(
      evt?.title,
      type === "panic" ? "🚨 Alerta de pánico" : "",
      "ALERTA"
    ),
    text,
    siteName,
    roundName,
    pointName,
    guardName,
    guardEmail,
    who: guardName || guardEmail || "—",
    lat,
    lon,
    gpsOk: lat != null && lon != null,
    coordsText: pickFirstText(
      location?.coordsText,
      gps?.coordsText,
      evt?.coordsText,
      fallbackLinks.coordsText
    ),
    googleMapsUrl: pickFirstText(
      links?.googleMapsUrl,
      location?.googleMapsUrl,
      evt?.googleMapsUrl,
      fallbackLinks.googleMapsUrl
    ),
    wazeUrl: pickFirstText(
      links?.wazeUrl,
      location?.wazeUrl,
      evt?.wazeUrl,
      fallbackLinks.wazeUrl
    ),
    accuracy,
    stepsAtAlert: evt?.stepsAtAlert ?? item?.stepsAtAlert ?? null,
    durationMin: evt?.durationMin ?? item?.durationMin ?? null,
    at: when,
    __k: [
      evt?._id || item?._id || item?.id || "",
      when,
      type,
      text,
      guardName,
      lat,
      lon,
    ].join("::"),
  };
}

export default function LiveAlerts() {
  const [events, setEvents] = React.useState([]);
  const [status, setStatus] = React.useState("connecting");
  const [autoScroll, setAutoScroll] = React.useState(true);
  const bottomRef = React.useRef(null);

  React.useEffect(() => {
    if (autoScroll && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: "smooth", block: "end" });
    }
  }, [events, autoScroll]);

  React.useEffect(() => {
    if (!socket) {
      setStatus("disconnected");
      return;
    }

    setStatus(socket.connected ? "connected" : "connecting");

    const onConnect = () => setStatus("connected");
    const onDisconnect = () => setStatus("disconnected");
    const onConnectError = () => setStatus("disconnected");
    const onReconnecting = () => setStatus("connecting");

    const pushEvent = (evt) => {
      const normalized = normalizeIncomingAlert(evt);

      setEvents((prev) => {
        if (prev.some((x) => x.__k === normalized.__k)) return prev;
        return [normalized, ...prev].slice(0, 200);
      });
    };

    const onIncident = (evt = {}) => {
      pushEvent(evt);
    };

    const onAlert = (evt = {}) => {
      pushEvent(evt);
    };

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("connect_error", onConnectError);

    socket.io?.on?.("reconnect_attempt", onReconnecting);
    socket.io?.on?.("reconnect", onConnect);

    socket.on("rondasqr:incident", onIncident);
    socket.on("panic:new", onAlert);
    socket.on("alerta:nueva", onAlert);
    socket.on("rondasqr:alert", onAlert);

    return () => {
      try {
        socket.off("connect", onConnect);
        socket.off("disconnect", onDisconnect);
        socket.off("connect_error", onConnectError);

        socket.off("rondasqr:incident", onIncident);
        socket.off("panic:new", onAlert);
        socket.off("alerta:nueva", onAlert);
        socket.off("rondasqr:alert", onAlert);

        socket.io?.off?.("reconnect_attempt", onReconnecting);
        socket.io?.off?.("reconnect", onConnect);
      } catch {}
    };
  }, []);

  const renderItem = (e, i) => {
    const when = e?.at ? new Date(e.at) : new Date();
    const whenText = Number.isNaN(when.getTime()) ? "—" : when.toLocaleString();

    return (
      <li
        key={e.__k || i}
        className="rounded-lg px-3 py-2 border border-black/10 bg-slate-50 dark:bg-black/30 dark:border-white/10"
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className={classNames(
                "text-[11px] px-2 py-0.5 rounded border",
                badgeClasses(e?.type || "incident")
              )}
              title="Tipo de alerta"
            >
              {String(e?.type || "incident").toUpperCase()}
            </span>
            <span className="text-xs text-slate-500 dark:text-white/70">{whenText}</span>
          </div>

          <div className="text-xs text-slate-500 dark:text-white/70 text-right">
            {e?.siteName ? <span className="mr-2">🏢 {e.siteName}</span> : null}
            {e?.roundName ? <span className="mr-2">🔁 {e.roundName}</span> : null}
            {e?.who ? <span>👤 {e.who}</span> : null}
          </div>
        </div>

        {!!e?.title && (
          <div className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">
            {e.title}
          </div>
        )}

        {!!e?.text && (
          <div className="mt-1 text-sm leading-snug whitespace-pre-wrap text-slate-800 dark:text-white/90">
            {e.text}
          </div>
        )}

        <div className="mt-1 text-xs flex flex-wrap gap-3 text-slate-500 dark:text-white/70">
          {e?.gpsOk ? (
            <>
              <span>📍 {e.coordsText || `${e.lat}, ${e.lon}`}</span>

              {!!e?.googleMapsUrl && (
                <a
                  href={e.googleMapsUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="underline hover:text-slate-900 dark:hover:text-white"
                  title="Ver en Google Maps"
                >
                  Google Maps
                </a>
              )}

              {!!e?.wazeUrl && (
                <a
                  href={e.wazeUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="underline hover:text-slate-900 dark:hover:text-white"
                  title="Abrir en Waze"
                >
                  Waze
                </a>
              )}
            </>
          ) : (
            <span>📍 sin GPS</span>
          )}

          {!!e?.accuracy && <span>🎯 precisión: {e.accuracy}</span>}
          {!!e?.pointName && <span>📌 punto: {e.pointName}</span>}

          {typeof e?.stepsAtAlert === "number" ? (
            <span>👟 pasos: {e.stepsAtAlert}</span>
          ) : null}

          {typeof e?.durationMin === "number" ? (
            <span>⏱️ inactividad: {e.durationMin} min</span>
          ) : null}
        </div>
      </li>
    );
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div
          className={classNames(
            "inline-flex items-center gap-2 text-xs px-2.5 py-1 rounded border",
            status === "connected"
              ? "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-600/20 dark:text-emerald-200 dark:border-emerald-500/40"
              : status === "connecting"
              ? "bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-600/20 dark:text-yellow-100 dark:border-yellow-500/40"
              : "bg-red-100 text-red-700 border-red-200 dark:bg-red-600/20 dark:text-red-200 dark:border-red-500/40"
          )}
          title="Estado de conexión con el servidor en tiempo real"
        >
          <span
            className={classNames(
              "inline-block w-2 h-2 rounded-full",
              status === "connected"
                ? "bg-emerald-500 dark:bg-emerald-400"
                : status === "connecting"
                ? "bg-yellow-500 dark:bg-yellow-400"
                : "bg-red-500 dark:bg-red-400"
            )}
          />
          {status}
        </div>

        <label className="text-xs flex items-center gap-2 select-none cursor-pointer text-slate-600 dark:text-white/70">
          <input
            type="checkbox"
            className="accent-blue-500"
            checked={autoScroll}
            onChange={(e) => setAutoScroll(e.target.checked)}
          />
          Auto-scroll
        </label>
      </div>

      {!events.length ? (
        <div className="text-sm text-slate-500 dark:text-white/60">
          Sin alertas por ahora.
        </div>
      ) : (
        <div className="max-h-80 overflow-auto pr-1">
          <ul className="space-y-2">{events.map(renderItem)}</ul>
          <div ref={bottomRef} />
        </div>
      )}
    </div>
  );
}