const Incident = require("../models/incident.model");

// GET /api/incidentes
// Devuelve el historial de incidentes
exports.getAllIncidents = async (req, res) => {
  try {
    const incidents = await Incident.find().sort({ createdAt: -1 });
    res.json(incidents);
  } catch (error) {
    console.error("Error al obtener incidentes:", error);
    res.status(500).json({ message: "Error al obtener los incidentes" });
  }
};

// POST /api/incidentes
// Crea un incidente nuevo
exports.createIncident = async (req, res) => {
  try {
    const { type, description, reportedBy, zone, priority } = req.body;

    const newIncident = new Incident({
      type,
      description,
      reportedBy,
      zone,
      priority: priority?.toLowerCase() || "media",
      status: "abierto", // todos inician abiertos
      date: new Date(),
    });

    await newIncident.save();

    res.status(201).json(newIncident);
  } catch (error) {
    console.error("Error al crear incidente:", error);
    res.status(500).json({ message: "Error al crear el incidente" });
  }
};

// PUT /api/incidentes/:id
// Cambiar estado (ej. Procesar -> en_proceso, Resolver -> resuelto)
exports.updateIncident = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, priority } = req.body;

    const updated = await Incident.findByIdAndUpdate(
      id,
      {
        ...(status && { status }),
        ...(priority && { priority }),
      },
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({ message: "Incidente no encontrado" });
    }

    res.json(updated);
  } catch (error) {
    console.error("Error al actualizar incidente:", error);
    res.status(500).json({ message: "Error al actualizar el incidente" });
  }
};

// DELETE /api/incidentes/:id
exports.deleteIncident = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await Incident.findByIdAndDelete(id);

    if (!deleted) {
      return res.status(404).json({ message: "Incidente no encontrado" });
    }

    res.json({ message: "Incidente eliminado correctamente" });
  } catch (error) {
    console.error("Error al eliminar incidente:", error);
    res.status(500).json({ message: "Error al eliminar el incidente" });
  }
};
