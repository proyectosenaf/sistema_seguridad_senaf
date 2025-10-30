const Incident = require("../models/incident.model");

// GET /api/incidentes
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
exports.createIncident = async (req, res) => {
  try {
    const { type, description, reportedBy, zone, priority } = req.body;

    const newIncident = new Incident({
      type,
      description,
      reportedBy,
      zone,
      priority: priority?.toLowerCase() || "media",
      status: "abierto",
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
