import fs from "node:fs";
import path from "node:path";
import IncidentGlobal from "../models/incident.model.js";
import { logBitacoraEvent } from "../../bitacora/services/bitacora.service.js";

const uploadDir = path.resolve(process.cwd(), "uploads", "incidentes");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

/* ───────────────────────── Helpers ───────────────────────── */

function normalizeList(val) {
  if (!val) return [];
  if (Array.isArray(val)) return val;

  if (typeof val === "string") {
    try {
      const parsed = JSON.parse(val);
      return Array.isArray(parsed) ? parsed : [val];
    } catch {
      return [val];
    }
  }

  return [];
}

function clampInt(n, { min = 1, max = 1000, fallback = 100 } = {}) {
  const x = Number(n);
  if (!Number.isFinite(x)) return fallback;
  return Math.max(min, Math.min(max, Math.trunc(x)));
}

function normalizeEvidenceKind(kind) {
  const k = String(kind || "").trim().toLowerCase();
  if (k === "photo" || k === "image") return "photo";
  if (k === "video") return "video";
  if (k === "audio") return "audio";
  return "photo";
}

function isDataUrl(value) {
  return typeof value === "string" && /^data:[^;]+;base64,/.test(value);
}

function isUploadsIncidentUrl(value) {
  return typeof value === "string" && value.startsWith("/uploads/incidentes/");
}

function isHttpUrl(value) {
  return typeof value === "string" && /^https?:\/\//i.test(value);
}

function guessMimeFromDataUrl(value, fallback = "") {
  if (!isDataUrl(value)) return fallback;
  const m = String(value).match(/^data:([^;]+);base64,/);
  return m?.[1] || fallback;
}

function buildEvidenceItem({
  kind,
  url,
  base64 = "",
  originalName = "",
  mimeType = "",
  size = 0,
  uploadedAt = new Date(),
}) {
  return {
    kind: normalizeEvidenceKind(kind),
    url: String(url || "").trim(),
    base64: String(base64 || "").trim(),
    originalName: String(originalName || "").trim(),
    mimeType: String(mimeType || "").trim(),
    size: Number(size || 0),
    uploadedAt:
      uploadedAt instanceof Date
        ? uploadedAt
        : new Date(uploadedAt || Date.now()),
  };
}

function normalizeIncidentOutput(item) {
  if (!item || typeof item !== "object") return item;

  const evidences = Array.isArray(item.evidences) ? item.evidences : [];

  return {
    ...item,
    evidences,
    evidenceCount: evidences.length,
  };
}

function toPlain(doc) {
  if (!doc) return null;
  if (typeof doc.toObject === "function") return doc.toObject();
  return JSON.parse(JSON.stringify(doc));
}

function safeTrim(value, fallback = "") {
  return String(value || "").trim() || fallback;
}

function safeLower(value, fallback = "") {
  return String(value || "").trim().toLowerCase() || fallback;
}

function getActorId(req) {
  return String(
    req?.user?.sub ||
      req?.user?._id ||
      req?.user?.id ||
      req?.auth?.sub ||
      req?.auth?._id ||
      req?.auth?.id ||
      ""
  ).trim();
}

function getActorEmail(req) {
  return String(req?.user?.email || req?.auth?.email || "").trim().toLowerCase();
}

function getActorName(req, fallback = "Sistema") {
  return (
    req?.user?.name ||
    req?.user?.nombreCompleto ||
    req?.auth?.name ||
    req?.auth?.nombreCompleto ||
    req?.user?.email ||
    req?.auth?.email ||
    fallback
  );
}

function mapPriorityToBitacora(priority) {
  const p = String(priority || "").trim().toLowerCase();
  if (["alta", "high", "critical", "critica", "crítica"].includes(p)) {
    return "Alta";
  }
  if (["media", "medium"].includes(p)) {
    return "Media";
  }
  return "Baja";
}

function mapStatusToBitacora(status) {
  const s = String(status || "").trim().toLowerCase();

  if (["abierto", "open"].includes(s)) return "Abierto";
  if (["en_proceso", "en proceso", "in_progress", "in progress"].includes(s)) {
    return "En Proceso";
  }
  if (["cerrado", "closed", "resuelto", "resolved"].includes(s)) {
    return "Resuelto";
  }

  return "Abierto";
}

