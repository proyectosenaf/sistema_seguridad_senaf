// src/modules/rondasqr/utils/panicBus.js

// dispara un evento local para todas las pestañas/componentes
export function emitLocalPanic(payload = {}) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent("rondasqr:panic", {
      detail: {
        at: Date.now(),
        ...payload,
      },
    })
  );
}

// permite suscribirse fácil
export function subscribeLocalPanic(handler) {
  if (typeof window === "undefined") return () => {};
  const fn = (ev) => handler(ev.detail || {});
  window.addEventListener("rondasqr:panic", fn);
  return () => window.removeEventListener("rondasqr:panic", fn);
}
