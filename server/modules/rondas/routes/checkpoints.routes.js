import { Router } from "express";
import QRCode from "qrcode";
import Checkpoint from "../models/Checkpoint.model.js";

const r = Router();

// GET /api/rondas/v1/checkpoints/:id/qr?format=png|svg
r.get("/:id/qr", async (req, res) => {
  const cp = await Checkpoint.findById(req.params.id).lean();
  if (!cp) return res.status(404).json({ message: "Checkpoint no encontrado" });

  const payload = cp.qrPayload || `senaf:rondas:checkpoint:${cp.code}`;
  const format = String(req.query.format || "png").toLowerCase();

  if (format === "svg") {
    const svg = await QRCode.toString(payload, { type: "svg", errorCorrectionLevel: "M" });
    res.setHeader("Content-Type", "image/svg+xml");
    return res.send(svg);
  }

  res.setHeader("Content-Type", "image/png");
  res.setHeader("Cache-Control", "public, max-age=3600");
  await QRCode.toFileStream(res, payload, { errorCorrectionLevel: "M", width: 512, margin: 1 });
});

export default r;
