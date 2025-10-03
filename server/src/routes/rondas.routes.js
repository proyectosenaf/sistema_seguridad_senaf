// src/routes/rondas.routes.js
import { Router } from "express";
import { celebrate, Joi, Segments } from "celebrate";
import { RondasController } from "../controllers/rondas.controller.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

// 🔒 Todas las rutas de Rondas requieren Auth
router.use(requireAuth);

/**
 * GET /api/rondas/routes?siteId=...
 * Lista rutas activas (opcional: por site)
 */
router.get(
  "/routes",
  celebrate({
    [Segments.QUERY]: Joi.object({
      siteId: Joi.string().optional(),
    }),
  }),
  RondasController.listRoutes
);

/**
 * GET /api/rondas/active
 * Lista shifts activos
 */
router.get("/active", RondasController.activeShifts);

/**
 * POST /api/rondas/shifts/start
 * Iniciar una ronda
 * body: { routeId, guardExternalId, deviceId?, appVersion? }
 */
router.post(
  "/shifts/start",
  celebrate({
    [Segments.BODY]: Joi.object({
      routeId: Joi.string().required(),
      guardExternalId: Joi.string().required(),
      deviceId: Joi.string().allow(null, "").optional(),
      appVersion: Joi.string().allow(null, "").optional(),
    }),
  }),
  RondasController.startShift
);

/**
 * POST /api/rondas/shifts/:id/check
 * Registrar un checkpoint en un shift ACTIVO
 * body: { cpCode, method?, gps?, notes?, photos?, rawPayload?, clientAt?, device? }
 */
router.post(
  "/shifts/:id/check",
  celebrate({
    [Segments.PARAMS]: Joi.object({ id: Joi.string().required() }),
    [Segments.BODY]: Joi.object({
      cpCode: Joi.string().required(),
      method: Joi.string().valid("qr", "nfc", "finger", "manual").optional(),
      gps: Joi.object({
        lat: Joi.number().required(),
        lng: Joi.number().required(),
        accuracy: Joi.number().min(0).optional(),
      }).optional(),
      notes: Joi.string().allow("", null).optional(),
      photos: Joi.array()
        .items(Joi.object({ url: Joi.string().uri().required(), caption: Joi.string().optional() }))
        .optional(),
      rawPayload: Joi.string().allow("", null).optional(),
      clientAt: Joi.date().optional(),
      device: Joi.object({
        deviceId: Joi.string().allow("", null).optional(),
        appVersion: Joi.string().allow("", null).optional(),
        platform: Joi.string().allow("", null).optional(),
        userAgent: Joi.string().allow("", null).optional(),
        ip: Joi.string().allow("", null).optional(),
      }).optional(),
    }),
  }),
  RondasController.check
);

/**
 * POST /api/rondas/shifts/:id/finish
 * Finalizar una ronda
 * body: { reason?, endedByUserId? }
 */
router.post(
  "/shifts/:id/finish",
  celebrate({
    [Segments.PARAMS]: Joi.object({ id: Joi.string().required() }),
    [Segments.BODY]: Joi.object({
      reason: Joi.string().allow("", null).optional(),
      endedByUserId: Joi.string().allow("", null).optional(),
    }).optional(),
  }),
  RondasController.finishShift
);

// ----------------------------- QR de checkpoint ------------------------------

/**
 * GET /api/rondas/qr/checkpoint?routeId=...&code=...&fmt=svg|png&download=0|1&label=0|1
 */
router.get(
  "/qr/checkpoint",
  celebrate({
    [Segments.QUERY]: Joi.object({
      routeId: Joi.string().required(),
      code: Joi.string().required(),
      fmt: Joi.string().valid("svg", "png").default("svg"),
      download: Joi.string().valid("0", "1").default("0"),
      label: Joi.string().valid("0", "1").default("0"),
    }),
  }),
  RondasController.qrCheckpoint
);

// ----------------------------- Asignaciones ---------------------------------

/**
 * GET /api/rondas/assignments?guardId=&active=
 */
router.get(
  "/assignments",
  celebrate({
    [Segments.QUERY]: Joi.object({
      guardId: Joi.string().optional(),
      active: Joi.boolean().optional(),
    }),
  }),
  RondasController.listAssignments
);

/**
 * POST /api/rondas/assignments
 * Crear asignación
 */
router.post(
  "/assignments",
  celebrate({
    [Segments.BODY]: Joi.object({
      routeId: Joi.string().required(),
      guardExternalId: Joi.string().required(),
      active: Joi.boolean().optional(),
      daysOfWeek: Joi.array().items(Joi.number().min(0).max(6)).optional(),
      startTime: Joi.string().pattern(/^\d{2}:\d{2}$/).optional(),
      endTime: Joi.string().pattern(/^\d{2}:\d{2}$/).optional(),
      frequencyMinutes: Joi.number().min(0).optional(),
      activeFrom: Joi.date().optional(),
      activeTo: Joi.date().optional(),
      skipDates: Joi.array().items(Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/)).optional(),
      overrideDates: Joi.array()
        .items(
          Joi.object({
            date: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).required(),
            startTime: Joi.string().pattern(/^\d{2}:\d{2}$/).optional(),
            endTime: Joi.string().pattern(/^\d{2}:\d{2}$/).optional(),
          })
        )
        .optional(),
      timezone: Joi.string().optional(),
      notes: Joi.string().allow("", null).optional(),
    }),
  }),
  RondasController.createAssignment
);

/**
 * PATCH /api/rondas/assignments/:id
 * Actualizar asignación
 */
router.patch(
  "/assignments/:id",
  celebrate({
    [Segments.PARAMS]: Joi.object({ id: Joi.string().required() }),
    [Segments.BODY]: Joi.object({
      active: Joi.boolean().optional(),
      guardId: Joi.string().optional(), // por si re-asignas a otro guard
      daysOfWeek: Joi.array().items(Joi.number().min(0).max(6)).optional(),
      startTime: Joi.string().pattern(/^\d{2}:\d{2}$/).optional(),
      endTime: Joi.string().pattern(/^\d{2}:\d{2}$/).optional(),
      frequencyMinutes: Joi.number().min(0).optional(),
      activeFrom: Joi.date().allow(null).optional(),
      activeTo: Joi.date().allow(null).optional(),
      skipDates: Joi.array().items(Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/)).optional(),
      overrideDates: Joi.array()
        .items(
          Joi.object({
            date: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).required(),
            startTime: Joi.string().pattern(/^\d{2}:\d{2}$/).optional(),
            endTime: Joi.string().pattern(/^\d{2}:\d{2}$/).optional(),
          })
        )
        .optional(),
      timezone: Joi.string().optional(),
      notes: Joi.string().allow("", null).optional(),
    }).min(1),
  }),
  RondasController.updateAssignment
);

/**
 * DELETE /api/rondas/assignments/:id
 */
router.delete(
  "/assignments/:id",
  celebrate({
    [Segments.PARAMS]: Joi.object({ id: Joi.string().required() }),
  }),
  RondasController.deleteAssignment
);

export default router;
