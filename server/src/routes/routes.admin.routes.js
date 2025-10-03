import { Router } from "express";
import { celebrate, Joi, Segments } from "celebrate";
import Route from "../models/Route.js";
import { requireAuth } from "../middleware/auth.js"; // tu guard de Auth0

const router = Router();
router.use(requireAuth);

// LIST
router.get("/", async (req, res) => {
  const q = (req.query.q || "").trim();
  const find = q
    ? { $or: [{ name: { $regex: q, $options: "i" } }, { code: { $regex: q, $options: "i" } }] }
    : {};
  const list = await Route.find(find).sort({ createdAt: -1 }).lean();
  res.json(list);
});

// ONE
router.get("/:id", async (req, res) => {
  const doc = await Route.findById(req.params.id).lean();
  if (!doc) return res.status(404).json({ error: "Ruta no encontrada" });
  res.json(doc);
});

// CREATE
router.post(
  "/",
  celebrate({
    [Segments.BODY]: Joi.object({
      siteId: Joi.string().allow(null, "").optional(),
      name: Joi.string().required(),
      code: Joi.string().allow("", null).optional(),
      active: Joi.boolean().optional(),
      sla: Joi.object({
        lateThresholdSeconds: Joi.number().min(0).required(),
        missingThresholdSeconds: Joi.number().min(0).required(),
      }).required(),
      checkpoints: Joi.array().items(
        Joi.object({
          code: Joi.string().required(),
          name: Joi.string().required(),
          order: Joi.number().min(0).required(),
          expectedSecondsFromStart: Joi.number().min(0).required(),
          graceSeconds: Joi.number().min(0).required(),
          allowedMethods: Joi.array().items(Joi.string().valid("qr", "nfc", "finger")).default([]),
          requirePhoto: Joi.boolean().default(false),
          requireNote: Joi.boolean().default(false),
          tags: Joi.array().items(Joi.string()).default([]),
        })
      ).min(1).required(),
      windows: Joi.array().default([]),
    }),
  }),
  async (req, res) => {
    const doc = await Route.create(req.body);
    res.status(201).json(doc);
  }
);

// UPDATE
router.put("/:id", async (req, res) => {
  const doc = await Route.findByIdAndUpdate(req.params.id, req.body, { new: true });
  if (!doc) return res.status(404).json({ error: "Ruta no encontrada" });
  res.json(doc);
});

// DELETE
router.delete("/:id", async (req, res) => {
  const ok = await Route.findByIdAndDelete(req.params.id);
  if (!ok) return res.status(404).json({ error: "Ruta no encontrada" });
  res.json({ ok: true });
});

export default router;
