import { Router } from "express";
import mongoose from "mongoose";
import { requireAuth } from "../utils/auth.util.js";
import Alert from "../models/Alert.js";

const r = Router();

const isId = (v) => mongoose.Types.ObjectId.isValid(String(v || ""));

/* -------- helpers de query -------- */

function parseRange(q = {}) {
  const fromQ = q.from || q.start || q.since;
  const toQ   = q.to   || q.end   || q.until;

  const from = fromQ ? new Date(fromQ) : new Date(Date.now() - 24 * 3600 * 1000);
  const to   = toQ   ? new Date(toQ)   : new Date();

  // valores válidos o defaults
  const fromOk = isNaN(+from) ? new Date(Date.now() - 24 * 3600 * 1000) : from;
  const toOk   = isNaN(+to)   ? new Date() : to;

  return { from: fromOk, to: toOk };
}

function parsePagination(q = {}) {
  const limit = Math.max(1, Math.min(200, Number(q.limit || 50)));
  const page  = Math.max(1, Number(q.page || 1));
  const skip  = (page - 1) * limit;
  return { limit, page, skip };
}

function buildFilter(q = {}, range) {
  // Solo documentos del tipo "incident"
  const f = { kind: "incident" };

  // Rango por fecha de creación (createdAt)
  f.createdAt = { $gte: range.from, $lte: range.to };

  // status = open|ack|closed
  if (q.status) {
    const arr = String(q.status)
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (arr.length) f.status = { $in: arr };
  }

  // severidad: low|medium|high|critical
  if (q.severity) {
    const arr = String(q.severity)
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (arr.length) f.severity = { $in: arr };
  }

  // filtros por ids conocidos
  if (q.siteId && isId(q.siteId))     f.siteId        = new mongoose.Types.ObjectId(q.siteId);
  if (q.routeId && isId(q.routeId))   f.routeId       = new mongoose.Types.ObjectId(q.routeId);
  if (q.shiftId && isId(q.shiftId))   f.shiftId       = new mongoose.Types.ObjectId(q.shiftId);
  if (q.zoneId && isId(q.zoneId))     f["meta.zoneId"] = new mongoose.Types.ObjectId(q.zoneId);

  // guardId (texto)
  if (q.guardId) f.guardId = String(q.guardId);

  // texto libre (title/message)
  if (q.q) {
    const rx = new RegExp(String(q.q).trim(), "i");
    f.$or = [{ title: rx }, { message: rx }];
  }

  return f;
}

/* =========================
 *      RUTAS INCIDENTES
 * ========================= */

/**
 * POST /api/incidentes
 * (alias: /api/rondas/v1/incidents)
 */
r.post("/", requireAuth, async (req, res) => {
  try {
    const {
      title,
      message,
      severity = "medium",        // low|medium|high|critical
      geo,
      photos = [],
      siteId,
      routeId,
      shiftId,
      zoneId,
      checkpointId,
      meta = {},
    } = req.body || {};

    if (!title && !message) {
      return res.status(400).json({ ok: false, error: "title o message requerido" });
    }

    // identidad del usuario (guardia)
    const guardId   = req.user?.id   || req.user?.sub || req.auth?.sub || req.body?.guardId || "unknown";
    const guardName = req.user?.name || req.body?.guardName || undefined;

    const alert = await Alert.create({
      kind: "incident",
      status: "open",
      severity,

      title: title || "Incidente reportado",
      message: message || "",

      siteId:  isId(siteId)  ? new mongoose.Types.ObjectId(siteId)  : undefined,
      routeId: isId(routeId) ? new mongoose.Types.ObjectId(routeId) : undefined,
      shiftId: isId(shiftId) ? new mongoose.Types.ObjectId(shiftId) : undefined,

      guardId: String(guardId),
      guardName,

      geo, // {lat,lng}, opcional
      source: "mobile",
      opened: { by: String(guardId), note: "reported" },
      createdBy: String(guardId),

      meta: {
        ...meta,
        zoneId:       isId(zoneId)       ? new mongoose.Types.ObjectId(zoneId)       : meta.zoneId,
        checkpointId: isId(checkpointId) ? new mongoose.Types.ObjectId(checkpointId) : meta.checkpointId,
        photos: Array.isArray(photos) ? photos : [],
      },

      tags: ["rondas", "incident"],
    });

    // evento realtime opcional
    try {
      req.io?.emit?.("rondas:incident:new", {
        _id: alert._id,
        kind: alert.kind,
        severity: alert.severity,
        status: alert.status,
        title: alert.title,
        message: alert.message,
        siteId: alert.siteId,
        routeId: alert.routeId,
        shiftId: alert.shiftId,
        guardId: alert.guardId,
        guardName: alert.guardName,
        createdAt: alert.createdAt,
        meta: alert.meta,
        geo: alert.geo,
      });
    } catch { /* no-op */ }

    return res.status(201).json({ ok: true, data: alert });
  } catch (err) {
    console.error("[incidentes:create] error:", err);
    return res.status(500).json({ ok: false, error: err?.message || "internal_error" });
  }
});

/**
 * GET /api/incidentes
 */
