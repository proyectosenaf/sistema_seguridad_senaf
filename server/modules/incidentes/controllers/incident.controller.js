// server/modules/incidentes/controllers/incident.controller.js
import fs from "node:fs";
import path from "node:path";
import IncidentGlobal from "../models/incident.model.js";

const uploadDir = path.resolve(process.cwd(), "uploads", "incidentes");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

function saveBase64ToFile(dataUrlOrB64, prefix, i, defaultExt) {
  try {
    if (typeof dataUrlOrB64 !== "string") return null;

    // data:<mime>;base64,<data>
    const m = dataUrlOrB64.match(/^data:([^;]+);base64,(.+)$/);
    const mime = m?.[1] || "";
    const data = m?.[2] || dataUrlOrB64;

    let ext = defaultExt;
    if (mime.includes("/")) {
      ext = mime
        .split("/")[1]
        .replace("mpeg", "mp3")
        .replace("jpeg", "jpg");
    }

    const filename = `${prefix}_${Date.now()}_${i}.${ext}`;
    const filePath = path.join(uploadDir, filename);

    fs.writeFileSync(filePath, Buffer.from(data, "base64"));

    return {
      url: `/uploads/incidentes/${filename}`,
      mimeType: mime || "",
    };
  } catch (e) {
    console.warn("[incidentes-global] saveBase64ToFile error:", e?.message || e);
    return null;
  }
}

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
    uploadedAt: uploadedAt instanceof Date ? uploadedAt : new Date(uploadedAt || Date.now()),
  };
}

function appendLegacyBase64Evidence(body, evidences) {
  const photosBase64 = normalizeList(body.photosBase64);
  for (let i = 0; i < photosBase64.length; i++) {
    const saved = saveBase64ToFile(photosBase64[i], "img", i, "png");
    if (saved?.url) {
      evidences.push(
        buildEvidenceItem({
          kind: "photo",
          url: saved.url,
          mimeType: saved.mimeType || "image/png",
        })
      );
    }
  }

  const videosBase64 = normalizeList(body.videosBase64);
  for (let i = 0; i < videosBase64.length; i++) {
    const saved = saveBase64ToFile(videosBase64[i], "vid", i, "webm");
    if (saved?.url) {
      evidences.push(
        buildEvidenceItem({
          kind: "video",
          url: saved.url,
          mimeType: saved.mimeType || "video/webm",
        })
      );
    }
  }

  const audiosBase64 = normalizeList(body.audiosBase64);
  for (let i = 0; i < audiosBase64.length; i++) {
    const saved = saveBase64ToFile(audiosBase64[i], "aud", i, "webm");
    if (saved?.url) {
      evidences.push(
        buildEvidenceItem({
          kind: "audio",
          url: saved.url,
          mimeType: saved.mimeType || "audio/webm",
        })
      );
    }
  }
}

function appendNormalizedInputEvidence(input, evidences) {
  const list = normalizeList(input);

  for (let i = 0; i < list.length; i++) {
    const ev = list[i];
    if (!ev || typeof ev !== "object") continue;

    const kind = normalizeEvidenceKind(ev.kind);
    const raw = ev.base64 || ev.url || ev.src || null;

    if (!raw || typeof raw !== "string") continue;

    // Si ya es URL relativa guardada
    if (raw.startsWith("/uploads/incidentes/")) {
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

    // Si viene en dataURL/base64, guardarlo
    if (!raw.startsWith("data:")) continue;

    const saved = saveBase64ToFile(
      raw,
      kind === "photo" ? "img" : kind === "video" ? "vid" : "aud",
      i,
      kind === "photo" ? "png" : kind === "video" ? "webm" : "webm"
    );

    if (!saved?.url) continue;

    evidences.push(
      buildEvidenceItem({
        kind,
        url: saved.url,
        originalName: ev.originalName || "",
        mimeType: ev.mimeType || saved.mimeType || "",
        size: ev.size || 0,
      })
    );
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
    return res.status(500).json({ ok: false, error: "Error obteniendo incidentes" });
  }
}

// POST /api/incidentes
export async function createIncident(req, res) {
  try {
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
      return res.status(400).json({ ok: false, error: "description es requerido" });
    }

    if (!reportedBy) {
      return res.status(400).json({ ok: false, error: "reportedBy es requerido" });
    }

    const evidences = [];

    // compat si algún día llega multipart por multer
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

    // compat legacy
    appendLegacyBase64Evidence(body, evidences);

    // formato nuevo normalizado
    appendNormalizedInputEvidence(body.evidences, evidences);

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

    return res.status(201).json({ ok: true, item });
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
      return res.status(404).json({ ok: false, error: "Incidente no encontrado" });
    }

    let nextEvidences = Array.isArray(current.evidences) ? [...current.evidences] : [];

    const hasNormalizedEvidences = Array.isArray(body.evidences);
    const hasLegacyArrays =
      Array.isArray(body.photosBase64) ||
      Array.isArray(body.videosBase64) ||
      Array.isArray(body.audiosBase64);

    if (hasNormalizedEvidences || hasLegacyArrays) {
      nextEvidences = [];

      // compat legacy
      appendLegacyBase64Evidence(body, nextEvidences);

      // nuevo formato
      appendNormalizedInputEvidence(body.evidences, nextEvidences);
    }

    const updates = {
      ...(body.type != null ? { type: String(body.type).trim() } : {}),
      ...(body.description != null ? { description: String(body.description).trim() } : {}),
      ...(body.reportedBy != null ? { reportedBy: String(body.reportedBy).trim() } : {}),
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

    return res.json({ ok: true, item: normalizeIncidentOutput(updated) });
  } catch (err) {
    console.error("[incidentes-global] updateIncident:", err);
    return res.status(500).json({ ok: false, error: "Error actualizando incidente" });
  }
}

// DELETE /api/incidentes/:id
export async function deleteIncident(req, res) {
  try {
    const { id } = req.params;

    const deleted = await IncidentGlobal.findByIdAndDelete(id).lean();
    if (!deleted) {
      return res.status(404).json({ ok: false, error: "Incidente no encontrado" });
    }

    const allFiles = Array.isArray(deleted.evidences)
      ? deleted.evidences.map((e) => e?.url).filter(Boolean)
      : [];

    for (const rel of allFiles) {
      try {
        if (typeof rel !== "string") continue;
        const clean = rel.replace(/^\//, "");
        const abs = path.resolve(process.cwd(), clean);
        if (abs.startsWith(uploadDir) && fs.existsSync(abs)) fs.unlinkSync(abs);
      } catch (e) {
        console.warn("[incidentes-global] error borrando archivo:", e?.message || e);
      }
    }

    return res.json({ ok: true, id });
  } catch (err) {
    console.error("[incidentes-global] deleteIncident:", err);
    return res.status(500).json({ ok: false, error: "Error eliminando incidente" });
  }
}