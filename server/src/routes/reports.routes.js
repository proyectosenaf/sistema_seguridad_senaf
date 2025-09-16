// src/routes/reports.routes.js
import { Router } from "express";
import { celebrate, Joi, Segments } from "celebrate";
import { slaSummary, slaExcel, slaPdf } from "../controllers/reports.controller.js";

// Validación de query: from/to ISO, routeId opcional (ObjectId)
const qv = celebrate({
  [Segments.QUERY]: Joi.object({
    from: Joi.date().iso().required(),
    to:   Joi.date().iso().required(),
    routeId: Joi.string().hex().length(24).optional(),
  }),
});

const router = Router();

// SLA: JSON, Excel, PDF
router.get("/sla",      qv, slaSummary);
router.get("/sla.xlsx", qv, slaExcel);
router.get("/sla.pdf",  qv, slaPdf);

export default router;
