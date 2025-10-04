import api from "./routes/index.js";
import { initAlerts } from "./services/alert.service.js";

export function registerRondasModule({ app, io, basePath = "/api/rondas/v1" }) {
  // habilita emitir eventos desde los controllers
  initAlerts(io);

  app.use(basePath, api);
  console.log(`[rondas] montado en ${basePath}`);
}

export default {};
