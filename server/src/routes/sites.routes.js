// src/routes/sites.routes.js
import { Router } from 'express';
import Site from '../models/Site.js';

const router = Router();

// Ruta POST para crear un nuevo sitio
router.post('/', async (req, res) => {
    try {
        const newSite = new Site(req.body);
        await newSite.save();
        res.status(201).json(newSite);
    } catch (error) {
        console.error('Error al crear un nuevo sitio:', error);
        res.status(500).json({ error: 'Error interno del servidor al crear un sitio.' });
    }
});

// Ruta GET para obtener todos los sitios
router.get('/', async (_req, res) => {
    try {
        const sites = await Site.find({}).lean();
        res.json(sites);
    } catch (error) {
        console.error('Error al obtener los sitios:', error);
        res.status(500).json({ error: 'Error al cargar los sitios.' });
    }
});

export default router;