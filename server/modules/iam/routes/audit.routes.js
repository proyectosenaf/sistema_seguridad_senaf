// server/modules/iam/routes/audit.routes.js
import { Router } from "express";
import { devOr, requirePerm } from "../utils/rbac.util.js";
import IamAudit from "../models/IamAudit.model.js";

const r = Router();

/** Escapa regex para evitar inyección */
function escapeRegex(s = "") {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Convierte "a,b,c" o array en lista limpia */
function toList(value) {
  if (Array.isArray(value)) {
    return value
      .flatMap((x) => String(x || "").split(","))
      .map((x) => x.trim())
      .filter(Boolean);
  }

  return String(value || "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
}

/**
 * Convierte "YYYY-MM-DD" a Date inicio de día (LOCAL).
 * Si viene con hora (T...), respeta lo que viene.
 */
function startOfDay(s) {
  if (!s) return null;
  const raw = String(s);
  if (raw.includes("T")) {
    const d = new Date(raw);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(`${raw}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Convierte "YYYY-MM-DD" a Date fin de día (LOCAL) */
function endOfDay(s) {
  if (!s) return null;
  const raw = String(s);
  if (raw.includes("T")) {
    const d = new Date(raw);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(`${raw}T23:59:59.999`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function normalizeText(v) {
  return String(v || "").trim();
}

/**
 * GET /api/iam/v1/audit
 * Filtros:
 *  ?action=&entity=&actor=&from=&to=&limit=&skip=
 */
r.get("/", devOr(requirePerm("iam.audit.view")), async (req, res) => {
  try {
    const actionList = toList(req.query.action);
    const entityList = toList(req.query.entity);
    const actor = normalizeText(req.query.actor);
    const from = normalizeText(req.query.from);
    const to = normalizeText(req.query.to);

    const limitRaw = Number(req.query.limit ?? 200);
    const skipRaw = Number(req.query.skip ?? 0);

    const limit = Math.min(500, Math.max(1, Number.isFinite(limitRaw) ? limitRaw : 200));
    const skip = Math.max(0, Number.isFinite(skipRaw) ? skipRaw : 0);

    const find = {};

    if (actionList.length === 1) {
      find.action = actionList[0];
    } else if (actionList.length > 1) {
      find.action = { $in: actionList };
    }

    if (entityList.length === 1) {
      find.entity = entityList[0];
    } else if (entityList.length > 1) {
      find.entity = { $in: entityList };
    }

    if (actor) {
      const rx = new RegExp(escapeRegex(actor), "i");
      find.$or = [
        { actorEmail: { $regex: rx } },
        { actorId: { $regex: rx } },
      ];
    }

    if (from || to) {
      const dFrom = startOfDay(from);
      const dTo = endOfDay(to);

      if ((from && !dFrom) || (to && !dTo)) {
        return res.status(400).json({
          ok: false,
          error: "invalid_date",
          message: "from/to inválido. Usa YYYY-MM-DD o ISO con hora.",
        });
      }

      if (dFrom && dTo && dFrom > dTo) {
        return res.status(400).json({
          ok: false,
          error: "invalid_range",
          message: "from no puede ser mayor que to.",
        });
      }

      find.createdAt = {};
      if (dFrom) find.createdAt.$gte = dFrom;
      if (dTo) find.createdAt.$lte = dTo;
    }

    const [items, total] = await Promise.all([
      IamAudit.find(find)
        .sort({ createdAt: -1, _id: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      IamAudit.countDocuments(find),
    ]);

    return res.json({
      ok: true,
      total,
      count: items.length,
      items,
      limit,
      skip,
      hasMore: skip + items.length < total,
    });
  } catch (err) {
    console.error("[audit] Error al obtener auditorías:", err);
    return res.status(500).json({
      ok: false,
      error: err?.message || "Error al obtener el historial de auditoría",
    });
  }
});

/**
 * POST /api/iam/v1/audit
 * Crea un registro
 */
r.post("/", devOr(requirePerm("iam.roles.manage")), async (req, res) => {
  try {
    const body = req.body || {};

    const doc = await IamAudit.create({
      action: normalizeText(body.action),
      entity: normalizeText(body.entity),
      entityId: body.entityId ? normalizeText(body.entityId) : null,
      actorId: body.actorId ? normalizeText(body.actorId) : null,
      actorEmail: normalizeText(body.actorEmail).toLowerCase(),
      before: body.before ?? null,
      after: body.after ?? null,
      meta: {
        ip:
          body?.meta?.ip ||
          req.ip ||
          req.headers["x-forwarded-for"] ||
          null,
        ua: body?.meta?.ua || req.headers["user-agent"] || null,
        path: body?.meta?.path || req.originalUrl || null,
        method: body?.meta?.method || req.method || null,
      },
    });

    return res.status(201).json({ ok: true, item: doc });
  } catch (err) {
    console.error("[audit] Error creando auditoría:", err);
    return res.status(400).json({
      ok: false,
      error: err?.message || "Error al crear registro",
    });
  }
});

/**
 * DELETE /api/iam/v1/audit/cleanup?days=30
 */
r.delete("/cleanup", devOr(requirePerm("iam.roles.manage")), async (req, res) => {
  try {
    const daysRaw = Number(req.query.days || 30);
    const days = Math.max(1, Number.isFinite(daysRaw) ? daysRaw : 30);

    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const result = await IamAudit.deleteMany({ createdAt: { $lt: cutoff } });

    return res.json({
      ok: true,
      removed: result.deletedCount,
      olderThanDays: days,
    });
  } catch (err) {
    console.error("[audit] Error limpiando auditoría:", err);
    return res.status(500).json({
      ok: false,
      error: "Error al limpiar registros antiguos",
    });
  }
});

export default r;