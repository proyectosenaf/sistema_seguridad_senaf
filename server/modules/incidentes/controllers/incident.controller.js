// server/modules/incidentes/controllers/incident.controller.js
import fs from "node:fs";
import path from "node:path";
import IncidentGlobal from "../models/incident.model.js";

// aseguramos carpeta de uploads (la misma que usa el server principal)
const uploadDir = path.resolve(process.cwd(), "uploads", "incidentes");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// GET /api/incidentes
export async function getAllIncidents(_req, res) {
  try {
    const items = await IncidentGlobal.find().sort({ createdAt: -1 }).lean();
    return res.json({ ok: true, items });
  } catch (err) {
    console.error("[incidentes-global] getAllIncidents:", err);
    return res
      .status(500)
      .json({ ok: false, error: "Error obteniendo incidentes" });
  }
}

// POST /api/incidentes
export async function createIncident(req, res) {
  try {
    const {
      type,
      description,
      reportedBy,
      zone,
      priority = "media",
      status = "abierto",
    } = req.body || {};

    // 1) fotos que vienen por multipart (input type="file")
    const photos = Array.isArray(req.files)
      ? req.files.map((f) => `/uploads/incidentes/${f.filename}`)
      : [];

    // 2) fotos que vienen en base64 (por ejemplo de la cámara)
    // pueden venir como string (JSON) o como array
    if (req.body?.photosBase64) {
      let list = [];
      if (typeof req.body.photosBase64 === "string") {
        // puede venir como JSON.stringify([...])
        try {
          list = JSON.parse(req.body.photosBase64);
        } catch {
          list = [req.body.photosBase64];
        }
      } else if (Array.isArray(req.body.photosBase64)) {
        list = req.body.photosBase64;
      }

      for (let i = 0; i < list.length; i++) {
        const b64 = list[i];
        if (typeof b64 !== "string") continue;

        const matches = b64.match(/^data:(image\/\w+);base64,(.+)$/);
        const ext = matches ? matches[1].split("/")[1] : "png";
        const data = matches ? matches[2] : b64;

        const filename = `cam_${Date.now()}_${i}.${ext}`;
        const filePath = path.join(uploadDir, filename);
        fs.writeFileSync(filePath, Buffer.from(data, "base64"));
        photos.push(`/uploads/incidentes/${filename}`);
      }
    }

    // 3) guardar en la colección del módulo de INCIDENTES
    const item = await IncidentGlobal.create({
      type,
      description,
      reportedBy,
      zone,
      priority,
      status,
      photos,
      date: new Date(),
      source: req.body?.source || "incidentes", // opcional
    });

    return res.status(201).json({ ok: true, item });
  } catch (err) {
    console.error("[incidentes-global] createIncident:", err);
    return res.status(500).json({
      ok: false,
      error: "Error creando incidente",
      detail: err.message,
    });
  }
}

// PUT /api/incidentes/:id
export async function updateIncident(req, res) {
  try {
    const { id } = req.params;
    const updates = req.body || {};

    const updated = await IncidentGlobal.findByIdAndUpdate(id, updates, {
      new: true,
    }).lean();

    if (!updated) {
      return res
        .status(404)
        .json({ ok: false, error: "Incidente no encontrado" });
    }

    return res.json({ ok: true, item: updated });
  } catch (err) {
    console.error("[incidentes-global] updateIncident:", err);
    return res
      .status(500)
      .json({ ok: false, error: "Error actualizando incidente" });
  }
}