async function auditIncident(req, payload = {}) {
  await logBitacoraEvent({
    modulo: "Gestión de Incidentes",
    tipo: "Incidente",
    accion: payload.accion || "CREAR",
    entidad: payload.entidad || "Incidente",
    entidadId: payload.entidadId || "",
    agente: payload.agente || getActorName(req, "Sistema"),
    actorId: getActorId(req),
    actorEmail: getActorEmail(req),
    titulo: payload.titulo || "",
    descripcion: payload.descripcion || "",
    prioridad: payload.prioridad || "Media",
    estado: payload.estado || "Abierto",
    nombre: payload.nombre || "",
    empresa: payload.empresa || "",
    source: payload.source || "incidentes",
    ip: req.ip || "",
    userAgent: req.get("user-agent") || "",
    before: payload.before || null,
    after: payload.after || null,
    meta: payload.meta || {},
  });
}

/**
 * Compat legacy:
 * body.photosBase64 / videosBase64 / audiosBase64
 */
function appendLegacyBase64Evidence(body, evidences) {
  const photosBase64 = normalizeList(body.photosBase64);
  for (let i = 0; i < photosBase64.length; i++) {
    const raw = photosBase64[i];
    if (!isDataUrl(raw)) continue;

    evidences.push(
      buildEvidenceItem({
        kind: "photo",
        url: raw,
        base64: raw,
        mimeType: guessMimeFromDataUrl(raw, "image/jpeg"),
      })
    );
  }

  const videosBase64 = normalizeList(body.videosBase64);
  for (let i = 0; i < videosBase64.length; i++) {
    const raw = videosBase64[i];
    if (!isDataUrl(raw)) continue;

    evidences.push(
      buildEvidenceItem({
        kind: "video",
        url: raw,
        base64: raw,
        mimeType: guessMimeFromDataUrl(raw, "video/webm"),
      })
    );
  }

  const audiosBase64 = normalizeList(body.audiosBase64);
  for (let i = 0; i < audiosBase64.length; i++) {
    const raw = audiosBase64[i];
    if (!isDataUrl(raw)) continue;

    evidences.push(
      buildEvidenceItem({
        kind: "audio",
        url: raw,
        base64: raw,
        mimeType: guessMimeFromDataUrl(raw, "audio/webm"),
      })
    );
  }
}

/**
 * Formato nuevo:
 * body.evidences = [{ kind, base64|url|src, ... }]
 */
function appendNormalizedInputEvidence(input, evidences) {
  const list = normalizeList(input);

  for (let i = 0; i < list.length; i++) {
    const ev = list[i];
    if (!ev || typeof ev !== "object") continue;

    const kind = normalizeEvidenceKind(ev.kind);

    const raw =
      typeof ev.base64 === "string" && ev.base64.trim()
        ? ev.base64.trim()
        : typeof ev.url === "string" && ev.url.trim()
        ? ev.url.trim()
        : typeof ev.src === "string" && ev.src.trim()
        ? ev.src.trim()
        : "";

    if (!raw) continue;

    if (isUploadsIncidentUrl(raw)) {
      evidences.push(
        buildEvidenceItem({
          kind,
          url: raw,
          base64: isDataUrl(raw) ? raw : "",
          originalName: ev.originalName || "",
          mimeType: ev.mimeType || "",
          size: ev.size || 0,
          uploadedAt: ev.uploadedAt || new Date(),
        })
      );
      continue;
    }

    if (isDataUrl(raw)) {
      evidences.push(
        buildEvidenceItem({
          kind,
          url: raw,
          base64: raw,
          originalName: ev.originalName || "",
          mimeType: ev.mimeType || guessMimeFromDataUrl(raw, ""),
          size: ev.size || 0,
          uploadedAt: ev.uploadedAt || new Date(),
        })
      );
      continue;
    }

    if (isHttpUrl(raw)) {
      evidences.push(
        buildEvidenceItem({
          kind,
          url: raw,
          originalName: ev.originalName || "",
          mimeType: ev.mimeType || "",
          size: ev.size || 0,
          uploadedAt: ev.uploadedAt || new Date(),
        })
      );
    }
  }
}

