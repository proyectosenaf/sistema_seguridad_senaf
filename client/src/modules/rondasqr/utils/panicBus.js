// src/modules/rondasqr/utils/panicBus.js

const PANIC_EVENT = "rondasqr:panic";
const PANIC_CHANNEL = "rondasqr-panic";

/**
 * Dispara un evento local de pánico.
 * Se propaga a todas las pestañas/componentes abiertos.
 * @param {object} payload - Datos adicionales (usuario, origen, mensaje, etc.)
 */
export function emitLocalPanic(payload = {}) {
  if (typeof window === "undefined") return;

  const detail = {
    at: Date.now(),
    source: "unknown",
    ...payload,
  };

  try {
    const event = new CustomEvent(PANIC_EVENT, { detail });
    window.dispatchEvent(event);

    // BroadcastChannel permite notificar a otras pestañas
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
      handler(ev?.detail || {});
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
        handler(msg?.data || {});
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
