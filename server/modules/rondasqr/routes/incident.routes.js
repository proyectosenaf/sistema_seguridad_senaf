const express = require("express");
const router = express.Router();
const IncidentController = require("../controllers/incident.controller");

// Historial
router.get("/api/incidentes", IncidentController.getAllIncidents);

// Crear
router.post("/api/incidentes", IncidentController.createIncident);

// Actualizar estado
router.put("/api/incidentes/:id", IncidentController.updateIncident);

module.exports = router;