function buildScopeQuery(req) {
  const scope = req?.incidentScope || {};
  if (scope.canReadAny) return {};

  const userId = String(scope.userId || "").trim();
  const userEmail = String(scope.userEmail || "").trim().toLowerCase();

  const or = [];

  if (userId) {
    or.push(
      { createdByUserId: userId },
      { reportedByGuardId: userId },
      { guardId: userId },
      { reportedByUserId: userId }
    );
  }

  if (userEmail) {
    or.push(
      { reportedByGuardEmail: userEmail },
      { guardEmail: userEmail }
    );
  }

  if (or.length === 0) {
    return { _id: null };
  }

  return { $or: or };
}

function dedupeEvidences(evidences = []) {
  const seen = new Set();
  const out = [];

  for (const ev of evidences) {
    const key = [
      normalizeEvidenceKind(ev?.kind),
      String(ev?.url || "").trim(),
      String(ev?.originalName || "").trim(),
      String(ev?.mimeType || "").trim(),
      Number(ev?.size || 0),
    ].join("|");

    if (!key.replace(/\|/g, "")) continue;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(ev);
  }

  return out;
}

// GET /api/incidentes
export async function getAllIncidents(req, res) {
  try {
    const limit = clampInt(req.query.limit, {
      min: 1,
      max: 2000,
      fallback: 500,
    });

    const query = buildScopeQuery(req);

    const itemsRaw = await IncidentGlobal.find(query)
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    const items = itemsRaw.map(normalizeIncidentOutput);

    return res.json({ ok: true, items, limit });
  } catch (err) {
    console.error("[incidentes-global] getAllIncidents:", err);
    return res.status(500).json({
      ok: false,
      error: "Error obteniendo incidentes",
      detail: err?.message || String(err),
    });
  }
}

// POST /api/incidentes
export async function createIncident(req, res) {
  try {
    const body = req.body || {};

    const actorId = getActorId(req);
    const actorEmail = getActorEmail(req);

    const type = safeTrim(body.type, "Incidente");
    const description = safeTrim(body.description);
    const zone = safeTrim(body.zone, "N/A");
    const priority = safeTrim(body.priority, "media").toLowerCase();
    const status = safeTrim(body.status, "abierto").toLowerCase();

    const reportedBy = safeTrim(
      body.reportedBy,
      actorEmail ? `user:${actorEmail}` : ""
    );

    const reportedByGuardId = safeTrim(
      body.reportedByGuardId || body.guardId,
      actorId
    );

    const reportedByGuardName = safeTrim(
      body.reportedByGuardName || body.guardName || body.reportedBy
    );

    const reportedByGuardEmail = safeLower(
      body.reportedByGuardEmail || body.guardEmail,
      actorEmail
    );

    const guardId = safeTrim(body.guardId, reportedByGuardId);
    const guardName = safeTrim(body.guardName, reportedByGuardName);
    const guardEmail = safeLower(body.guardEmail, reportedByGuardEmail);

    const createdByUserId = safeTrim(body.createdByUserId, actorId);
    const reportedByUserId = safeTrim(body.reportedByUserId, actorId);

    if (!description) {
      return res.status(400).json({
        ok: false,
        error: "description es requerido",
      });
    }

    if (!reportedBy) {
      return res.status(400).json({
        ok: false,
        error: "reportedBy es requerido",
      });
    }

    const evidences = [];

    if (Array.isArray(req.files)) {
      for (let i = 0; i < req.files.length; i++) {
        const f = req.files[i];
        const mime = String(f?.mimetype || "").toLowerCase();

        let kind = "photo";
        if (mime.startsWith("video/")) kind = "video";
        else if (mime.startsWith("audio/")) kind = "audio";

        evidences.push(
          buildEvidenceItem({
            kind,
            url: `/uploads/incidentes/${f.filename}`,
            originalName: f.originalname || "",
            mimeType: f.mimetype || "",
            size: f.size || 0,
          })
        );
      }
    }

    appendLegacyBase64Evidence(body, evidences);
    appendNormalizedInputEvidence(body.evidences, evidences);

    const finalEvidences = dedupeEvidences(evidences);

    const created = await IncidentGlobal.create({
      type,
      description,
      reportedBy,

      reportedByGuardId,
      reportedByGuardName,
      reportedByGuardEmail,

      guardId,
      guardName,
      guardEmail,

      createdByUserId,
      reportedByUserId,

      zone,
      priority,
      status,

      evidences: finalEvidences,

      photosBase64: normalizeList(body.photosBase64),
      videosBase64: normalizeList(body.videosBase64),
      audiosBase64: normalizeList(body.audiosBase64),

      date: new Date(),
      source: safeTrim(body.source || body.origin, "incidentes"),
      origin: safeTrim(body.origin, ""),
      rondaId: body.rondaId || null,
    });

    try {
      await auditIncident(req, {
        accion: "CREAR",
        entidad: "Incidente",
        entidadId: created._id?.toString(),
        agente: getActorName(req, reportedBy || "Sistema"),
        titulo: "Incidente creado",
        descripcion: `Incidente tipo "${type}" en zona "${zone}". Detalle: ${description}.`,
        prioridad: mapPriorityToBitacora(priority),
        estado: mapStatusToBitacora(status),
        nombre: reportedBy || "",
        empresa: zone || "",
        source: "incidentes",
        after: toPlain(created),
        meta: {
          rondaId: body.rondaId || null,
          evidenceCount: finalEvidences.length,
          incidentType: type,
          reportedByGuardId,
          createdByUserId,
        },
      });
    } catch (auditErr) {
      console.error("[incidentes-global] auditIncident(create) falló:", auditErr);
    }

    const item = normalizeIncidentOutput(created.toObject());

    return res.status(201).json({
      ok: true,
      item,
      debugCreateIncidentVersion: "INLINE_DATAURL_V5_SCOPE",
    });
  } catch (err) {
    console.error("[incidentes-global] createIncident:", err);
    return res.status(500).json({
      ok: false,
      error: "Error creando incidente",
      detail: err?.message || String(err),
    });
  }
}

