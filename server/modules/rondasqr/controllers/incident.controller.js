// server/modules/rondasqr/controllers/incident.controller.js
import fs from "node:fs";
import path from "node:path";
import Incident from "../models/incident.model.js";

const uploadDir = path.resolve(process.cwd(), "uploads", "incidentes");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// GET /api/incidentes
export async function getAllIncidents(_req, res) {
  try {
    const items = await Incident.find().sort({ createdAt: -1 }).lean();
    return res.json(items);
  } catch (err) {
    console.error("[incidentes] getAllIncidents:", err);
    return res
      .status(500)
      .json({ error: "Error obteniendo incidentes" });
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
    } = req.body;

    const photos = Array.isArray(req.files)
      ? req.files.map((f) => `/uploads/incidentes/${f.filename}`)
      : [];

    const created = await Incident.create({
      type,
      description,
      reportedBy,
      zone,
      priority,
      status,
      photos,
      date: new Date(),
    });

    return res.status(201).json(created);
  } catch (err) {
    console.error("[incidentes] createIncident:", err);
    return res
      .status(500)
      .json({ error: "Error creando incidente" });
  }
}

// PUT /api/incidentes/:id
export async function updateIncident(req, res) {
  try {
    const { id } = req.params;
    const updates = req.body || {};

    const updated = await Incident.findByIdAndUpdate(id, updates, {
      new: true,
    }).lean();

    if (!updated) {
      return res
        .status(404)
        .json({ error: "Incidente no encontrado" });
    }

    return res.json(updated);
  } catch (err) {
    console.error("[incidentes] updateIncident:", err);
    return res
      .status(500)
      .json({ error: "Error actualizando incidente" });
  }
}
