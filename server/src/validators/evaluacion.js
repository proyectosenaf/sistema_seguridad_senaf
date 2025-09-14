import { celebrate, Joi, Segments } from "celebrate";

export const listQuery = celebrate({
  [Segments.QUERY]: Joi.object({
    periodo: Joi.string().pattern(/^\d{4}-\d{2}$/).optional(),
    q: Joi.string().allow("", null),
    page: Joi.number().min(1).default(1),
    limit: Joi.number().min(1).max(5000).default(1000),
  }),
});

export const createEval = celebrate({
  [Segments.BODY]: Joi.object({
    empleado: Joi.string().min(2).required(),
    periodo: Joi.string().pattern(/^\d{4}-\d{2}$/).required(),
    puntuacion: Joi.number().min(0).max(100).required(),
    observaciones: Joi.string().allow("", null),
    fuente: Joi.string().valid("manual", "supervision").default("manual"),
  }),
});

export const updateEval = celebrate({
  [Segments.BODY]: Joi.object({
    empleado: Joi.string().min(2),
    periodo: Joi.string().pattern(/^\d{4}-\d{2}$/),
    puntuacion: Joi.number().min(0).max(100),
    observaciones: Joi.string().allow("", null),
    fuente: Joi.string().valid("manual", "supervision"),
  }).min(1),
});

export const syncBody = celebrate({
  [Segments.BODY]: Joi.object({
    periodo: Joi.string().pattern(/^\d{4}-\d{2}$/).required(),
  }),
});
// ⬇️ Alias para que tus rutas actuales sigan funcionando
export { listQuery as list, createEval as create, updateEval as update };   