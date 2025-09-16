// src/routes/routes.admin.routes.js
import { Router } from "express";
import { celebrate, Joi, Segments } from "celebrate";
import { RoutesController } from "../controllers/routes.controller.js";

// --- Validadores coherentes con src/models/Route.js ---
const checkpointJoi = Joi.object({
  code: Joi.string().max(120).required(),
  name: Joi.string().min(3).required(),
  order: Joi.number().integer().min(0).required(),

  allowedMethods: Joi.array()
    .items(Joi.string().valid("qr","nfc","finger"))
    .default([]),

  geofence: Joi.object({
    type: Joi.string().valid("circle","polygon"),
    center: Joi.object({ lat: Joi.number(), lng: Joi.number() }),
    radiusMeters: Joi.number().min(1),
    points: Joi.array().items(Joi.object({ lat: Joi.number(), lng: Joi.number() }))
  }).optional(),

  expectedSecondsFromStart: Joi.number().integer().min(0).default(0),
  graceSeconds: Joi.number().integer().min(0).max(600).default(120),

  requirePhoto: Joi.boolean().default(false),
  requireNote: Joi.boolean().default(false),

  tags: Joi.array().items(Joi.string()).default([])
});

const routeCreateJoi = Joi.object({
  siteId: Joi.string().optional(),
  name: Joi.string().min(3).required(),
  code: Joi.string().optional(),               // único si lo usas
  active: Joi.boolean().default(true),
  sla: Joi.object({
    lateThresholdSeconds: Joi.number().integer().min(0).default(180),
    missingThresholdSeconds: Joi.number().integer().min(0).default(600)
  }).default(),
  windows: Joi.array().items(Joi.object({
    dow: Joi.array().items(Joi.number().integer().min(0).max(6)).default([]),
    start: Joi.string().optional(),
    end: Joi.string().optional()
  })).default([]),
  checkpoints: Joi.array().items(checkpointJoi).min(1).required()
});

const routeUpdateJoi = Joi.object({
  name: Joi.string().min(3).optional(),
  code: Joi.string().optional(),
  active: Joi.boolean().optional(),
  sla: Joi.object({
    lateThresholdSeconds: Joi.number().integer().min(0),
    missingThresholdSeconds: Joi.number().integer().min(0)
  }).optional(),
  windows: Joi.array().items(Joi.object({
    dow: Joi.array().items(Joi.number().integer().min(0).max(6)).default([]),
    start: Joi.string().optional(),
    end: Joi.string().optional()
  })).optional(),
  checkpoints: Joi.array().items(checkpointJoi).min(1).optional()
});

const upsertCheckpointJoi = checkpointJoi; // mismo esquema para upsert

const router = Router();

// Lista / Detalle
router.get("/", RoutesController.list);
router.get("/:id", RoutesController.get);

// Crear / Actualizar / Eliminar ruta
router.post("/", celebrate({ [Segments.BODY]: routeCreateJoi }), RoutesController.create);
router.patch("/:id", celebrate({ [Segments.BODY]: routeUpdateJoi }), RoutesController.update);
router.delete("/:id", RoutesController.remove);

// Checkpoints de una ruta (upsert / delete)
router.put(
  "/:id/checkpoints",
  celebrate({ [Segments.BODY]: upsertCheckpointJoi }),
  RoutesController.upsertCheckpoint
);

router.delete(
  "/:id/checkpoints",
  celebrate({ [Segments.QUERY]: Joi.object({ code: Joi.string().required() }) }),
  RoutesController.deleteCheckpoint
);

export default router;
