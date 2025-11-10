// server/src/controllers/incident.controller.js
import Incident from "../models/incident.model.js";

/**
 * GET /api/incidentes
 */
export async function getAllIncidents(_req, res) {
  try {
    const incidents = await Incident.find().sort({ createdAt: -1 });
    return res.json(incidents);
  } catch (err) {
    console.error("[incidentes] getAllIncidents:", err);
    return res.status(500).json({ error: "Error obteniendo incidentes" });
  }
}

/**
 * POST /api/incidentes
 */
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

    if (!type || !description) {
      return res
        .status(400)
        .json({ error: "type y description son obligatorios" });
    }

    const reportedByFinal =
      reportedBy ||
      req?.user?.email ||
      req?.auth?.payload?.email ||
      "Sistema";

    // fotos subidas por multer
    const photos = (req.files || []).map(
      (f) => `/uploads/incidentes/${f.filename}`
    );

    const incident = await Incident.create({
      type,
      description,
      reportedBy: reportedByFinal,
      zone: zone || "",
      priority,
      status,
      photos,
    });

    return res.status(201).json(incident);
  } catch (err) {
    console.error("[incidentes] createIncident:", err);
    return res.status(500).json({ error: "Error creando incidente" });
  }
}

/**
 * PUT /api/incidentes/:id
 */
export async function updateIncident(req, res) {
  try {
    const { id } = req.params;
    const { status, priority, description, zone } = req.body || {};

    const updates = {};
    if (status) updates.status = status;
    if (priority) updates.priority = priority;
    if (typeof description === "string") updates.description = description;
    if (typeof zone === "string") updates.zone = zone;

    const updated = await Incident.findByIdAndUpdate(id, updates, {
      new: true,
    });

    if (!updated) {
      return res.status(404).json({ error: "Incidente no encontrado" });
    }

    return res.json(updated);
  } catch (err) {
    console.error("[incidentes] updateIncident:", err);
    return res.status(500).json({ error: "Error actualizando incidente" });
  }
}