// PUT /api/incidentes/:id
export async function updateIncident(req, res) {
  try {
    const { id } = req.params;
    const body = req.body || {};

    const current = await IncidentGlobal.findById(id);
    if (!current) {
      return res.status(404).json({
        ok: false,
        error: "Incidente no encontrado",
      });
    }

    const before = toPlain(current);

    let nextEvidences = Array.isArray(current.evidences)
      ? [...current.evidences]
      : [];

    const hasNormalizedEvidences = Array.isArray(body.evidences);
    const hasLegacyArrays =
      Array.isArray(body.photosBase64) ||
      Array.isArray(body.videosBase64) ||
      Array.isArray(body.audiosBase64);

    if (hasNormalizedEvidences || hasLegacyArrays) {
      nextEvidences = [];
      appendLegacyBase64Evidence(body, nextEvidences);
      appendNormalizedInputEvidence(body.evidences, nextEvidences);
      nextEvidences = dedupeEvidences(nextEvidences);
    }

    const updates = {
      ...(body.type != null ? { type: safeTrim(body.type) } : {}),
      ...(body.description != null ? { description: safeTrim(body.description) } : {}),
      ...(body.reportedBy != null ? { reportedBy: safeTrim(body.reportedBy) } : {}),
      ...(body.reportedByGuardId != null
        ? { reportedByGuardId: safeTrim(body.reportedByGuardId) }
        : {}),
      ...(body.reportedByGuardName != null
        ? { reportedByGuardName: safeTrim(body.reportedByGuardName) }
        : {}),
      ...(body.reportedByGuardEmail != null
        ? { reportedByGuardEmail: safeLower(body.reportedByGuardEmail) }
        : {}),
      ...(body.guardId != null ? { guardId: safeTrim(body.guardId) } : {}),
      ...(body.guardName != null ? { guardName: safeTrim(body.guardName) } : {}),
      ...(body.guardEmail != null ? { guardEmail: safeLower(body.guardEmail) } : {}),
      ...(body.createdByUserId != null
        ? { createdByUserId: safeTrim(body.createdByUserId) }
        : {}),
      ...(body.reportedByUserId != null
        ? { reportedByUserId: safeTrim(body.reportedByUserId) }
        : {}),
      ...(body.zone != null ? { zone: safeTrim(body.zone, "N/A") } : {}),
      ...(body.priority != null ? { priority: safeTrim(body.priority).toLowerCase() } : {}),
      ...(body.status != null ? { status: safeTrim(body.status).toLowerCase() } : {}),
      ...(body.source != null || body.origin != null
        ? {
            source: safeTrim(body.source || body.origin, "incidentes"),
          }
        : {}),
      ...(body.origin != null ? { origin: safeTrim(body.origin) } : {}),
      ...(body.rondaId !== undefined ? { rondaId: body.rondaId || null } : {}),
    };

    if (hasNormalizedEvidences || hasLegacyArrays) {
      updates.evidences = nextEvidences;
      updates.photosBase64 = normalizeList(body.photosBase64);
      updates.videosBase64 = normalizeList(body.videosBase64);
      updates.audiosBase64 = normalizeList(body.audiosBase64);
    }

    const updated = await IncidentGlobal.findByIdAndUpdate(id, updates, {
      new: true,
    }).lean();

    try {
      await auditIncident(req, {
        accion: "ACTUALIZAR",
        entidad: "Incidente",
        entidadId: updated?._id?.toString() || id,
        agente: getActorName(req, updated?.reportedBy || "Sistema"),
        titulo: "Incidente actualizado",
        descripcion: `Se actualizó el incidente "${
          updated?.type || "Incidente"
        }" en zona "${updated?.zone || "N/D"}".`,
        prioridad: mapPriorityToBitacora(updated?.priority),
        estado: mapStatusToBitacora(updated?.status),
        nombre: updated?.reportedBy || "",
        empresa: updated?.zone || "",
        source: "incidentes",
        before,
        after: updated,
        meta: {
          rondaId: updated?.rondaId || null,
          evidenceCount: Array.isArray(updated?.evidences)
            ? updated.evidences.length
            : 0,
          incidentType: updated?.type || "",
          reportedByGuardId: updated?.reportedByGuardId || "",
          createdByUserId: updated?.createdByUserId || "",
        },
      });
    } catch (auditErr) {
      console.error("[incidentes-global] auditIncident(update) falló:", auditErr);
    }

    return res.json({
      ok: true,
      item: normalizeIncidentOutput(updated),
      debugUpdateIncidentVersion: "INLINE_DATAURL_V5_SCOPE",
    });
  } catch (err) {
    console.error("[incidentes-global] updateIncident:", err);
    return res.status(500).json({
      ok: false,
      error: "Error actualizando incidente",
      detail: err?.message || String(err),
    });
  }
}

