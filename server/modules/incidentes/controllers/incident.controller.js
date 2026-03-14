// server/modules/incidentes/controllers/incident.controller.js
import fs from "node:fs";
import path from "node:path";
import IncidentGlobal from "../models/incident.model.js";

const uploadDir = path.resolve(process.cwd(), "uploads", "incidentes");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

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
  originalName = "",
  mimeType = "",
  size = 0,
  uploadedAt = new Date(),
}) {
  return {
    kind: normalizeEvidenceKind(kind),
    url: String(url || "").trim(),
    originalName: String(originalName || "").trim(),
    mimeType: String(mimeType || "").trim(),
    size: Number(size || 0),
    uploadedAt:
      uploadedAt instanceof Date ? uploadedAt : new Date(uploadedAt || Date.now()),
  };
}

/**
 * Compat legacy:
 * body.photosBase64 / videosBase64 / audiosBase64
 *
 * Ahora se conservan inline como data URL para no depender
 * del filesystem efímero en producción.
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
        mimeType: guessMimeFromDataUrl(raw, "audio/webm"),
      })
    );
  }
}

/**
 * Formato nuevo:
 * body.evidences = [{ kind, base64|url|src, ... }]
 *
 * PRIORIDAD:
 *   1) base64
 *   2) url
 *   3) src
 *
 * Si viene data URL, se conserva inline.
 */
function appendNormalizedInputEvidence(input, evidences) {
  const list = normalizeList(input);

  for (let i = 0; i < list.length; i++) {
    const ev = list[i];
    if (!ev || typeof ev !== "object") continue;

    const kind = normalizeEvidenceKind(ev.kind);

    // prioridad explícita
    const raw =
      typeof ev.base64 === "string" && ev.base64.trim()
        ? ev.base64.trim()
        : typeof ev.url === "string" && ev.url.trim()
        ? ev.url.trim()
        : typeof ev.src === "string" && ev.src.trim()
        ? ev.src.trim()
        : "";

    if (!raw) continue;

    // URLs locales ya existentes
    if (isUploadsIncidentUrl(raw)) {
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
      continue;
    }

    // Data URL inline
    if (isDataUrl(raw)) {
      evidences.push(
        buildEvidenceItem({
          kind,
          url: raw,
          originalName: ev.originalName || "",
          mimeType: ev.mimeType || guessMimeFromDataUrl(raw, ""),
          size: ev.size || 0,
          uploadedAt: ev.uploadedAt || new Date(),
        })
      );
      continue;
    }

    // URL remota
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

function normalizeIncidentOutput(item) {
  if (!item || typeof item !== "object") return item;

  const evidences = Array.isArray(item.evidences) ? item.evidences : [];

  return {
    ...item,
    evidences,
    evidenceCount: evidences.length,
  };
}

// GET /api/incidentes
export async function getAllIncidents(req, res) {
  try {
    const limit = clampInt(req.query.limit, { min: 1, max: 2000, fallback: 500 });

    const itemsRaw = await IncidentGlobal.find()
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
    });
  }
}

// POST /api/incidentes
export async function createIncident(req, res) {
  try {
    console.log("[INCIDENTES] createIncident INLINE_DATAURL_V3 activo");

    const body = req.body || {};

    const type = String(body.type || "Incidente").trim();
    const description = String(body.description || "").trim();

    const reportedBy =
      String(body.reportedBy || "").trim() ||
      (req?.user?.email ? `user:${req.user.email}` : "");

    const zone = String(body.zone || "").trim() || "N/A";
    const priority = String(body.priority || "media").trim();
    const status = String(body.status || "abierto").trim();

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

    // Compat multipart real (multer)
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

    // Compat legacy
    appendLegacyBase64Evidence(body, evidences);

    // Formato nuevo normalizado
    appendNormalizedInputEvidence(body.evidences, evidences);

    console.log(
      "[INCIDENTES] evidences procesadas:",
      evidences.map((e) => ({
        kind: e.kind,
        urlPreview: String(e.url || "").slice(0, 80),
        mimeType: e.mimeType,
      }))
    );

    const created = await IncidentGlobal.create({
      type,
      description,
      reportedBy,
      zone,
      priority,
      status,
      evidences,
      date: new Date(),
      source: String(body.source || body.origin || "incidentes").trim(),
      rondaId: body.rondaId || null,
    });

    const item = normalizeIncidentOutput(created.toObject());

    return res.status(201).json({
      ok: true,
      item,
      debugCreateIncidentVersion: "INLINE_DATAURL_V3",
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

    let nextEvidences = Array.isArray(current.evidences) ? [...current.evidences] : [];

    const hasNormalizedEvidences = Array.isArray(body.evidences);
    const hasLegacyArrays =
      Array.isArray(body.photosBase64) ||
      Array.isArray(body.videosBase64) ||
      Array.isArray(body.audiosBase64);

    if (hasNormalizedEvidences || hasLegacyArrays) {
      nextEvidences = [];

      appendLegacyBase64Evidence(body, nextEvidences);
      appendNormalizedInputEvidence(body.evidences, nextEvidences);
    }

    const updates = {
      ...(body.type != null ? { type: String(body.type).trim() } : {}),
      ...(body.description != null
        ? { description: String(body.description).trim() }
        : {}),
      ...(body.reportedBy != null
        ? { reportedBy: String(body.reportedBy).trim() }
        : {}),
      ...(body.zone != null ? { zone: String(body.zone).trim() || "N/A" } : {}),
      ...(body.priority != null ? { priority: String(body.priority).trim() } : {}),
      ...(body.status != null ? { status: String(body.status).trim() } : {}),
      ...(body.source != null || body.origin != null
        ? { source: String(body.source || body.origin || "incidentes").trim() }
        : {}),
      ...(body.rondaId !== undefined ? { rondaId: body.rondaId || null } : {}),
    };

    if (hasNormalizedEvidences || hasLegacyArrays) {
      updates.evidences = nextEvidences;
    }

    const updated = await IncidentGlobal.findByIdAndUpdate(id, updates, {
      new: true,
    }).lean();

    return res.json({
      ok: true,
      item: normalizeIncidentOutput(updated),
      debugUpdateIncidentVersion: "INLINE_DATAURL_V3",
    });
  } catch (err) {
    console.error("[incidentes-global] updateIncident:", err);
    return res.status(500).json({
      ok: false,
      error: "Error actualizando incidente",
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

    return res.json({
      ok: true,
      id,
      debugDeleteIncidentVersion: "INLINE_DATAURL_V3",
    });
  } catch (err) {
    console.error("[incidentes-global] deleteIncident:", err);
    return res.status(500).json({
      ok: false,
      error: "Error eliminando incidente",
    });
  }
}