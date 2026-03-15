// server/modules/rondasqr/index.js
import express from "express";
import mongoose from "mongoose";
import crypto from "node:crypto";
import QRCode from "qrcode";
import PDFDocument from "pdfkit";

import RqPoint from "./models/RqPoint.model.js";
import RqRound from "./models/RqRound.model.js";
import RqSite from "./models/RqSite.model.js";
import RqPlan from "./models/RqPlan.model.js";
import RqMark from "./models/RqMark.model.js";
import RqIncident from "./models/RqIncident.model.js";
import RqDevice from "./models/RqDevice.model.js";

// ⬇️ Rutas de asignaciones (crear/listar/borrar)
import assignmentsRoutes from "./routes/assignments.routes.js";
// ⬇️ Rutas offline
import offlineRoutes from "./routes/rondasqr.offline.routes.js";

const router = express.Router();

/* ─────────── Inyectar io y notifier al request ─────────── */
router.use((req, _res, next) => {
  req.io = req.app.get("io");
  req.notifier = req.app.get("notifier");
  next();
});

/* ───────────────── Auth liviano ───────────────── */
const DISABLE_AUTH = String(process.env.DISABLE_AUTH || "0") === "1";
const IAM_ALLOW_DEV_HEADERS = String(process.env.IAM_ALLOW_DEV_HEADERS || "0") === "1";

function auth(req, _res, next) {
  if (req.user?.email) return next();

  if (DISABLE_AUTH) {
    req.user = {
      sub: req.headers["x-user-id"] || "dev|local",
      email: req.headers["x-user-email"] || "dev@local",
      name: req.headers["x-user-name"] || req.headers["x-user-email"] || "dev",
    };
    return next();
  }

  if (IAM_ALLOW_DEV_HEADERS && req.headers["x-user-email"]) {
    req.user = {
      sub: req.headers["x-user-id"] || "dev|local",
      email: req.headers["x-user-email"],
      name: req.headers["x-user-name"] || req.headers["x-user-email"],
    };
    return next();
  }

  return next();
}

/* ───────────────── Helpers ───────────────── */
function getPointIdFields() {
  const fields = [];
  if (RqPoint.schema.path("qr")) fields.push("qr");
  if (RqPoint.schema.path("qrNo")) fields.push("qrNo");
  if (RqPoint.schema.path("code")) fields.push("code");
  return fields;
}

function normalizeOrder(val) {
  const n = Number(val);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : null;
}

async function nextOrderForRound(roundId) {
  const last = await RqPoint.find({ roundId })
    .sort({ order: -1 })
    .select({ order: 1 })
    .limit(1)
    .lean();

  const max = last[0]?.order ?? -1;
  return max + 1;
}

const isId = (v) => typeof v === "string" && mongoose.Types.ObjectId.isValid(v);

function qrToken() {
  return `qr_${crypto.randomBytes(16).toString("hex")}`;
}

