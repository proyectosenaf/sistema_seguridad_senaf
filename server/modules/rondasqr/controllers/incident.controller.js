// server/modules/rondasqr/controllers/incident.controller.js
// ← se queda en esta ruta

import mongoose from "mongoose";

// ─────────────────────────────────────────────
// Modelo local de incidentes (el del panel)
// ─────────────────────────────────────────────
const incidentSchema = new mongoose.Schema(
  {
    type: { type: String, required: true },
    description: { type: String, required: true },
    reportedBy: { type: String, required: true },
    zone: { type: String, required: true },
    priority: {
      type: String,
      enum: ["baja", "media", "alta"],
      default: "media",
      required: true,
    },
    status: {
      type: String,
      enum: ["abierto", "en_proceso", "resuelto"],
      default: "abierto",
      required: true,
    },
    date: { type: Date, default: Date.now },
    // lo que manda tu React
    photosBase64: {
      type: [String],
      default: [],
    },
  },
  { timestamps: true }
);

const Incident =
  mongoose.models.Incident || mongoose.model("Incident", incidentSchema);

// ─────────────────────────────────────────────
// helpers para cargar modelos ESM de rondas
// ─────────────────────────────────────────────
async function getRondasIncidentModel() {
  // este sí existe en tu proyecto
  const mod = await import("../models/RqIncident.model.js");
  return mod.default || mod;
}

async function getInformeModel() {
  // este puede NO existir todavía, por eso lo envolvemos
  try {
    const mod = await import("../models/Informe.model.js");
    return mod.default || mod;
  } catch (err) {
    console.warn(
      "[incidentes] no se pudo cargar Informe.model.js:",
      err.message
    );
    return null;
  }
}

// ─────────────────────────────────────────────
// GET /api/incidentes
// ─────────────────────────────────────────────
export const getAllIncidents = async (req, res) => {
  try {
    console.log("[incidentes] GET /api/incidentes");
    const incidents = await Incident.find().sort({ createdAt: -1 });
    res.json(incidents);
  } catch (error) {
    console.error("Error al obtener incidentes:", error);
    res.status(500).json({ message: "Error al obtener los incidentes" });
  }
};

// ─────────────────────────────────────────────
// POST /api/incidentes
// ─────────────────────────────────────────────
export const createIncident = async (req, res) => {
  try {
    console.log("[incidentes] POST /api/incidentes body=", req.body);

    const {
      type,
      description,
      reportedBy,
      zone,
      priority,
      photosBase64 = [],
    } = req.body;

    // 1) guardamos en nuestra colección (la del panel)
    const created = await Incident.create({
      type: type || "Otro",
      description: description || "",
      reportedBy: reportedBy || "",
      zone: zone || "",
      priority: (priority || "media").toLowerCase(),
      status: "abierto",
      date: new Date(),
      photosBase64: Array.isArray(photosBase64) ? photosBase64 : [],
    });

    // 2) reflejar en RqIncident para que rondas también lo vea
    let rqDoc = null;
    try {
      const RqIncident = await getRondasIncidentModel();
      rqDoc = await RqIncident.create({
        type: "custom",
        text: description || "",
        siteName: zone || "",
        officerName: reportedBy || "",
        guardName: reportedBy || "",
        at: created.date,
        photos: Array.isArray(photosBase64) ? photosBase64 : [],
      });
    } catch (mirrorErr) {
      console.warn(
        "[incidentes] no se pudo reflejar en RqIncident:",
        mirrorErr?.message
      );
    }

    // 3) crear Informe (si existe el modelo) para que el panel de “Informes” lo cuente
    try {
      const Informe = await getInformeModel();
      if (Informe) {
        await Informe.create({
          kind: "incidente",
          refId: rqDoc ? rqDoc._id : created._id,
          refModel: rqDoc ? "RqIncident" : "Incident",
          title: type || "Incidente",
          description: description || "",
          siteName: zone || "",
          zone: zone || "",
          priority: (priority || "media").toLowerCase(),
          status: "abierto",
          reportedBy: reportedBy || "",
        });
      }
    } catch (infErr) {
      console.warn(
        "[incidentes] no se pudo crear Informe desde incidente:",
        infErr?.message
      );
    }

    return res.status(201).json(created);
  } catch (error) {
    console.error("Error al crear incidente:", error);
    return res.status(500).json({ message: "Error al crear el incidente" });
  }
};

// ─────────────────────────────────────────────
// PUT /api/incidentes/:id
// ─────────────────────────────────────────────
export const updateIncident = async (req, res) => {
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

    return res.json(updated);
  } catch (error) {
    console.error("Error al actualizar incidente:", error);
    return res
      .status(500)
      .json({ message: "Error al actualizar el incidente" });
  }
};
