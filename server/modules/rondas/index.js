// modules/rondas/index.js
import api from "./routes/index.js";
import { initAlerts } from "./services/alert.service.js";
import { startMissedCheckCron } from "./jobs/missedChecker.js";

/**
 * Registra el módulo de Rondas en la app.
 * @param {Object} opts
 * @param {import('express').Express} opts.app
 * @param {import('socket.io').Server} [opts.io]
 * @param {string} [opts.basePath="/api/rondas/v1"]
 * @param {boolean} [opts.withCron=true]  // inicia el cron de "missed" salvo que esté apagado por env
 */
export function registerRondasModule({
  app,
  io,
  basePath = "/api/rondas/v1",
  withCron = true,
} = {}) {
  if (!app) throw new Error("[rondas] app (Express) es requerido");

  // Habilita emisión de alertas desde controladores
  if (io) initAlerts(io);

  // Monta las rutas del módulo
  app.use(basePath, api);
  console.log(`[rondas] montado en ${basePath}`);

  // Cron de verificación de "missed" (puedes desactivarlo con RONDAS_MISSED_CRON=off)
  if (withCron && process.env.RONDAS_MISSED_CRON !== "off") {
    const expr = process.env.RONDAS_MISSED_CRON || "*/2 * * * *";
    startMissedCheckCron({ cron: expr, logger: console });
  }
}

export default { registerRondasModule };
