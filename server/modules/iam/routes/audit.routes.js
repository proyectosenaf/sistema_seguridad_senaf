// server/modules/iam/routes/audit.routes.js
import { Router } from "express";
import { devOr, requirePerm } from "../utils/rbac.util.js";
import IamAudit from "../models/IamAudit.model.js";

const r = Router();

/** Convierte "YYYY-MM-DD" a Date inicio de día */
function startOfDay(s) {
  if (!s) return null;
  // si viene con hora, respeta
  if (String(s).includes("T")) return new Date(s);
  return new Date(`${s}T00:00:00.000Z`);
}

/** Convierte "YYYY-MM-DD" a Date fin de día */
function endOfDay(s) {
  if (!s) return null;
  if (String(s).includes("T")) return new Date(s);
  return new Date(`${s}T23:59:59.999Z`);
}

/**
 * GET /api/iam/v1/audit
 * Filtros:
 *  ?action=&entity=&actor=&from=&to=&limit=&skip=
 */
r.get("/", devOr(requirePerm("iam.roles.manage")), async (req, res) => {
  try {
    const action = String(req.query.action || "").trim();
    const entity = String(req.query.entity || "").trim();
    const actor = String(req.query.actor || "").trim();
    const from = String(req.query.from || "").trim();
    const to = String(req.query.to || "").trim();

    const limitRaw = Number(req.query.limit ?? 200);
    const skipRaw = Number(req.query.skip ?? 0);

    const limit = Math.min(500, Math.max(1, Number.isFinite(limitRaw) ? limitRaw : 200));
    const skip = Math.max(0, Number.isFinite(skipRaw) ? skipRaw : 0);

    const find = {};

    if (action) find.action = action;
    if (entity) find.entity = entity;

    if (actor) {
      find.actorEmail = { $regex: new RegExp(actor, "i") };
    }

    if (from || to) {
      find.createdAt = {};
      const dFrom = startOfDay(from);
      const dTo = endOfDay(to);
      if (dFrom && !isNaN(dFrom.getTime())) find.createdAt.$gte = dFrom;
      if (dTo && !isNaN(dTo.getTime())) find.createdAt.$lte = dTo;

      // si quedó vacío por fechas inválidas
      if (Object.keys(find.createdAt).length === 0) delete find.createdAt;
    }

    const [items, total] = await Promise.all([
      IamAudit.find(find)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      IamAudit.countDocuments(find),
    ]);

    res.json({
      ok: true,
      total,
      count: items.length,
      items,
      limit,
      skip,
    });
  } catch (err) {
    console.error("[audit] Error al obtener auditorías:", err);
    res.status(500).json({
      ok: false,
      error: err?.message || "Error al obtener el historial de auditoría",
    });
  }
});

/**
 * POST /api/iam/v1/audit
 * Crea un registro (útil para registrar desde otros módulos)
 */
r.post("/", devOr(requirePerm("iam.roles.manage")), async (req, res) => {
  try {
    const body = req.body || {};

    const doc = await IamAudit.create({
      action: body.action,
      entity: body.entity,
      entityId: body.entityId || null,
      actorId: body.actorId || null,
      actorEmail: String(body.actorEmail || "").trim().toLowerCase(),
      before: body.before ?? null,
      after: body.after ?? null,
    });

    res.status(201).json({ ok: true, item: doc });
  } catch (err) {
    console.error("[audit] Error creando auditoría:", err);
    res.status(400).json({
      ok: false,
      error: err?.message || "Error al crear registro",
    });
  }
});

/**
 * DELETE /api/iam/v1/audit/cleanup?days=30
 * Elimina registros antiguos
 */
r.delete("/cleanup", devOr(requirePerm("iam.roles.manage")), async (req, res) => {
  try {
    const daysRaw = Number(req.query.days || 30);
    const days = Math.max(1, Number.isFinite(daysRaw) ? daysRaw : 30);

    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const result = await IamAudit.deleteMany({ createdAt: { $lt: cutoff } });

    res.json({
      ok: true,
      removed: result.deletedCount,
      olderThanDays: days,
    });
  } catch (err) {
    console.error("[audit] Error limpiando auditoría:", err);
    res.status(500).json({ ok: false, error: "Error al limpiar registros antiguos" });
  }
});

export default r;
