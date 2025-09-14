import { Joi, Segments, celebrate } from 'celebrate';


const base = {
guardia: Joi.string().min(3).required(),
inicio: Joi.date().required(),
fin: Joi.date().optional(),
ruta: Joi.array().items(Joi.object({ nombre: Joi.string().required(), checkpointId: Joi.string().allow('', null), hora: Joi.date().optional() })).optional(),
incidencias: Joi.array().items(Joi.string()).optional(),
estado: Joi.string().valid('programada','en_curso','completada','cancelada').default('programada'),
};


export const createRonda = celebrate({ [Segments.BODY]: Joi.object({ ...base }) });
export const updateRonda = celebrate({ [Segments.BODY]: Joi.object({ ...base }).min(1) });