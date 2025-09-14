import { Router } from 'express';
import { checkJwt } from '../middleware/auth.js';
import { idParam } from '../validators/common.js';
import { createReporte, updateReporte } from '../validators/reportes.js';
import * as ctrl from '../controllers/reportes.controller.js';


const r = Router();


r.use(checkJwt);


r.get('/', ctrl.list);
r.post('/', createReporte, ctrl.create);
r.get('/:id', ctrl.getById);
r.patch('/:id', idParam, updateReporte, ctrl.update);
r.delete('/:id', idParam, ctrl.remove);


export default r;