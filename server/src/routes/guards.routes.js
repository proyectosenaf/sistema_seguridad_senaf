import { Router } from 'express';
import Guard from '../models/Guard.js';

const router = Router();

// Ruta POST para crear un nuevo guardia
router.post('/', async (req, res) => {
    try {
        const newGuard = new Guard(req.body);
        await newGuard.save();
        res.status(201).json(newGuard);
    } catch (error) {
        console.error('Error al crear un nuevo guardia:', error);
        res.status(500).json({ error: 'Error interno del servidor al crear un guardia.' });
    }
});

// Ruta GET para obtener todos los guardias
router.get('/', async (_req, res) => {
    try {
        const guards = await Guard.find({}).lean();
        res.json(guards);
    } catch (error) {
        console.error('Error al obtener los guardias:', error);
        res.status(500).json({ error: 'Error al cargar los guardias.' });
    }
});

export default router;