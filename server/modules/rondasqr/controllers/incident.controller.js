// server/modules/rondasqr/controllers/incident.controller.js
import Incident from "../models/incident.model.js"; // ajusta al modelo real

export async function getAllIncidents(req, res) {
  const items = await Incident.find().sort({ createdAt: -1 }).lean();
  res.json({ ok: true, items });
}

export async function createIncident(req, res) {
  // aquí va tu lógica real; dejo placeholder para que no crashee
  res.status(201).json({ ok: true, message: "createIncident pendiente" });
}

export async function updateIncident(req, res) {
  res.json({ ok: true, message: "updateIncident pendiente" });
}
