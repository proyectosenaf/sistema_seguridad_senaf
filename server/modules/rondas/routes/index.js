import { Router } from "express";
import zones from "./zones.routes.js";
import cps from "./checkpoints.routes.js";
import shifts from "./shifts.routes.js";
import scans from "./scans.routes.js";
import reports from "./reports.routes.js";
import plans from "./plans.routes.js";              // <— AÑADIR

const api = Router();
api.use("/zones", zones);
api.use("/checkpoints", cps);
api.use("/shifts", shifts);
api.use("/scans", scans);
api.use("/reports", reports);
api.use("/plans", plans);                           // <— AÑADIR
export default api;
