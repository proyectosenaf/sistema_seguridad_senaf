import { Router } from 'express';

const router = Router();

router.get('/counts', (req, res) => {
  // Aquí puedes poner lógica real si tienes una colección de notificaciones
  res.json({ count: 0 }); // respuesta de prueba
});

export default router;