function escapeRegExp(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * ✅ Construye GPS + loc GeoJSON válidos
 * Mongo 2dsphere requiere coordinates = [lon, lat]
 */
function buildGeoFromGps(input) {
  const lat = Number(input?.lat);
  const lon = Number(input?.lon);

  const hasGps = Number.isFinite(lat) && Number.isFinite(lon);

  return {
    gps: hasGps ? { lat, lon } : {},
    loc: hasGps ? { type: "Point", coordinates: [lon, lat] } : undefined,
  };
}

function pointQrValue(point) {
  return String(point?.qr || point?.qrNo || point?.code || "").trim();
}

async function qrPngBufferFromText(text) {
  return QRCode.toBuffer(String(text || ""), {
    type: "png",
    width: 700,
    margin: 2,
    errorCorrectionLevel: "H",
    color: {
      dark: "#000000",
      light: "#FFFFFF",
    },
  });
}

/* ───────────────── PING/DEBUG ───────────────── */
router.get("/ping", (_req, res) => res.json({ ok: true, where: "/api/rondasqr/v1/ping" }));

router.get("/checkin/ping", (_req, res) =>
  res.json({ ok: true, where: "/api/rondasqr/v1/checkin/ping" })
);

router.get("/_debug/routes", (_req, res) => {
  try {
    const stack = (router.stack || [])
      .map((l) => {
        if (l.route) {
          const methods = Object.keys(l.route.methods || {})
            .join(",")
            .toUpperCase();
          return `${methods} ${l.route.path}`;
        }
        if (l.name === "router" && l.regexp) return `USE ${l.regexp}`;
        return null;
      })
      .filter(Boolean);

    res.json({ ok: true, stack });
  } catch (e) {
    res.json({ ok: false, error: e?.message || String(e) });
  }
});

/* ───────────────────── ADMIN (para tu UI) ─────────────────── */
const admin = express.Router();

/** SITES **********************************************************/
admin.get("/sites", auth, async (req, res, next) => {
  try {
    const q = String(req.query.q || "").trim();
    const filter = q
      ? {
          name: {
            $regex: escapeRegExp(q),
            $options: "i",
          },
        }
      : {};

    const items = await RqSite.find(filter).sort({ createdAt: -1 }).lean();
    res.json({ ok: true, items });
  } catch (e) {
    next(e);
  }
});

admin.post("/sites", auth, async (req, res, next) => {
  try {
    const name = String(req.body?.name || "").trim();
    if (!name) {
      return res.status(400).json({ ok: false, error: "name_required" });
    }

    const exists = await RqSite.findOne({
      name: new RegExp(`^${escapeRegExp(name)}$`, "i"),
    }).lean();

    if (exists) {
      return res.status(409).json({ ok: false, error: "site_exists" });
    }

    const doc = await RqSite.create({ name, active: true });
    res.status(201).json({ ok: true, item: doc });
  } catch (e) {
    next(e);
  }
});

admin.delete("/sites/:id", auth, async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!isId(id)) {
      return res.status(400).json({ ok: false, error: "invalid_siteId" });
    }

    const r = await RqSite.deleteOne({ _id: id });
    res.json({ ok: true, deleted: r.deletedCount });
  } catch (e) {
    next(e);
  }
});

/** ROUNDS *********************************************************/
admin.get("/rounds", auth, async (req, res, next) => {
  try {
    const siteId = String(req.query.siteId || "").trim();
    if (siteId && !isId(siteId)) {
      return res.status(400).json({ ok: false, error: "invalid_siteId" });
    }

    const filter = siteId ? { siteId } : {};
    const items = await RqRound.find(filter).sort({ createdAt: -1 }).lean();
    res.json({ ok: true, items });
  } catch (e) {
    next(e);
  }
});

admin.post("/rounds", auth, async (req, res) => {
  try {
    const b = req.body || {};

    const rawSiteIdInput =
      (typeof b.siteId === "string" && b.siteId.trim()) ||
      (typeof b.site_id === "string" && b.site_id.trim()) ||
      "";

    const rawSiteNameInput =
      (typeof b.siteName === "string" && b.siteName.trim()) ||
      (typeof b.site_name === "string" && b.site_name.trim()) ||
      (typeof b.site === "string" && b.site.trim()) ||
      "";

    const name = typeof b.name === "string" ? b.name.trim() : "";
    if (!name) {
      return res.status(400).json({ ok: false, error: "name_required" });
    }

    let site = null;

    if (rawSiteIdInput && mongoose.Types.ObjectId.isValid(rawSiteIdInput)) {
      site = await RqSite.findById(rawSiteIdInput).lean();
      if (!site) {
        return res.status(400).json({ ok: false, error: "site_not_found_by_id" });
      }
    }

    if (!site) {
      const siteNameCandidate = rawSiteNameInput || rawSiteIdInput;
      if (!siteNameCandidate) {
        return res.status(400).json({ ok: false, error: "site_required" });
      }

      site = await RqSite.findOne({
        name: new RegExp(`^${escapeRegExp(siteNameCandidate)}$`, "i"),
      }).lean();

      if (!site) {
        return res.status(400).json({ ok: false, error: "site_not_found_by_name" });
      }
    }

    const exists = await RqRound.findOne({
      siteId: site._id,
      name: new RegExp(`^${escapeRegExp(name)}$`, "i"),
    }).lean();

    if (exists) {
      return res.status(409).json({ ok: false, error: "round_exists" });
    }

    const doc = await RqRound.create({
      siteId: site._id,
      name,
      active: true,
    });

    return res.status(201).json({ ok: true, item: doc });
  } catch (e) {
    console.error("[admin.rounds.create]", e);
    return res.status(500).json({ ok: false, error: e?.message || "internal_error" });
  }
});

