// src/validators/routes.validators.js
import { celebrate, Joi, Segments } from "celebrate";

export const createRouteValidator = celebrate({
  [Segments.BODY]: Joi.object({
    siteId: Joi.string().hex().length(24).required(),
    name: Joi.string().min(3).max(120).required(),
    code: Joi.string().alphanum().min(3).max(40).optional(),
    windows: Joi.array().items(Joi.object({
      dow: Joi.array().items(Joi.number().min(0).max(6)).default([1,2,3,4,5]),
      start: Joi.string().pattern(/^\d{2}:\d{2}$/).required(),
      end: Joi.string().pattern(/^\d{2}:\d{2}$/).required(),
    })).max(12).default([]),
    sla: Joi.object({
      lateThresholdSeconds: Joi.number().integer().min(0).default(180),
      missingThresholdSeconds: Joi.number().integer().min(0).default(600),
    }).default({}),
    checkpoints: Joi.array().items(Joi.object({
      code: Joi.string().max(120).required(),
      name: Joi.string().max(120).required(),
      order: Joi.number().integer().min(0).default(0),
      allowedMethods: Joi.array().items(Joi.string().valid("qr","nfc","finger")).default(["qr"]),
      expectedSecondsFromStart: Joi.number().integer().min(0).default(0),
      graceSeconds: Joi.number().integer().min(0).default(120),
      requirePhoto: Joi.boolean().default(false),
      requireNote: Joi.boolean().default(false),
      tags: Joi.array().items(Joi.string()).max(10).default([]),
    })).default([]),
    active: Joi.boolean().default(true),
  })
});

export const routeIdParam = celebrate({
  [Segments.PARAMS]: Joi.object({ id: Joi.string().hex().length(24).required() })
});

export const updateRouteValidator = celebrate({
  [Segments.BODY]: Joi.object({
    name: Joi.string().min(3).max(120).optional(),
    code: Joi.string().alphanum().min(3).max(40).allow(null, ""),
    windows: Joi.array().items(Joi.object({
      dow: Joi.array().items(Joi.number().min(0).max(6)),
      start: Joi.string().pattern(/^\d{2}:\d{2}$/),
      end: Joi.string().pattern(/^\d{2}:\d{2}$/),
    })).max(12),
    sla: Joi.object({
      lateThresholdSeconds: Joi.number().integer().min(0),
      missingThresholdSeconds: Joi.number().integer().min(0),
    }),
    active: Joi.boolean(),
  }).min(1)
});

export const upsertCheckpointValidator = celebrate({
  [Segments.PARAMS]: Joi.object({
    id: Joi.string().hex().length(24).required(),
    code: Joi.string().max(120).optional()
  }),
  [Segments.BODY]: Joi.object({
    code: Joi.string().max(120).required(),
    name: Joi.string().max(120).required(),
    order: Joi.number().integer().min(0).default(0),
    allowedMethods: Joi.array().items(Joi.string().valid("qr","nfc","finger")).default(["qr"]),
    expectedSecondsFromStart: Joi.number().integer().min(0).default(0),
    graceSeconds: Joi.number().integer().min(0).default(120),
    requirePhoto: Joi.boolean().default(false),
    requireNote: Joi.boolean().default(false),
    tags: Joi.array().items(Joi.string()).max(10).default([]),
  })
});
