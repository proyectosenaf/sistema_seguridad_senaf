// src/modules/rondasqr/utils/panicBus.js

const PANIC_EVENT = "rondasqr:panic";
const PANIC_CHANNEL = "rondasqr-panic";

function safeNow() {
  return Date.now();
}

function asText(v) {
  return String(v || "").trim();
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

function normalizePanicPayload(payload = {}) {
  const guard =
    payload?.guard && typeof payload.guard === "object" ? payload.guard : {};
  const gps =
    payload?.gps && typeof payload.gps === "object"
      ? payload.gps
      : payload?.location && typeof payload.location === "object"
      ? payload.location
      : {};
  const links =
    payload?.links && typeof payload.links === "object"
      ? payload.links
      : payload?.location && typeof payload.location === "object"
      ? payload.location
      : {};

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

  const title =
    asText(payload?.title) ||
    (asText(payload?.kind).toLowerCase() === "panic"
      ? "🚨 Alerta de pánico"
      : "") ||
    "🚨 Alerta de pánico";

  const message =
    asText(payload?.message) ||
    asText(payload?.body) ||
    asText(payload?.incidentText) ||
    "Se activó el botón de pánico";

  const user =
    asText(payload?.user) ||
    asText(payload?.guardName) ||
    asText(guard?.name) ||
    asText(payload?.guardEmail) ||
    asText(guard?.email) ||
    "";

  return {
    at: payload?.at || safeNow(),
    emittedAt: payload?.emittedAt || new Date().toISOString(),
    kind: asText(payload?.kind) || "panic",
    type: asText(payload?.type) || "panic",
    source: asText(payload?.source) || "unknown",
    title,
    message,
    body: asText(payload?.body) || message,
    incidentText: asText(payload?.incidentText) || message,
    user,
    guard: {
      id: asText(payload?.guardId) || asText(guard?.id) || null,
      name: asText(payload?.guardName) || asText(guard?.name) || "",
      email: asText(payload?.guardEmail) || asText(guard?.email) || "",
      role: asText(guard?.role) || "",
    },
    guardId: asText(payload?.guardId) || asText(guard?.id) || null,
    guardName: asText(payload?.guardName) || asText(guard?.name) || "",
    guardEmail: asText(payload?.guardEmail) || asText(guard?.email) || "",
    gps:
      lat != null && lon != null
        ? {
            lat,
            lon,
            accuracy: numberOrNull(gps?.accuracy),
            altitude: numberOrNull(gps?.altitude),
            heading: numberOrNull(gps?.heading),
            speed: numberOrNull(gps?.speed),
            capturedAt:
              asText(gps?.capturedAt) || payload?.emittedAt || new Date().toISOString(),
            source: asText(gps?.source) || "panic-bus",
            coordsText:
              asText(gps?.coordsText) || fallbackLinks.coordsText || "",
          }
        : null,
    location:
      lat != null && lon != null
        ? {
            lat,
            lon,
            accuracy: numberOrNull(gps?.accuracy),
            coordsText:
              asText(links?.coordsText) ||
              asText(gps?.coordsText) ||
              fallbackLinks.coordsText ||
              "",
            googleMapsUrl:
              asText(links?.googleMapsUrl) ||
              asText(payload?.googleMapsUrl) ||
              fallbackLinks.googleMapsUrl ||
              "",
            wazeUrl:
              asText(links?.wazeUrl) ||
              asText(payload?.wazeUrl) ||
              fallbackLinks.wazeUrl ||
              "",
            capturedAt:
              asText(gps?.capturedAt) || payload?.emittedAt || new Date().toISOString(),
          }
        : null,
    links: {
      googleMapsUrl:
        asText(links?.googleMapsUrl) ||
        asText(payload?.googleMapsUrl) ||
        fallbackLinks.googleMapsUrl ||
        "",
      wazeUrl:
        asText(links?.wazeUrl) ||
        asText(payload?.wazeUrl) ||
        fallbackLinks.wazeUrl ||
        "",
    },
    raw: payload,
  };
}

/**
 * Dispara un evento local de pánico.
 * Se propaga a todas las pestañas/componentes abiertos.
 * @param {object} payload - Datos adicionales (usuario, origen, mensaje, etc.)
 */
export function emitLocalPanic(payload = {}) {
  if (typeof window === "undefined") return;

  const detail = normalizePanicPayload(payload);

  try {
    const event = new CustomEvent(PANIC_EVENT, { detail });
    window.dispatchEvent(event);

    if (typeof BroadcastChannel !== "undefined") {
      const ch = new BroadcastChannel(PANIC_CHANNEL);
      ch.postMessage(detail);
      ch.close();
    }
  } catch (err) {
    console.error("[panicBus] Error al emitir pánico:", err);
  }
}

/**
 * Suscripción a eventos de pánico locales o inter-pestaña.
 * Retorna una función para cancelar la suscripción.
 */
export function subscribeLocalPanic(handler) {
  if (typeof window === "undefined" || typeof handler !== "function") {
    return () => {};
  }

  const onWindowPanic = (ev) => {
    try {
      handler(normalizePanicPayload(ev?.detail || {}));
    } catch (err) {
      console.error("[panicBus] handler local error:", err);
    }
  };

  window.addEventListener(PANIC_EVENT, onWindowPanic);

  let ch = null;
  if (typeof BroadcastChannel !== "undefined") {
    ch = new BroadcastChannel(PANIC_CHANNEL);
    ch.onmessage = (msg) => {
      try {
        handler(normalizePanicPayload(msg?.data || {}));
      } catch (err) {
        console.error("[panicBus] handler channel error:", err);
      }
    };
  }

  return () => {
    window.removeEventListener(PANIC_EVENT, onWindowPanic);
    if (ch) {
      try {
        ch.close();
      } catch {}
    }
  };
}