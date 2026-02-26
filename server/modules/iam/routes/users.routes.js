import { Router } from "express";

const r = Router();

// ejemplo
r.get("/", (req, res) => {
  res.json({ ok: true, items: [] });
});

export default r;