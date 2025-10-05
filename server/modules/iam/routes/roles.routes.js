// server/modules/iam/routes/roles.routes.js
import { Router } from "express";
import { requireAuth, requirePerm } from "../utils/auth.util.js";

const r = Router();

/** Lista estática de roles (puedes llevarlos a Mongo luego) */
const ROLES = [
  {
    key: "admin",
    name: "Administrador general",
    description: "Superusuario del sistema.",
    perms: ["*"], // todo
  },
  {
    key: "security_supervisor",
    name: "Supervisor de seguridad",
    description: "Supervisa rondas, incidentes, acceso y reportes.",
    perms: [
      "rondas.read","rondas.write",
      "incidentes.read","incidentes.write",
      "accesos.read","visitas.read","reportes.read",
    ],
  },
  {
    key: "guard",
    name: "Guardia / Agente",
    description: "Registra rondas e incidentes diarios.",
    perms: ["rondas.read","rondas.write","incidentes.write"],
  },
  {
    key: "reception",
    name: "Recepcionista / Portero",
    description: "Controla entradas/salidas y visitas.",
    perms: ["accesos.write","visitas.write","accesos.read","visitas.read"],
  },
  {
    key: "analyst",
    name: "Analista / Auditor",
    description: "Analiza datos e informes (solo lectura).",
    perms: ["reportes.read","evaluacion.read","bitacora.read"],
  },
  {
    key: "tech_admin",
    name: "Administrador técnico (TI)",
    description: "Mantenimiento, respaldos, configuración.",
    perms: ["seguridad.full","config.full"],
  },
];

// GET /api/iam/v1/roles
r.get("/", requireAuth, (req, res) => {
  res.json({ ok: true, items: ROLES });
});

// POST /api/iam/v1/roles   (stub)
r.post("/", requireAuth, requirePerm("iam.roles.manage"), (req, res) => {
  return res.status(501).json({ ok: false, error: "not_implemented" });
});

export default r;
