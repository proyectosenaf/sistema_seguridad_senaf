// server/modules/rondas/services/alert.service.js
let ioRef = null;

/** Llamado una sola vez al montar el módulo para inyectar el io del servidor */
export function initAlerts(io) {
  ioRef = io || null;
}

/** Emite un evento global por Socket.IO; si no hay io, no hace nada */
export function emitAlert(event, payload = {}) {
  try {
    if (ioRef) ioRef.emit(event, payload);
  } catch (e) {
    // evitamos que un fallo de IO rompa la API
    console.warn("[rondas][emitAlert] fallo al emitir:", e?.message || e);
  }
}

/** (opcional) obtener la referencia a io */
export function getIO() {
  return ioRef;
}