// DELETE /api/incidentes/:id
export async function deleteIncident(req, res) {
  try {
    const { id } = req.params;

    const deleted = await IncidentGlobal.findByIdAndDelete(id).lean();
    if (!deleted) {
      return res.status(404).json({
        ok: false,
        error: "Incidente no encontrado",
      });
    }

    const allFiles = Array.isArray(deleted.evidences)
      ? deleted.evidences.map((e) => e?.url).filter(Boolean)
      : [];

    for (const rel of allFiles) {
      try {
        if (typeof rel !== "string") continue;
        if (!isUploadsIncidentUrl(rel)) continue;

        const clean = rel.replace(/^\//, "");
        const abs = path.resolve(process.cwd(), clean);

        if (abs.startsWith(uploadDir) && fs.existsSync(abs)) {
          fs.unlinkSync(abs);
        }
      } catch (e) {
        console.warn(
          "[incidentes-global] error borrando archivo:",
          e?.message || e
        );
      }
    }

    try {
      await auditIncident(req, {
        accion: "ELIMINAR",
        entidad: "Incidente",
        entidadId: deleted?._id?.toString() || id,
        agente: getActorName(req, deleted?.reportedBy || "Sistema"),
        titulo: "Incidente eliminado",
        descripcion: `Se eliminó el incidente "${
          deleted?.type || "Incidente"
        }" de zona "${deleted?.zone || "N/D"}".`,
        prioridad: mapPriorityToBitacora(deleted?.priority),
        estado: "Eliminado",
        nombre: deleted?.reportedBy || "",
        empresa: deleted?.zone || "",
        source: "incidentes",
        before: deleted,
        meta: {
          rondaId: deleted?.rondaId || null,
          evidenceCount: Array.isArray(deleted?.evidences)
            ? deleted.evidences.length
            : 0,
          incidentType: deleted?.type || "",
          reportedByGuardId: deleted?.reportedByGuardId || "",
          createdByUserId: deleted?.createdByUserId || "",
        },
      });
    } catch (auditErr) {
      console.error("[incidentes-global] auditIncident(delete) falló:", auditErr);
    }

    return res.json({
      ok: true,
      id,
      debugDeleteIncidentVersion: "INLINE_DATAURL_V5_SCOPE",
    });
  } catch (err) {
    console.error("[incidentes-global] deleteIncident:", err);
    return res.status(500).json({
      ok: false,
      error: "Error eliminando incidente",
      detail: err?.message || String(err),
    });
  }
}