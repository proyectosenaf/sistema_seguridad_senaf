// server/modules/rondasqr/routes/rondasqr.incidents.routes.js
import { Router } from "express";
import fs from "node:fs";
import path from "node:path";
import RqIncident from "../models/RqIncident.model.js";

const r = Router();

// Asegura carpeta de uploads
const UP_BASE = path.resolve("server/modules/rondasqr/uploads/incidents");
fs.mkdirSync(UP_BASE, { recursive: true });

/**
 * POST /incidents   (esto queda dentro de /api/rondasqr/v1/... según lo montes)
 * body: {
 *   siteId?, roundId?, pointId?,
 *   type?,               // opcional, ej: "custom"
 *   text (string),
 *   lat?, lon?,
 *   photosBase64?: [ "data:image/jpeg;base64,...", "..." ]
 * }
 *
 * Nota: esto es el endpoint “rápido” del módulo de RONDAS.
 * El módulo grande de INCIDENTES puede tener su propio /api/incidentes.
 */
r.post("/incidents", async (req, res) => {
  try {
    const {
      siteId,
      roundId,
      pointId,
      type = "custom",
      text = "",
      lat,
      lon,
      photosBase64 = [],
    } = req.body || {};

    // unificamos origen del usuario
    const u = req.user || req?.auth?.payload || {};
    const guardName = u.name || u.email || "Anónimo";
    const guardId = u.sub || "dev";
    const officerName = u.name || "";
    const officerEmail = u.email || "";

    // Guardar fotos base64 si vienen
    const photos = [];
    for (const b64 of photosBase64) {
      if (typeof b64 !== "string") continue;
      const m = b64.match(/^data:(.+);base64,(.+)$/);
      if (!m) continue;
      const ext = (m[1] || "application/octet-stream").split("/")[1] || "bin";
      const buf = Buffer.from(m[2], "base64");
      const filename = `${Date.now()}_${Math.random()
        .toString(36)
        .slice(2)}.${ext}`;
      const full = path.join(UP_BASE, filename);
      fs.writeFileSync(full, buf);
      photos.push(`/uploads/incidents/${filename}`);
    }

    const loc =
      lat != null && lon != null
        ? {
            type: "Point",
            coordinates: [Number(lon), Number(lat)],
          }
        : undefined;

    const inc = await RqIncident.create({
      type,
      text,
      siteId,
      roundId,
      pointId,
      guardId,
      guardName,
      officerName,
      officerEmail,
      photos,
      gps:
        lat != null && lon != null
          ? { lat: Number(lat), lon: Number(lon) }
          : undefined,
      loc,
    });

    res.json({ ok: true, incidentId: inc._id, photos });
  } catch (err) {
    console.error("[incidents] create error:", err);
    res.status(500).json({ ok: false, message: "Error al crear incidente" });
  }
});

export default r;
  