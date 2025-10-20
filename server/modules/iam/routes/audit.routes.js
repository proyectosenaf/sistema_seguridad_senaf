import { Router } from "express";
import { devOr, requirePerm } from "../utils/rbac.util.js";
import IamAudit from "../models/IamAudit.model.js"; // 👈 usa tu modelo directamente

const r = Router();

/**
 * GET /api/iam/audit
 * Devuelve los últimos registros de auditoría
 */
r.get("/", devOr(requirePerm("iam.roles.manage")), async (req, res) => {
  const limit = Math.min(500, Math.max(1, Number(req.query.limit || 100)));
  try {
    const items = await IamAudit.find()
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    res.json({ items });
  } catch (err) {
    console.error("Error al obtener auditorías:", err);
    res.status(500).json({ error: "Error al obtener el historial" });
  }
});

/**
 * POST /api/iam/audit
 * Crea un nuevo registro de auditoría
 */
r.post("/", devOr(requirePerm("iam.roles.manage")), async (req, res) => {
  try {
    const { action, entity, entityId, actorId, actorEmail, before, after } =
      req.body || {};

    const doc = await IamAudit.create({
      action,
      entity,
      entityId,
      actorId,
      actorEmail,
      before,
      after,
    });

    res.status(201).json(doc);
  } catch (err) {
    console.error("Error creando registro de auditoría:", err);
    res.status(400).json({ error: err?.message || "Error al crear registro" });
  }
});

export default r;

