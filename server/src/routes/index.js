// src/routes/index.js
import { Router } from "express";

// Importa todos los sub-routers
import notifications from "./notifications.routes.js";
import incidentes from "./incidentes.routes.js";
import chat from "./chat.routes.js";
import rondas from "./rondas.routes.js";

import routesAdmin from "./routes.admin.routes.js";
import reports from "./reports.routes.js";
import visitas from "./visitas.routes.js";
import accesos from "./accesos.routes.js";
import bitacora from "./bitacora.routes.js";
import evaluacion from "./evaluacion.routes.js";
import supervision from "./supervision.routes.js";
import search from "./search.routes.js";
import geo from "./geo.routes.js";
import plantillas from "./plantillas.routes.js";
import sedes from "./sedes.routes.js";
import sites from "./sites.routes.js";
import guards from "./guards.routes.js";

const api = Router();

/**
 * === Núcleo del sistema (usado por tu frontend directamente) ===
 * Estos prefijos eliminan los 404 que veías en React.
 */
api.use("/notifications", notifications); // /api/notifications/counts
api.use("/incidentes", incidentes);       // /api/incidentes?limit=100
api.use("/chat", chat);                   // /api/chat/messages
api.use("/rondas", rondas);               // /api/rondas/...

/**
 * === Módulos extendidos (backoffice / administración) ===
 * Puedes ordenarlos alfabéticamente para fácil mantenimiento.
 */
api.use("/accesos", accesos);
api.use("/bitacora", bitacora);
api.use("/evaluacion", evaluacion);
api.use("/geo", geo);
api.use("/guards", guards);
api.use("/plantillas", plantillas);
api.use("/reports-advanced", reports);
api.use("/routes", routesAdmin);
api.use("/search", search);
api.use("/sedes", sedes);
api.use("/sites", sites);
api.use("/supervision", supervision);
api.use("/visitas", visitas);

/**
 * Fallback 404 para rutas no definidas en /api/*
 * (celebrateErrors y errorHandler ya se aplican en server.js)
 */
api.use((_req, res) => {
  res.status(404).json({ error: "Ruta de API no encontrada" });
});

export default api;
