import { celebrate, Joi, Segments } from "celebrate";

export const listVisitas = celebrate({
  [Segments.QUERY]: Joi.object({
    q: Joi.string().allow("").optional(),
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(500).default(100),
    estado: Joi.string().valid("en_curso","finalizada").optional(),
  }),
});

export const createVisita = celebrate({
  [Segments.BODY]: Joi.object({
    nombre: Joi.string().min(2).required(),
    documento: Joi.string().min(2).required(),
    empresa: Joi.string().allow("", null),
    motivo: Joi.string().allow("", null),
    anfitrion: Joi.string().allow("", null),
    estado: Joi.string().valid("en_curso","finalizada").optional(),
    horaEntrada: Joi.date().optional(),
    horaSalida: Joi.date().optional(),
  }),
});

export const updateVisita = celebrate({
  [Segments.BODY]: Joi.object({
    nombre: Joi.string().min(2),
    documento: Joi.string().min(2),
    empresa: Joi.string().allow("", null),
    motivo: Joi.string().allow("", null),
    anfitrion: Joi.string().allow("", null),
    estado: Joi.string().valid("en_curso","finalizada"),
    horaEntrada: Joi.date(),
    horaSalida: Joi.date(),
  }).min(1),
});
