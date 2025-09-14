import { Joi, Segments, celebrate } from 'celebrate';


const base = {
nombre: Joi.string().min(3).required(),
descripcion: Joi.string().allow('', null),
tipo: Joi.string().valid('incidentes','accesos','visitas','rondas','bitacora','evaluacion','otro').default('otro'),
rango: Joi.object({ desde: Joi.date(), hasta: Joi.date() }).optional(),
filtros: Joi.object().unknown(true).optional(),
generadoPor: Joi.string().allow('', null),
};


export const createReporte = celebrate({ [Segments.BODY]: Joi.object({ ...base }) });
export const updateReporte = celebrate({ [Segments.BODY]: Joi.object({ ...base }).min(1) });