import { Router } from "express";
const router = Router();

// GET /api/incidentes?limit=100
router.get("/", async (req, res) => {
  const limit = Number(req.query.limit ?? 20);
  // TODO: reemplazar por DB real
  const items = Array.from({ length: Math.min(limit, 5) }).map((_, i) => ({
    _id: `INC-${i + 1}`,
    tipo: "Robo/Hurto",
    estado: "abierto",
    fecha: new Date().toISOString(),
    prioridad: "media",
  }));
  res.json({ items, total: 5 });
});

export default router;
