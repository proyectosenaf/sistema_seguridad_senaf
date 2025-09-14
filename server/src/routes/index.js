// routes/index.js
import { Router } from 'express';
import incidentes from './incidentes.routes.js';
import visitas from './visitas.routes.js';
import rondas from './rondas.routes.js';
import accesos from './accesos.routes.js';
import bitacora from './bitacora.routes.js';
import evaluacion from './evaluacion.routes.js';
import reportes from './reportes.routes.js';
import chat from './chat.routes.js';
import supervision from './supervision.routes.js';
import search from './search.routes.js';
import geo from './geo.routes.js';

// ⬇️ NUEVO
import plantillas from './plantillas.routes.js';
import sedes from './sedes.routes.js';

const api = Router();

api.use('/chat', chat);
api.get('/health', (req, res) => res.json({ ok: true }));
api.use('/geo', geo);
api.use('/search', search);
api.use('/incidentes', incidentes);
api.use('/visitas', visitas);
api.use('/rondas', rondas);
api.use('/accesos', accesos);
api.use('/bitacora', bitacora);
api.use('/supervision', supervision);
api.use('/evaluacion', evaluacion);
api.use('/reportes', reportes);

// ⬇️ NUEVO
api.use('/plantillas', plantillas);
api.use('/sedes', sedes);

export default api;