admin.delete("/rounds/:id", auth, async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!isId(id)) {
      return res.status(400).json({ ok: false, error: "invalid_roundId" });
    }

    const r = await RqRound.deleteOne({ _id: id });
    res.json({ ok: true, deleted: r.deletedCount });
  } catch (e) {
    next(e);
  }
});

/** POINTS *********************************************************/
admin.get("/points", auth, async (req, res, next) => {
  try {
    const roundId = String(req.query.roundId || "").trim();
    const siteId = String(req.query.siteId || "").trim();

    if (roundId && !isId(roundId)) {
      return res.status(400).json({ ok: false, error: "invalid_roundId" });
    }
    if (siteId && !isId(siteId)) {
      return res.status(400).json({ ok: false, error: "invalid_siteId" });
    }

    const filter = {};
    if (roundId) filter.roundId = roundId;
    if (siteId) filter.siteId = siteId;

    const items = await RqPoint.find(filter).sort({ order: 1, createdAt: 1 }).lean();
    res.json({ ok: true, items });
  } catch (e) {
    next(e);
  }
});

admin.post("/points", auth, async (req, res, next) => {
  try {
    const b = req.body || {};
    const siteId = String(b.siteId || "").trim();
    const roundId = String(b.roundId || "").trim();
    const name = String(b.name || "").trim();

    if (!isId(siteId)) return res.status(400).json({ ok: false, error: "invalid_siteId" });
    if (!isId(roundId)) return res.status(400).json({ ok: false, error: "invalid_roundId" });
    if (!name) return res.status(400).json({ ok: false, error: "name_required" });

    const [site, round] = await Promise.all([
      RqSite.findById(siteId).lean(),
      RqRound.findById(roundId).lean(),
    ]);

    if (!site) return res.status(404).json({ ok: false, error: "site_not_found" });
    if (!round) return res.status(404).json({ ok: false, error: "round_not_found" });

    let order = normalizeOrder(b.order) ?? normalizeOrder(b.ord) ?? normalizeOrder(b.index);
    if (order === null) order = await nextOrderForRound(roundId);

    const rawQr = typeof b.qr === "string" ? b.qr.trim() : "";
    const rawQrNo = typeof b.qrNo === "string" ? b.qrNo.trim() : "";

    const toInsert = {
      siteId,
      roundId,
      name,
      active: true,
      order,
    };

    if (rawQr) toInsert.qr = rawQr;
    if (rawQrNo) toInsert.qrNo = rawQrNo;

    const doc = await RqPoint.create(toInsert);
    res.status(201).json({ ok: true, item: doc });
  } catch (e) {
    if (e?.code === 11000) {
      return res.status(409).json({
        ok: false,
        error: "duplicate_point",
        message: "Ya existe un punto con ese orden o QR dentro de la ronda.",
        details: e?.keyValue || null,
      });
    }
    next(e);
  }
});

admin.patch("/points/:id", auth, async (req, res, next) => {
  try {
    const id = req.params.id;
    if (!isId(id)) {
      return res.status(400).json({ ok: false, error: "invalid_pointId" });
    }

    const b = req.body || {};
    const updates = {};

    if (typeof b.name === "string") updates.name = b.name.trim();
    if (typeof b.notes === "string") updates.notes = b.notes.trim();
    if (typeof b.active === "boolean") updates.active = b.active;

    if (typeof b.qr === "string") updates.qr = b.qr.trim();
    if (typeof b.qrNo === "string") updates.qrNo = b.qrNo.trim();
    if (typeof b.code === "string") updates.code = b.code.trim();

    const order = normalizeOrder(b.order) ?? normalizeOrder(b.ord) ?? normalizeOrder(b.index);
    if (order !== null) updates.order = order;

    if (Object.keys(updates).length === 0) {
      return res.json({
        ok: true,
        item: await RqPoint.findById(id).lean(),
        noChanges: true,
      });
    }

    const doc = await RqPoint.findByIdAndUpdate(id, { $set: updates }, { new: true }).lean();
    res.json({ ok: true, item: doc });
  } catch (e) {
    if (e?.code === 11000) {
      return res.status(409).json({
        ok: false,
        error: "duplicate_point",
        message: "Ya existe un punto con ese orden o QR dentro de la ronda.",
        details: e?.keyValue || null,
      });
    }
    next(e);
  }
});

