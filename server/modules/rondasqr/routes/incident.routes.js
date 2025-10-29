const express = require("express");
const router = express.Router();
const IncidentController = require("../controllers/incident.controller");

// Historial
router.get("/api/incidentes", IncidentController.getAllIncidents);

// Crear incidente
router.post("/api/incidentes", IncidentController.createIncident);

// Actualizar incidente (estado o prioridad)
router.put("/api/incidentes/:id", IncidentController.updateIncident);

// Eliminar incidente
router.delete("/api/incidentes/:id", IncidentController.deleteIncident);

module.exports = router;
