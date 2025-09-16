// src/routes/index.js
import { Router } from "express";
import notifications from "./notifications.routes.js";

import routesAdmin from "./routes.admin.routes.js";   // Admin real (usa models/Route.js)
import reports     from "./reports.routes.js";

import incidentes  from "./incidentes.routes.js";
import visitas     from "./visitas.routes.js";
import rondas      from "./rondas.routes.js";
import accesos     from "./accesos.routes.js";
import bitacora    from "./bitacora.routes.js";
import evaluacion  from "./evaluacion.routes.js";
// ⚠️ Quitamos el import de "./reportes.routes.js" para evitar ERR_MODULE_NOT_FOUND
import chat        from "./chat.routes.js";
import supervision from "./supervision.routes.js";
import search      from "./search.routes.js";
import geo         from "./geo.routes.js";

// NUEVO
import plantillas  from "./plantillas.routes.js";
import sedes       from "./sedes.routes.js";

const api = Router();

// Básicas
api.get("/", (_req, res) => res.json({ ok: true, name: "SENAF API", version: "v1" }));
api.get("/health", (_req, res) => {
  res.set("Cache-Control", "no-store");
  res.status(200).json({ ok: true });
});

// Negocio
api.use("/chat",        chat);
api.use("/geo",         geo);
api.use("/search",      search);
api.use("/notifications", notifications);

api.use("/incidentes",  incidentes);
api.use("/visitas",     visitas);
api.use("/rondas",      rondas);
api.use("/accesos",     accesos);
api.use("/bitacora",    bitacora);
api.use("/supervision", supervision);
api.use("/evaluacion",  evaluacion);

// ⚠️ Si NO tienes archivo ./reportes.routes.js, no montes /reportes.
// api.use("/reportes",    reportesEs);  // <- dejar comentado/no usar

// Admin de rutas + reportes avanzados
api.use("/routes",            routesAdmin);   // usa checkpoints con {code, name, ...}
api.use("/reports-advanced",  reports);

// Nuevos
api.use("/plantillas",  plantillas);
api.use("/sedes",       sedes);

export default api;