admin.delete("/points/:id", auth, async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!isId(id)) {
      return res.status(400).json({ ok: false, error: "invalid_pointId" });
    }

    const doc = await RqPoint.findOneAndDelete({ _id: id });
    res.json({ ok: true, deleted: doc ? 1 : 0 });
  } catch (e) {
    next(e);
  }
});

admin.post("/points/:id/rotate-qr", auth, async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!isId(id)) {
      return res.status(400).json({ ok: false, error: "invalid_pointId" });
    }

    if (typeof RqPoint.rotateQr === "function") {
      const { point } = await RqPoint.rotateQr(id);
      return res.json({ ok: true, item: point });
    }

    const point = await RqPoint.findById(id);
    if (!point) {
      return res.status(404).json({ ok: false, error: "point_not_found" });
    }

    point.qr = qrToken();
    if (RqPoint.schema.path("qrNo")) point.qrNo = point.qr;
    if (RqPoint.schema.path("code")) point.code = point.qr;
    if (RqPoint.schema.path("qrVersion")) point.qrVersion = Number(point.qrVersion || 1) + 1;
    if (RqPoint.schema.path("qrRotatedAt")) point.qrRotatedAt = new Date();

    await point.save();
    return res.json({ ok: true, item: point.toJSON ? point.toJSON() : point });
  } catch (e) {
    if (e?.code === 11000) {
      return res.status(409).json({
        ok: false,
        error: "duplicate_point_qr",
        message: "No se pudo rotar QR porque se generó uno duplicado. Intenta de nuevo.",
      });
    }
    next(e);
  }
});

// ✅ eliminar solo el QR del punto, no el punto
admin.delete("/points/:id/qr", auth, async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!isId(id)) {
      return res.status(400).json({ ok: false, error: "invalid_pointId" });
    }

    const point = await RqPoint.findById(id).lean();
    if (!point) {
      return res.status(404).json({ ok: false, error: "point_not_found" });
    }

    const oldQr = pointQrValue(point);
    if (!oldQr) {
      return res.status(400).json({ ok: false, error: "point_qr_not_found" });
    }

    const unset = {};
    if (RqPoint.schema.path("qr")) unset.qr = 1;
    if (RqPoint.schema.path("qrNo")) unset.qrNo = 1;
    if (RqPoint.schema.path("code")) unset.code = 1;

    const set = {};
    if (RqPoint.schema.path("qrDeletedAt")) set.qrDeletedAt = new Date();

    const update = {};
    if (Object.keys(unset).length) update.$unset = unset;
    if (Object.keys(set).length) update.$set = set;

    const updated = await RqPoint.findByIdAndUpdate(id, update, {
      new: true,
      runValidators: false,
    }).lean();

    return res.json({
      ok: true,
      item: updated,
      oldQr,
      message: "QR eliminado correctamente",
    });
  } catch (e) {
    next(e);
  }
});

/** QR PNG *********************************************************/
admin.get("/points/:id/qr.png", auth, async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!isId(id)) {
      return res.status(400).json({ ok: false, error: "invalid_pointId" });
    }

    const point = await RqPoint.findById(id).lean();
    if (!point) {
      return res.status(404).json({ ok: false, error: "point_not_found" });
    }

    const qrValue = pointQrValue(point);
    if (!qrValue) {
      return res.status(404).json({ ok: false, error: "point_qr_not_found" });
    }

    const buffer = await qrPngBufferFromText(qrValue);

    res.setHeader("Content-Type", "image/png");
    res.setHeader("Cache-Control", "no-store");
    return res.end(buffer);
  } catch (e) {
    next(e);
  }
});

