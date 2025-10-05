// modules/rondas/routes/index.js
import { Router } from "express";

import zones from "./zones.routes.js";
import cps from "./checkpoints.routes.js";
import shifts from "./shifts.routes.js";
import scans from "./scans.routes.js";
import reports from "./reports.routes.js";
import plans from "./plans.routes.js";
import incidents from "./incidents.routes.js"; // ⬅️ NUEVO

const api = Router();

// Orden lógico por dominio
api.use("/zones", zones);
api.use("/checkpoints", cps);
api.use("/shifts", shifts);
api.use("/scans", scans);
api.use("/reports", reports);
api.use("/plans", plans);
api.use("/incidents", incidents); // ⬅️ NUEVO

// Opcional: ping del módulo
api.get("/__ping", (_req, res) => res.json({ ok: true, mod: "rondas" }));

// Opcional: 404 dentro del módulo
api.use((_req, res) => res.status(404).json({ ok: false, error: "rondas:not_found" }));

export default api;
