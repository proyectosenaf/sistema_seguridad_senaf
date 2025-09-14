import { Joi, Segments, celebrate } from 'celebrate';


const base = {
tipo: Joi.string().valid('entrada','salida').required(),
persona: Joi.string().min(2).required(),
credencialId: Joi.string().allow('', null),
area: Joi.string().allow('', null),
hora: Joi.date().optional(),
autorizado: Joi.boolean().optional(),
por: Joi.string().allow('', null),
};


export const createAcceso = celebrate({ [Segments.BODY]: Joi.object({ ...base }) });
export const updateAcceso = celebrate({ [Segments.BODY]: Joi.object({ ...base }).min(1) });