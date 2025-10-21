// server/modules/iam/routes/audit.routes.js
import { Router } from "express";
import { devOr, requirePerm } from "../utils/rbac.util.js";
import IamAudit from "../models/IamAudit.model.js";

const r = Router();

/**
 * GET /api/iam/audit
 * Devuelve los registros de auditoría con filtros avanzados.
 * Filtros: ?action=&entity=&actor=&from=&to=&limit=&skip=
 */
r.get("/", devOr(requirePerm("iam.roles.manage")), async (req, res) => {
  try {
    const { action, entity, actor, from, to, limit = 200, skip = 0 } = req.query;
    const find = {};

    if (action) find.action = action;
    if (entity) find.entity = entity;
    if (actor) find.actorEmail = { $regex: new RegExp(actor, "i") };

    if (from || to) {
      find.createdAt = {};
      if (from) find.createdAt.$gte = new Date(from);
      if (to) find.createdAt.$lte = new Date(to);
    }

    const items = await IamAudit.find(find)
      .sort({ createdAt: -1 })
      .skip(Number(skip))
      .limit(Math.min(500, Math.max(1, Number(limit))))
      .lean();

    const total = await IamAudit.countDocuments(find);

    res.json({
      ok: true,
      total,
      count: items.length,
      items,
    });
  } catch (err) {
    console.error("Error al obtener auditorías:", err);
    res.status(500).json({ error: "Error al obtener el historial de auditoría" });
  }
});

/**
 * POST /api/iam/audit
 * Crea un nuevo registro manualmente (por si se necesita registrar desde otros módulos)
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

/**
 * DELETE /api/iam/audit/cleanup?days=30
 * Elimina registros antiguos de la bitácora (para mantenimiento interno)
 */
r.delete("/cleanup", devOr(requirePerm("iam.roles.manage")), async (req, res) => {
  try {
    const days = Math.max(1, Number(req.query.days || 30));
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const result = await IamAudit.deleteMany({ createdAt: { $lt: cutoff } });
    res.json({
      ok: true,
      removed: result.deletedCount,
      olderThan: days,
    });
  } catch (err) {
    console.error("Error limpiando registros de auditoría:", err);
    res.status(500).json({ error: "Error al limpiar registros antiguos" });
  }
});

export default r;
