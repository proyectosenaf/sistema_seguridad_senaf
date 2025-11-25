// server/modules/supervision/supervision.routes.js
import { Router } from "express";
import {
  crearSupervision,
  listarSupervisiones,
} from "./supervision.controller.js";

const router = Router();

/**
 * POST /api/supervision
 * body: { limpiezaAreaTrabajo, herramientasAMano, vestimentaAdecuada, observacion, personaId?, personaNombre?, sitio? }
 */
router.post("/", crearSupervision);

/**
 * GET /api/supervision?personaId=&desde=&hasta=&limit=
 */
router.get("/", listarSupervisiones);

export default router;