r.get("/", requireAuth, async (req, res) => {
  const range = parseRange(req.query);
  const { limit, page, skip } = parsePagination(req.query);
  const filter = buildFilter(req.query, range);

  try {
    const [items, total] = await Promise.all([
      Alert.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Alert.countDocuments(filter),
    ]);

    // Compatible con tu Home (lee r.data o r.data.items)
    return res.json({
      ok: true,
      page,
      limit,
      total,
      items,
      range: { from: range.from, to: range.to },
      filter: { ...req.query, status: filter.status },
    });
  } catch (err) {
    console.error("[incidentes:list] error:", err);
    return res.status(500).json({ ok: false, error: err?.message || "internal_error" });
  }
});

/**
 * GET /api/incidentes/:id
 */
r.get("/:id", requireAuth, async (req, res) => {
  const { id } = req.params;
  if (!isId(id)) return res.status(400).json({ ok: false, error: "id inválido" });

  try {
    const item = await Alert.findById(id).lean();
    if (!item) return res.status(404).json({ ok: false, error: "no_encontrado" });
    if (item.kind !== "incident") return res.status(400).json({ ok: false, error: "tipo_incorrecto" });

    return res.json({ ok: true, data: item });
  } catch (err) {
    console.error("[incidentes:get] error:", err);
    return res.status(500).json({ ok: false, error: err?.message || "internal_error" });
  }
});

/**
 * PATCH /api/incidentes/:id
 * (status: open|ack|closed)
 */
r.patch("/:id", requireAuth, async (req, res) => {
  const { id } = req.params;
  if (!isId(id)) return res.status(400).json({ ok: false, error: "id inválido" });

  try {
    const allowed = ["status", "severity", "message", "meta", "geo", "title"];
    const $set = {};
    for (const k of allowed) if (k in req.body) $set[k] = req.body[k];
    if (!Object.keys($set).length) {
      return res.status(400).json({ ok: false, error: "sin_cambios" });
    }

    const item = await Alert.findById(id);
    if (!item) return res.status(404).json({ ok: false, error: "no_encontrado" });
    if (item.kind !== "incident") return res.status(400).json({ ok: false, error: "tipo_incorrecto" });

    Object.assign(item, $set);

    // cierre básico si corresponde
    if ($set.status === "closed" && typeof item.close === "function") {
      item.close({ by: req.user?.id || req.user?.sub || "system", note: "closed via API" });
    }

    await item.save();

    try { req.io?.emit?.("rondas:incident:update", { _id: item._id, status: item.status, severity: item.severity }); } catch {}

    return res.json({ ok: true, data: item });
  } catch (err) {
    console.error("[incidentes:update] error:", err);
    return res.status(500).json({ ok: false, error: err?.message || "internal_error" });
  }
});

/**
 * POST /api/incidentes/:id/ack
 */
r.post("/:id/ack", requireAuth, async (req, res) => {
  const { id } = req.params;
  if (!isId(id)) return res.status(400).json({ ok: false, error: "id inválido" });

  try {
    const it = await Alert.findById(id);
    if (!it) return res.status(404).json({ ok: false, error: "no_encontrado" });
    if (it.kind !== "incident") return res.status(400).json({ ok: false, error: "tipo_incorrecto" });

    it.status = "ack";
    await it.save();

    try { req.io?.emit?.("rondas:incident:update", { _id: it._id, status: it.status }); } catch {}
    return res.json({ ok: true, data: it });
  } catch (err) {
    console.error("[incidentes:ack] error:", err);
    return res.status(500).json({ ok: false, error: err?.message || "internal_error" });
  }
});

/**
 * POST /api/incidentes/:id/close
 */
r.post("/:id/close", requireAuth, async (req, res) => {
  const { id } = req.params;
  const { note } = req.body || {};
  if (!isId(id)) return res.status(400).json({ ok: false, error: "id inválido" });

  try {
    const it = await Alert.findById(id);
    if (!it) return res.status(404).json({ ok: false, error: "no_encontrado" });
    if (it.kind !== "incident") return res.status(400).json({ ok: false, error: "tipo_incorrecto" });

    if (typeof it.close === "function") {
      it.close({ by: req.user?.id || req.user?.sub || "system", note: note || "closed via API" });
    } else {
      it.status = "closed";
      await it.save();
    }

    try { req.io?.emit?.("rondas:incident:closed", { _id: it._id }); } catch {}
    return res.json({ ok: true, data: it });
  } catch (err) {
    console.error("[incidentes:close] error:", err);
    return res.status(500).json({ ok: false, error: err?.message || "internal_error" });
  }
});

export default r;

/**
 * Helper opcional para montarlo en varias rutas.
 * En tu server principal:
 *
 *   import incidentesRouter, { mountIncidentes } from './routes/incidentes.routes.js'
 *   mountIncidentes(app); // monta /api/incidentes y /api/rondas/v1/incidents
 *
 *   // o manual:
 *   app.use('/api/incidentes', incidentesRouter);
 *   app.use('/api/rondas/v1/incidents', incidentesRouter);
 */
export function mountIncidentes(app) {
  app.use("/api/incidentes", r);
  app.use("/api/rondas/v1/incidents", r);
}
