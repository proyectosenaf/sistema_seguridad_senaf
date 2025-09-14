import { Joi, Segments, celebrate } from 'celebrate';


const base = {
fecha: Joi.date().optional(),
autor: Joi.string().min(2).required(),
tipo: Joi.string().valid('nota','alerta','reporte').default('nota'),
contenido: Joi.string().min(3).required(),
adjuntos: Joi.array().items(Joi.object({ url: Joi.string().uri(), nombre: Joi.string() })).optional(),
};


export const createBitacora = celebrate({ [Segments.BODY]: Joi.object({ ...base }) });
export const updateBitacora = celebrate({ [Segments.BODY]: Joi.object({ ...base }).min(1) });