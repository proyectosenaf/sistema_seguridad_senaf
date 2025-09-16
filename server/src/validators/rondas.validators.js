// src/validators/rondas.validators.js
import { Joi, celebrate, Segments } from "celebrate";

export const startShiftValidator = celebrate({
  [Segments.BODY]: Joi.object({
    routeId: Joi.string().hex().length(24).required(),
    guardExternalId: Joi.string().required(),          // Auth0 sub / legajo
    deviceId: Joi.string().hex().length(24).optional(),
    appVersion: Joi.string().max(50).optional(),
  })
});

export const finishShiftValidator = celebrate({
  [Segments.PARAMS]: Joi.object({
    id: Joi.string().hex().length(24).required(),
  })
});

export const checkValidator = celebrate({
  [Segments.BODY]: Joi.object({
    shiftId: Joi.string().hex().length(24).required(),
    checkpointCode: Joi.string().max(120).required(),
    method: Joi.string().valid("qr","nfc","finger").required(),
    methodMeta: Joi.object().unknown(true).optional(),
    location: Joi.object({
      lat: Joi.number().min(-90).max(90),
      lng: Joi.number().min(-180).max(180),
      accuracy: Joi.number().min(0).max(500).optional(),
    }).optional(),
    evidences: Joi.array().items(Joi.object({
      type: Joi.string().valid("photo","audio","video","file","note").required(),
      url: Joi.string().uri().optional(),
      size: Joi.number().integer().min(0).optional(),
      mime: Joi.string().max(120).optional(),
      text: Joi.string().max(2000).optional(),
    })).max(10).optional(),
  })
});
