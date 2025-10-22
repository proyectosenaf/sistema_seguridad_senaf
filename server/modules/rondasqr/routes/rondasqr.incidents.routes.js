// server/modules/rondasqr/routes/rondasqr.incidents.routes.js (sin multer)
import { Router } from "express";
import fs from "node:fs";
import path from "node:path";
import RqIncident from "../models/RqIncident.model.js";

const r = Router();

// Asegura carpeta
const UP_BASE = path.resolve("server/modules/rondasqr/uploads/incidents");
fs.mkdirSync(UP_BASE, { recursive: true });

/**
 * POST /incidents
 * body: {
 *   siteId?, roundId?, pointId?,
 *   text (string),
 *   lat?, lon?,
 *   photosBase64?: [ "data:image/jpeg;base64,...", "..." ]   // opcional
 * }
 */
r.post("/incidents", async (req, res) => {
  try {
    const { siteId, roundId, pointId, text, lat, lon, photosBase64 = [] } = req.body || {};
    const guardName = req.user?.email || "Anónimo";
    const guardId = req.user?.sub || "dev";

    // Guardar fotos base64 si vienen
    const photos = [];
    for (const b64 of photosBase64) {
      if (typeof b64 !== "string") continue;
      const m = b64.match(/^data:(.+);base64,(.+)$/);
      if (!m) continue;
      const ext = (m[1] || "application/octet-stream").split("/")[1] || "bin";
      const buf = Buffer.from(m[2], "base64");
      const filename = `${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
      const full = path.join(UP_BASE, filename);
      fs.writeFileSync(full, buf);
      photos.push(`/uploads/incidents/${filename}`);
    }

    const loc =
      lat && lon
        ? { type: "Point", coordinates: [Number(lon), Number(lat)] }
        : undefined;

    const inc = await RqIncident.create({
      siteId, roundId, pointId, text, photos, guardId, guardName, loc,
    });

    res.json({ ok: true, incidentId: inc._id, photos });
  } catch (err) {
    console.error("[incidents] create error:", err);
    res.status(500).json({ ok: false, message: "Error al crear incidente" });
  }
});

export default r;
