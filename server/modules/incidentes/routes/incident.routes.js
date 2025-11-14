// server/modules/incidentes/routes/incident.routes.js
import express from "express";
import {
  getAllIncidents,
  createIncident,
  updateIncident,
  deleteIncident,   // 👈
} from "../controllers/incident.controller.js";

const router = express.Router();

router.get("/", getAllIncidents);
router.post("/", createIncident);
router.put("/:id", updateIncident);
router.delete("/:id", deleteIncident);  // 👈

export default router;
