// server/modules/incidentes/controllers/incident.controller.js
import fs from "node:fs";
import path from "node:path";
import IncidentGlobal from "../models/incident.model.js";

const uploadDir = path.resolve(process.cwd(), "uploads", "incidentes");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

function saveBase64ToFile(dataUrlOrB64, prefix, i, defaultExt) {
  if (typeof dataUrlOrB64 !== "string") return null;

  // data:<mime>;base64,<data>
  const m = dataUrlOrB64.match(/^data:([^;]+);base64,(.+)$/);
  const mime = m?.[1] || "";
  const data = m?.[2] || dataUrlOrB64;

  let ext = defaultExt;
  if (mime.includes("/")) ext = mime.split("/")[1].replace("mpeg", "mp3");

  const filename = `${prefix}_${Date.now()}_${i}.${ext}`;
  const filePath = path.join(uploadDir, filename);
  fs.writeFileSync(filePath, Buffer.from(data, "base64"));
  return `/uploads/incidentes/${filename}`;
}

function normalizeList(val) {
  if (!val) return [];
  if (Array.isArray(val)) return val;
  if (typeof val === "string") {
    try {
      const parsed = JSON.parse(val);
      return Array.isArray(parsed) ? parsed : [val];
    } catch {
      return [val];
    }
  }
  return [];
}

// GET /api/incidentes
export async function getAllIncidents(_req, res) {
  try {
    const items = await IncidentGlobal.find().sort({ createdAt: -1 }).lean();
    return res.json({ ok: true, items });
  } catch (err) {
    console.error("[incidentes-global] getAllIncidents:", err);
    return res.status(500).json({ ok: false, error: "Error obteniendo incidentes" });
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

    if (!type || !description || !reportedBy || !zone) {
      return res.status(400).json({ ok: false, error: "Faltan campos requeridos" });
    }

    // 1) multipart photos (si existieran)
    const photos = Array.isArray(req.files)
      ? req.files.map((f) => `/uploads/incidentes/${f.filename}`)
      : [];

    const videos = [];
    const audios = [];

    // 2) base64 photos
    const photosBase64 = normalizeList(req.body?.photosBase64);
    for (let i = 0; i < photosBase64.length; i++) {
      const saved = saveBase64ToFile(photosBase64[i], "img", i, "png");
      if (saved) photos.push(saved);
    }

    // 3) base64 videos
    const videosBase64 = normalizeList(req.body?.videosBase64);
    for (let i = 0; i < videosBase64.length; i++) {
      const saved = saveBase64ToFile(videosBase64[i], "vid", i, "webm");
      if (saved) videos.push(saved);
    }

    // 4) base64 audios
    const audiosBase64 = normalizeList(req.body?.audiosBase64);
    for (let i = 0; i < audiosBase64.length; i++) {
      const saved = saveBase64ToFile(audiosBase64[i], "aud", i, "webm");
      if (saved) audios.push(saved);
    }

    const item = await IncidentGlobal.create({
      type,
      description,
      reportedBy,
      zone,
      priority,
      status,
      photos,
      videos,
      audios,
      date: new Date(),
      source: req.body?.source || "incidentes",
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
      return res.status(404).json({ ok: false, error: "Incidente no encontrado" });
    }

    return res.json({ ok: true, item: updated });
  } catch (err) {
    console.error("[incidentes-global] updateIncident:", err);
    return res.status(500).json({ ok: false, error: "Error actualizando incidente" });
  }
}

// DELETE /api/incidentes/:id
export async function deleteIncident(req, res) {
  try {
    const { id } = req.params;

    const deleted = await IncidentGlobal.findByIdAndDelete(id).lean();
    if (!deleted) {
      return res.status(404).json({ ok: false, error: "Incidente no encontrado" });
    }

    const allFiles = [
      ...(Array.isArray(deleted.photos) ? deleted.photos : []),
      ...(Array.isArray(deleted.videos) ? deleted.videos : []),
      ...(Array.isArray(deleted.audios) ? deleted.audios : []),
    ];

    for (const rel of allFiles) {
      try {
        if (typeof rel !== "string") continue;
        const clean = rel.replace(/^\//, "");
        const abs = path.resolve(process.cwd(), clean);
        if (abs.startsWith(uploadDir) && fs.existsSync(abs)) fs.unlinkSync(abs);
      } catch (e) {
        console.warn("[incidentes-global] error borrando archivo:", e?.message || e);
      }
    }

    return res.json({ ok: true, id });
  } catch (err) {
    console.error("[incidentes-global] deleteIncident:", err);
    return res.status(500).json({ ok: false, error: "Error eliminando incidente" });
  }
}
