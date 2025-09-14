import { Joi, Segments, celebrate } from "celebrate";

export const listQuery = celebrate({
  [Segments.QUERY]: Joi.object({
    q: Joi.string().allow('').optional(),
    estado: Joi.string().valid('abierta','cerrada').optional(),
    page: Joi.number().min(1).default(1),
    limit: Joi.number().min(1).max(200).default(100),
  })
});

const base = {
  guardia: Joi.string().min(2).max(120),
  area: Joi.string().min(2).max(120),
  puntaje: Joi.number().min(0).max(100),
  observaciones: Joi.string().allow('', null),
  estado: Joi.string().valid('abierta','cerrada'),
  fecha: Joi.date()
};

export const createSupervision = celebrate({
  [Segments.BODY]: Joi.object({
    ...base,
    guardia: Joi.string().min(2).max(120).required(),
    area: Joi.string().min(2).max(120).required(),
  })
});

export const updateSupervision = celebrate({
  [Segments.BODY]: Joi.object(base).min(1)
});
// ⬇️ Aliases para que tus rutas actuales sigan funcionando
export { createSupervision as create, updateSupervision as update };    