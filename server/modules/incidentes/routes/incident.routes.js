// server/modules/incidentes/routes/incident.routes.js
import express from "express";
import {
  getAllIncidents,
  createIncident,
  updateIncident,
} from "../controllers/incident.controller.js";

const router = express.Router();

router.get("/", getAllIncidents);
router.post("/", createIncident);
router.put("/:id", updateIncident);

export default router;