/** QR PDF *********************************************************/
admin.get("/points/:id/qr.pdf", auth, async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!isId(id)) {
      return res.status(400).json({ ok: false, error: "invalid_pointId" });
    }

    const point = await RqPoint.findById(id).lean();
    if (!point) {
      return res.status(404).json({ ok: false, error: "point_not_found" });
    }

    const [site, round] = await Promise.all([
      point.siteId ? RqSite.findById(point.siteId).lean() : null,
      point.roundId ? RqRound.findById(point.roundId).lean() : null,
    ]);

    const qrValue = pointQrValue(point);
    if (!qrValue) {
      return res.status(404).json({ ok: false, error: "point_qr_not_found" });
    }

    const pngBuffer = await qrPngBufferFromText(qrValue);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="qr-${id}.pdf"`);
    res.setHeader("Cache-Control", "no-store");

    const doc = new PDFDocument({
      size: "A4",
      margin: 40,
    });

    doc.pipe(res);

    doc.fontSize(20).text("Etiqueta QR del punto", { align: "center" });
    doc.moveDown(1);
    doc.fontSize(12).text(`Sitio: ${site?.name || "-"}`);
    doc.text(`Ronda: ${round?.name || "-"}`);
    doc.text(`Punto: ${point?.name || "-"}`);
    doc.text(`Orden: ${point?.order ?? "-"}`);
    doc.text(`Código QR: ${qrValue}`);
    doc.moveDown(1);

    const imgSize = 260;
    const x = (doc.page.width - imgSize) / 2;

    doc.image(pngBuffer, x, doc.y, {
      fit: [imgSize, imgSize],
      align: "center",
    });

    doc.moveDown(15);
    doc.fontSize(10).fillColor("#444").text("SENAF • Repositorio de códigos QR", {
      align: "center",
    });

    doc.end();
  } catch (e) {
    next(e);
  }
});

// reorder
admin.put("/points/reorder", auth, async (req, res, next) => {
  try {
    const { roundId, pointIds } = req.body || {};
    if (!isId(roundId) || !Array.isArray(pointIds)) {
      return res.status(400).json({
        ok: false,
        error: "roundId_and_pointIds_required",
      });
    }

    const ops = pointIds.map((id, idx) => ({
      updateOne: {
        filter: { _id: id, roundId },
        update: { $set: { order: idx } },
      },
    }));

    if (ops.length) await RqPoint.bulkWrite(ops);
    res.json({ ok: true, count: ops.length });
  } catch (e) {
    if (e?.code === 11000) {
      return res.status(409).json({
        ok: false,
        error: "duplicate_order",
        message: "No se pudo reordenar porque hay conflicto de orden duplicado.",
      });
    }
    next(e);
  }
});

/** ✅ QR REPO ******************************************************
 * GET /admin/qr-repo?siteId=...&roundId=...&format=html
 * - JSON por defecto para frontend
 * - HTML si format=html para imprimir
 */
admin.get("/qr-repo", auth, async (req, res, next) => {
  try {
    const siteId = String(req.query.siteId || "").trim();
    const roundId = String(req.query.roundId || "").trim();
    const format = String(req.query.format || "").trim().toLowerCase();

    if (siteId && !isId(siteId)) {
      return res.status(400).json({ ok: false, error: "invalid_siteId" });
    }

    if (roundId && !isId(roundId)) {
      return res.status(400).json({ ok: false, error: "invalid_roundId" });
    }

    const filter = {};
    if (siteId) filter.siteId = siteId;
    if (roundId) filter.roundId = roundId;

    const [points, sites, rounds] = await Promise.all([
      RqPoint.find(filter).sort({ siteId: 1, roundId: 1, order: 1, createdAt: 1 }).lean(),
      RqSite.find(siteId ? { _id: siteId } : {}).lean(),
      RqRound.find(roundId ? { _id: roundId } : siteId ? { siteId } : {}).lean(),
    ]);

    const siteMap = new Map(sites.map((s) => [String(s._id), s]));
    const roundMap = new Map(rounds.map((r) => [String(r._id), r]));

    const items = points
      .map((p) => {
        const site = siteMap.get(String(p.siteId)) || null;
        const round = roundMap.get(String(p.roundId)) || null;
        const qrValue = pointQrValue(p);

        return {
          ...p,
          id: p._id,
          siteName: site?.name || "",
          roundName: round?.name || "",
          qr: qrValue,
          active: p.active !== false,
        };
      })
      .filter((p) => !!String(p.qr || "").trim());

    if (format === "html") {
      res.setHeader("content-type", "text/html; charset=utf-8");
      return res.end(`
        <html>
          <head>
            <title>Repositorio de QRs</title>
            <meta name="viewport" content="width=device-width, initial-scale=1" />
            <style>
              body { font-family: system-ui, sans-serif; padding: 16px; }
              h2 { margin-bottom: 8px; }
              .grid { display:grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap:16px; }
              .card { border:1px solid #ddd; border-radius:12px; padding:12px; }
              .meta { color:#555; font-size:12px; margin-bottom:8px; }
              img { width:180px; height:180px; object-fit:contain; background:#fff; border:1px solid #eee; display:block; margin:8px auto; }
              code { display:block; word-break:break-all; font-size:12px; }
            </style>
          </head>
          <body>
            <h2>Repositorio de códigos QR</h2>
            <p>Total: ${items.length}</p>
            <div class="grid">
              ${items
                .map((p) => {
                  const imgUrl = `/api/rondasqr/v1/admin/points/${p._id}/qr.png`;
                  return `
                    <div class="card">
                      <div><b>${p.name || ""}</b></div>
                      <div class="meta">
                        Sitio: ${p.siteName || "-"}<br/>
                        Ronda: ${p.roundName || "-"}<br/>
                        Orden: ${p.order ?? "-"}
                      </div>
                      ${
                        p.qr
                          ? `<img src="${imgUrl}" alt="${p.name || "QR"}" />`
                          : `<div>Sin QR</div>`
                      }
                      <code>${p.qr || "-"}</code>
                    </div>
                  `;
                })
                .join("")}
            </div>
          </body>
        </html>
      `);
    }

    return res.json({ ok: true, items, count: items.length });
  } catch (e) {
    next(e);
  }
});

/** PLANS *********************************************************/
admin.get("/plans", auth, async (req, res, next) => {
  try {
    const siteId = String(req.query.siteId || "").trim();
    const roundId = String(req.query.roundId || "").trim();

    const filter = {};
    if (siteId) {
      if (!isId(siteId)) return res.status(400).json({ ok: false, error: "invalid_siteId" });
      filter.siteId = siteId;
    }
    if (roundId) {
      if (!isId(roundId)) return res.status(400).json({ ok: false, error: "invalid_roundId" });
      filter.roundId = roundId;
    }

    const plans = await RqPlan.find(filter).lean();

    const items = plans.map((plan) => ({
      ...plan,
      pointIds: plan.pointIds?.length ? plan.pointIds : (plan.points || []).map((p) => p.pointId),
    }));

    res.json({ ok: true, items, count: items.length });
  } catch (e) {
    next(e);
  }
});

admin.post("/plans", auth, async (req, res, next) => {
  try {
    const b = req.body || {};
    const siteId = String(b.siteId || "").trim();
    const roundId = String(b.roundId || "").trim();

    if (!isId(siteId) || !isId(roundId)) {
      return res.status(400).json({
        ok: false,
        error: "siteId_and_roundId_required",
      });
    }

    let source = b.points ?? b.pointIds ?? b.plan ?? b.ids ?? [];
    if (!Array.isArray(source)) source = [];

    let points;
    if (source.length && typeof source[0] === "object" && source[0] !== null) {
      points = source.map((p, idx) => ({
        pointId: String(p.pointId ?? p.id ?? p._id),
        order: Number.isFinite(p.order) ? p.order : idx,
        windowStartMin: p.windowStartMin,
        windowEndMin: p.windowEndMin,
        toleranceMin: p.toleranceMin,
      }));
    } else {
      points = source.map((id, idx) => ({
        pointId: String(id),
        order: idx,
      }));
    }

    points = points.filter((p) => isId(p.pointId));

    const allIds = points.map((p) => p.pointId);
    const dbPoints = await RqPoint.find({ _id: { $in: allIds } })
      .select({ _id: 1, siteId: 1, roundId: 1 })
      .lean();

    const validSet = new Set(
      dbPoints
        .filter((p) => String(p.siteId) === siteId && String(p.roundId) === roundId)
        .map((p) => String(p._id))
    );

    const cleanOrdered = points
      .filter((p) => validSet.has(p.pointId))
      .map((p, i) => ({
        ...p,
        order: Number.isFinite(p.order) ? p.order : i,
      }))
      .sort((a, b) => (a.order || 0) - (b.order || 0));

    const payload = {
      siteId,
      roundId,
      name: typeof b.name === "string" ? b.name.trim() : undefined,
      version: Number.isFinite(b.version) ? Number(b.version) : undefined,
      points: cleanOrdered,
      pointIds: cleanOrdered.map((p) => p.pointId),
      active: true,
    };

    const doc = await RqPlan.findOneAndUpdate(
      { siteId, roundId },
      { $set: payload },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    ).lean();

    res.json({
      ok: true,
      item: doc,
      items: [doc],
      count: cleanOrdered.length,
    });
  } catch (e) {
    next(e);
  }
});

admin.delete("/plans", auth, async (req, res, next) => {
  try {
    const siteId = String(req.query.siteId || "").trim();
    const roundId = String(req.query.roundId || "").trim();

    if (!isId(siteId) || !isId(roundId)) {
      return res.status(400).json({
        ok: false,
        error: "siteId_and_roundId_required",
      });
    }

    const r = await RqPlan.deleteOne({ siteId, roundId });
    res.json({ ok: true, deleted: r.deletedCount });
  } catch (e) {
    next(e);
  }
});

/* ──────────────── MONTAJE DE RUTAS ──────────────── */
router.use("/admin/assignments", assignmentsRoutes);
router.use("/admin", admin);
router.use("/admin/aviones", admin);

// rutas OFFLINE
router.use(offlineRoutes);

/* ──────────────── SCAN (CHECK-IN) ──────────────── */
router.post("/checkin/scan", auth, async (req, res, next) => {
  try {
    const b = req.body || {};
    const qr = typeof b.qr === "string" ? b.qr.trim() : "";

    if (!qr) {
      return res.status(400).json({ ok: false, error: "qr_required" });
    }

    const idFields = getPointIdFields();
    if (idFields.length === 0) {
      return res.status(500).json({
        ok: false,
        error: "No id fields in RqPoint schema (expected qr or qrNo)",
      });
    }

    const or = idFields.map((f) => ({ [f]: qr }));
    const point = await RqPoint.findOne({ active: true, $or: or }).lean();

    if (!point) {
      return res.status(404).json({ ok: false, error: "point_not_found" });
    }

    const [round, site] = await Promise.all([
      point.roundId ? RqRound.findById(point.roundId).lean() : null,
      point.siteId ? RqSite.findById(point.siteId).lean() : null,
    ]);

    const rawGps = b.gps || {};
    const { gps, loc } = buildGeoFromGps(rawGps);

    const qrValue = pointQrValue(point);

    const mark = await RqMark.create({
      hardwareId: b.hardwareId || "",
      message: b.message || "",
      steps: typeof b.steps === "number" ? b.steps : undefined,
      siteId: point.siteId || null,
      siteName: site?.name || "",
      roundId: point.roundId || null,
      roundName: round?.name || "",
      pointId: point._id,
      pointName: point.name || "",
      qr: qrValue || qr,
      qrNo: point.qrNo || undefined,
      pointQr: qrValue || "",
      at: b.ts ? new Date(b.ts) : new Date(),
      gps,
      loc,
      officerEmail: req?.user?.email || "",
      officerName: req?.user?.name || req?.user?.email || "",
      guardId: req?.user?.sub || "",
      guardName: req?.user?.name || req?.user?.email || "",
    });

    req.io?.emit?.("rondasqr:mark", { item: mark });

    res.json({
      ok: true,
      item: mark,
      point: {
        id: point._id,
        name: point.name,
        qr: qrValue || qr,
      },
    });
  } catch (e) {
    next(e);
  }
});

/* ──────────────── INCIDENTES (menú “mensaje”) ──────────────── */
router.post("/checkin/incidents", auth, async (req, res, next) => {
  try {
    const b = req.body || {};
    if (!b.text) {
      return res.status(400).json({ ok: false, error: "text_required" });
    }

    const rawGps = b.gps || (b.lat && b.lon ? { lat: b.lat, lon: b.lon } : {});
    const { gps, loc } = buildGeoFromGps(rawGps);

    const doc = await RqIncident.create({
      type: "custom",
      text: b.text,
      photos: Array.isArray(b.photosBase64) ? b.photosBase64.slice(0, 10) : [],
      gps,
      loc,
      at: new Date(),
      officerEmail: req?.user?.email || "",
      officerName: req?.user?.name || req?.user?.email || "",
      guardId: req?.user?.sub || "",
      guardName: req?.user?.name || req?.user?.email || "",
    });

    req.io?.emit?.("rondasqr:incident", { kind: "message", item: doc });
    res.json({ ok: true, item: doc });
  } catch (e) {
    next(e);
  }
});

/* ──────────────── PÁNICO (botón rojo) ──────────────── */
router.post("/checkin/panic", auth, async (req, res, next) => {
  try {
    const { gps: rawGps } = req.body || {};
    const { gps, loc } = buildGeoFromGps(rawGps);

    const doc = await RqIncident.create({
      type: "panic",
      text: "Botón de pánico",
      gps,
      loc,
      at: new Date(),
      officerEmail: req?.user?.email || "",
      officerName: req?.user?.name || req?.user?.email || "",
      guardId: req?.user?.sub || "",
      guardName: req?.user?.name || req?.user?.email || "",
    });

    req.io?.emit?.("rondasqr:alert", { kind: "panic", item: doc });
    req.io?.emit?.("rondasqr:incident", { kind: "panic", item: doc });

    res.json({ ok: true, item: doc });
  } catch (e) {
    next(e);
  }
});

/* ──────────────── INACTIVIDAD ──────────────── */
router.post("/checkin/inactivity", auth, async (req, res, next) => {
  try {
    const b = req.body || {};
    const { gps, loc } = buildGeoFromGps(b.gps);

    const doc = await RqIncident.create({
      type: "inactivity",
      text: `Inmovilidad de ${b.minutes ?? "?"} minutos`,
      gps,
      loc,
      at: new Date(),
      durationMin: Number(b.minutes ?? 0) || 0,
      stepsAtAlert: typeof b.steps === "number" ? b.steps : null,
      siteId: b.siteId || null,
      siteName: b.siteName || "",
      roundId: b.roundId || null,
      roundName: b.roundName || "",
      pointId: b.pointId || null,
      pointName: b.pointName || "",
      officerEmail: req?.user?.email || "",
      officerName: req?.user?.name || req?.user?.email || "",
      guardId: req?.user?.sub || "",
      guardName: req?.user?.name || req?.user?.email || "",
    });

    req.io?.emit?.("rondasqr:alert", { kind: "inactivity", item: doc });
    req.io?.emit?.("rondasqr:incident", { kind: "inactivity", item: doc });

    res.json({ ok: true, item: doc });
  } catch (e) {
    next(e);
  }
});

/* ──────────────── HOMBRE CAÍDO ──────────────── */
router.post("/checkin/fall", auth, async (req, res, next) => {
  try {
    const b = req.body || {};
    const { gps, loc } = buildGeoFromGps(b.gps);

    const doc = await RqIncident.create({
      type: "fall",
      text: `Hombre caído${b.afterInactivityMin ? ` tras ${b.afterInactivityMin} min de inmovilidad` : ""}`,
      gps,
      loc,
      at: new Date(),
      stepsAtAlert: typeof b.steps === "number" ? b.steps : null,
      fallDetected: true,
      officerEmail: req?.user?.email || "",
      officerName: req?.user?.name || req?.user?.email || "",
      guardId: req?.user?.sub || "",
      guardName: req?.user?.name || req?.user?.email || "",
    });

    req.io?.emit?.("rondasqr:alert", { kind: "fall", item: doc });
    req.io?.emit?.("rondasqr:incident", { kind: "fall", item: doc });

    res.json({ ok: true, item: doc });
  } catch (e) {
    next(e);
  }
});

/* ──────────────── Seed DEV ─────────────── */
router.post("/_dev/seed/:code", async (req, res, next) => {
  try {
    const code = String(req.params.code || "").trim();
    if (!code) return res.status(400).json({ ok: false, error: "code_required" });

    const idFields = getPointIdFields();
    if (idFields.length === 0) {
      return res.status(500).json({
        ok: false,
        error: "No id fields in RqPoint schema (expected qr or qrNo)",
      });
    }

    const target = idFields[0];
    const up = await RqPoint.updateOne(
      { [target]: code },
      {
        $setOnInsert: {
          name: `Dev ${code}`,
          [target]: code,
          active: true,
          order: 0,
        },
      },
      { upsert: true }
    );

    res.json({ ok: true, up, usingField: target });
  } catch (e) {
    next(e);
  }
});

export default router;