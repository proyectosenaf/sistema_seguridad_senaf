// server/modules/rondasqr/routes/rondasqr.admin.routes.js
import express from "express";
import mongoose from "mongoose";
import QRCode from "qrcode";
import PDFDocument from "pdfkit";

import RqSite from "../models/RqSite.model.js";
import RqRound from "../models/RqRound.model.js";
import RqPoint from "../models/RqPoint.model.js";
import RqPlan from "../models/RqPlan.model.js";

const router = express.Router();

/* --------------------------- Helpers --------------------------- */
const toId = (v) => {
  try {
    return new mongoose.Types.ObjectId(String(v));
  } catch {
    return null;
  }
};
const norm = (s) => (typeof s === "string" ? s.trim() : s);
const slug = (s) =>
  String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

// normalizador de turno: "Día"/"dia"/"Dia" => "dia"; "Noche"/"noche" => "noche"
const normShift = (s) => {
  if (s == null) return undefined;
  const v = String(s).trim().toLowerCase();
  if (v === "día") return "dia";
  return v;
};

/* =================================================================
   SITES
   GET    /admin/sites
   POST   /admin/sites
   PUT    /admin/sites/:id
   PATCH  /admin/sites/:id/(off|on)
   DELETE /admin/sites/:id
================================================================= */

router.get("/sites", async (req, res, next) => {
  try {
    const { q, active } = req.query;
    const filter = {};
    if (q) {
      filter.$or = [
        { name: { $regex: norm(q), $options: "i" } },
        { code: { $regex: norm(q), $options: "i" } },
      ];
    }
    if (active === "true") filter.active = true;
    if (active === "false") filter.active = false;

    const items = await RqSite.find(filter).sort({ name: 1 }).lean();
    res.json({ items });
  } catch (e) {
    next(e);
  }
});

router.post("/sites", async (req, res, next) => {
  try {
    const { name, code, active, gps } = req.body || {};
    const nm = norm(name);
    if (!nm) return res.status(400).json({ error: "name requerido" });

    const doc = {
      name: nm,
      code: norm(code) || slug(nm) || undefined,
      active: typeof active === "boolean" ? active : true,
    };

    if (gps && typeof gps === "object") {
      const lat = Number(gps.lat);
      const lon = Number(gps.lon);
      if (Number.isFinite(lat) && Number.isFinite(lon)) {
        doc.loc = { type: "Point", coordinates: [lon, lat] };
      }
    }

    const item = await RqSite.create(doc);
    res.status(201).json({ item });
  } catch (e) {
    if (e?.name === "ValidationError") {
      return res
        .status(400)
        .json({ error: "validacion", details: e.errors || {} });
    }
    if (e?.code === 11000) {
      const field = Object.keys(e.keyValue || {})[0] || "campo";
      return res
        .status(409)
        .json({ error: "duplicado", field, value: e.keyValue?.[field] });
    }
    next(e);
  }
});

router.put("/sites/:id", async (req, res, next) => {
  try {
    const id = toId(req.params.id);
    if (!id) return res.status(400).json({ error: "id inválido" });

    const { name, code, active, gps } = req.body || {};
    const $set = {};
    if (name != null) $set.name = norm(name);
    if (code != null) $set.code = norm(code) || null;
    if (active != null) $set.active = !!active;

    if (gps !== undefined) {
      const lat = Number(gps?.lat);
      const lon = Number(gps?.lon);
      if (Number.isFinite(lat) && Number.isFinite(lon)) {
        $set.loc = { type: "Point", coordinates: [lon, lat] };
      } else {
        $set.loc = undefined;
      }
    }

    const item = await RqSite.findByIdAndUpdate(
      id,
      { $set },
      { new: true, lean: true }
    );
    if (!item) return res.status(404).json({ error: "no encontrado" });
    res.json({ item });
  } catch (e) {
    next(e);
  }
});

router.patch("/sites/:id/off", async (req, res, next) => {
  try {
    const id = toId(req.params.id);
    if (!id) return res.status(400).json({ error: "id inválido" });
    const item = await RqSite.findByIdAndUpdate(
      id,
      { $set: { active: false } },
      { new: true, lean: true }
    );
    if (!item) return res.status(404).json({ error: "no encontrado" });
    res.json({ item });
  } catch (e) {
    next(e);
  }
});
router.patch("/sites/:id/on", async (req, res, next) => {
  try {
    const id = toId(req.params.id);
    if (!id) return res.status(400).json({ error: "id inválido" });
    const item = await RqSite.findByIdAndUpdate(
      id,
      { $set: { active: true } },
      { new: true, lean: true }
    );
    if (!item) return res.status(404).json({ error: "no encontrado" });
    res.json({ item });
  } catch (e) {
    next(e);
  }
});

router.delete("/sites/:id", async (req, res, next) => {
  try {
    const id = toId(req.params.id);
    if (!id) return res.status(400).json({ error: "id inválido" });
    const del = await RqSite.findByIdAndDelete(id).lean();
    if (!del) return res.status(404).json({ error: "no encontrado" });
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

/* =================================================================
   ROUNDS
================================================================= */

router.get("/rounds", async (req, res, next) => {
  try {
    const { siteId, q, active } = req.query;
    const filter = {};
    if (siteId) {
      const sid = toId(siteId);
      if (!sid) return res.status(400).json({ error: "siteId inválido" });
      filter.siteId = sid;
    }
    if (q) {
      filter.$or = [
        { name: { $regex: norm(q), $options: "i" } },
        { code: { $regex: norm(q), $options: "i" } },
      ];
    }
    if (active === "true") filter.active = true;
    if (active === "false") filter.active = false;

    const items = await RqRound.find(filter).sort({ name: 1 }).lean();
    res.json({ items });
  } catch (e) {
    next(e);
  }
});

router.post("/rounds", async (req, res, next) => {
  try {
    const { siteId, name, code, active } = req.body || {};
    const sid = toId(siteId);
    if (!sid) return res.status(400).json({ error: "siteId requerido/valido" });
    if (!norm(name)) return res.status(400).json({ error: "name requerido" });

    const item = await RqRound.create({
      siteId: sid,
      name: norm(name),
      code: norm(code) || undefined,
      active: typeof active === "boolean" ? active : true,
    });
    res.status(201).json({ item });
  } catch (e) {
    next(e);
  }
});

router.put("/rounds/:id", async (req, res, next) => {
  try {
    const id = toId(req.params.id);
    if (!id) return res.status(400).json({ error: "id inválido" });

    const { siteId, name, code, active } = req.body || {};
    const $set = {};
    if (siteId != null) {
      const sid = toId(siteId);
      if (!sid) return res.status(400).json({ error: "siteId inválido" });
      $set.siteId = sid;
    }
    if (name != null) $set.name = norm(name);
    if (code != null) $set.code = norm(code) || null;
    if (active != null) $set.active = !!active;

    const item = await RqRound.findByIdAndUpdate(
      id,
      { $set },
      { new: true, lean: true }
    );
    if (!item) return res.status(404).json({ error: "no encontrado" });
    res.json({ item });
  } catch (e) {
    next(e);
  }
});

router.patch("/rounds/:id/off", async (req, res, next) => {
  try {
    const id = toId(req.params.id);
    if (!id) return res.status(400).json({ error: "id inválido" });
    const item = await RqRound.findByIdAndUpdate(
      id,
      { $set: { active: false } },
      { new: true, lean: true }
    );
    if (!item) return res.status(404).json({ error: "no encontrado" });
    res.json({ item });
  } catch (e) {
    next(e);
  }
});
router.patch("/rounds/:id/on", async (req, res, next) => {
  try {
    const id = toId(req.params.id);
    if (!id) return res.status(400).json({ error: "id inválido" });
    const item = await RqRound.findByIdAndUpdate(
      id,
      { $set: { active: true } },
      { new: true, lean: true }
    );
    if (!item) return res.status(404).json({ error: "no encontrado" });
    res.json({ item });
  } catch (e) {
    next(e);
  }
});

router.delete("/rounds/:id", async (req, res, next) => {
  try {
    const id = toId(req.params.id);
    if (!id) return res.status(400).json({ error: "id inválido" });
    const del = await RqRound.findByIdAndDelete(id).lean();
    if (!del) return res.status(404).json({ error: "no encontrado" });
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

/* =================================================================
   POINTS
================================================================= */

router.get("/points", async (req, res, next) => {
  try {
    const { siteId, roundId, q, active } = req.query;
    const filter = {};
    if (siteId) {
      const sid = toId(siteId);
      if (!sid) return res.status(400).json({ error: "siteId inválido" });
      filter.siteId = sid;
    }
    if (roundId) {
      const rid = toId(roundId);
      if (!rid) return res.status(400).json({ error: "roundId inválido" });
      filter.roundId = rid;
    }
    if (q) {
      filter.$or = [
        { name: { $regex: norm(q), $options: "i" } },
        { qr: { $regex: norm(q), $options: "i" } },
      ];
    }
    if (active === "true") filter.active = true;
    if (active === "false") filter.active = false;

    const items = await RqPoint.find(filter).sort({ order: 1, name: 1 }).lean();
    res.json({ items });
  } catch (e) {
    next(e);
  }
});

router.post("/points", async (req, res, next) => {
  try {
    const { siteId, roundId, name, qr, order, gps, active } = req.body || {};
    const sid = toId(siteId);
    const rid = toId(roundId);
    if (!sid) return res.status(400).json({ error: "siteId requerido/valido" });
    if (!rid)
      return res.status(400).json({ error: "roundId requerido/valido" });
    if (!norm(name)) return res.status(400).json({ error: "name requerido" });

    const payload = {
      siteId: sid,
      roundId: rid,
      name: norm(name),
      qr: norm(qr) || undefined,
      // si no viene order, dejamos que el modelo lo calcule
      ...(order != null && Number.isFinite(Number(order))
        ? { order: Number(order) }
        : {}),
      active: typeof active === "boolean" ? active : true,
    };

    if (gps && typeof gps === "object") {
      const lat = Number(gps.lat);
      const lon = Number(gps.lon);
      if (Number.isFinite(lat) && Number.isFinite(lon)) {
        payload.gps = { lat, lon };
        payload.loc = { type: "Point", coordinates: [lon, lat] };
      }
    }

    const item = await RqPoint.create(payload);
    res.status(201).json({ item });
  } catch (e) {
    next(e);
  }
});

router.put("/points/:id", async (req, res, next) => {
  try {
    const id = toId(req.params.id);
    if (!id) return res.status(400).json({ error: "id inválido" });

    const { siteId, roundId, name, qr, order, gps, active } = req.body || {};
    const $set = {};
    if (siteId != null) {
      const sid = toId(siteId);
      if (!sid) return res.status(400).json({ error: "siteId inválido" });
      $set.siteId = sid;
    }
    if (roundId != null) {
      const rid = toId(roundId);
      if (!rid) return res.status(400).json({ error: "roundId inválido" });
      $set.roundId = rid;
    }
    if (name != null) $set.name = norm(name);
    if (qr != null) $set.qr = norm(qr) || null;
    if (order != null && Number.isFinite(Number(order))) {
      $set.order = Number(order);
    }

    if (gps !== undefined) {
      const lat = Number(gps?.lat);
      const lon = Number(gps?.lon);
      if (Number.isFinite(lat) && Number.isFinite(lon)) {
        $set.gps = { lat, lon };
        $set.loc = { type: "Point", coordinates: [lon, lat] };
      } else {
        $set.gps = undefined;
        $set.loc = undefined;
      }
    }

    if (active != null) $set.active = !!active;

    const item = await RqPoint.findByIdAndUpdate(
      id,
      { $set },
      { new: true, lean: true }
    );
    if (!item) return res.status(404).json({ error: "no encontrado" });
    res.json({ item });
  } catch (e) {
    next(e);
  }
});

router.patch("/points/:id/off", async (req, res, next) => {
  try {
    const id = toId(req.params.id);
    if (!id) return res.status(400).json({ error: "id inválido" });
    const item = await RqPoint.findByIdAndUpdate(
      id,
      { $set: { active: false } },
      { new: true, lean: true }
    );
    if (!item) return res.status(404).json({ error: "no encontrado" });
    res.json({ item });
  } catch (e) {
    next(e);
  }
});
router.patch("/points/:id/on", async (req, res, next) => {
  try {
    const id = toId(req.params.id);
    if (!id) return res.status(400).json({ error: "id inválido" });
    const item = await RqPoint.findByIdAndUpdate(
      id,
      { $set: { active: true } },
      { new: true, lean: true }
    );
    if (!item) return res.status(404).json({ error: "no encontrado" });
    res.json({ item });
  } catch (e) {
    next(e);
  }
});

router.delete("/points/:id", async (req, res, next) => {
  try {
    const id = toId(req.params.id);
    if (!id) return res.status(400).json({ error: "id inválido" });
    const del = await RqPoint.findByIdAndDelete(id).lean();
    if (!del) return res.status(404).json({ error: "no encontrado" });
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

/* =================================================================
   QR EXTRA: PNG / PDF / ROTACIÓN / REPOSITORIO
================================================================= */

// PNG del QR de un punto
router.get("/points/:id/qr.png", async (req, res, next) => {
  try {
    const id = toId(req.params.id);
    if (!id) return res.status(400).json({ error: "id inválido" });

    const point = await RqPoint.findById(id).lean();
    if (!point) return res.status(404).json({ error: "punto no encontrado" });

    const text = String(point.qr || "");
    if (!text) {
      return res.status(400).json({ error: "el punto no tiene QR asignado" });
    }

    const buffer = await QRCode.toBuffer(text, {
      type: "png",
      margin: 2,
      scale: 8,
    });

    res.setHeader("Content-Type", "image/png");
    res.setHeader(
      "Content-Disposition",
      `inline; filename="rq-point-${point._id}.png"`
    );
    res.send(buffer);
  } catch (e) {
    next(e);
  }
});

// PDF con el QR del punto (para imprimir)
router.get("/points/:id/qr.pdf", async (req, res, next) => {
  try {
    const id = toId(req.params.id);
    if (!id) return res.status(400).json({ error: "id inválido" });

    const point = await RqPoint.findById(id)
      .populate("siteId", "name code")
      .populate("roundId", "name code")
      .lean();
    if (!point) return res.status(404).json({ error: "punto no encontrado" });

    const text = String(point.qr || "");
    if (!text) {
      return res.status(400).json({ error: "el punto no tiene QR asignado" });
    }

    const pngBuffer = await QRCode.toBuffer(text, {
      type: "png",
      margin: 1,
      scale: 8,
    });

    const doc = new PDFDocument({ size: "A4", margin: 50 });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `inline; filename="rq-point-${point._id}.pdf"`
    );
    doc.pipe(res);

    doc.fontSize(20).text("Código QR – Ronda de Vigilancia", { align: "center" });
    doc.moveDown();
    doc
      .fontSize(14)
      .text(`Sitio: ${point.siteId?.name || ""}`, { align: "center" });
    doc
      .fontSize(14)
      .text(`Ronda: ${point.roundId?.name || ""}`, { align: "center" });
    doc
      .fontSize(14)
      .text(`Punto: ${point.name || ""}`, { align: "center" });
    doc.moveDown(2);

    const imgSize = 250;
    const x = (doc.page.width - imgSize) / 2;
    const y = doc.y;
    doc.image(pngBuffer, x, y, { width: imgSize, height: imgSize });

    doc.moveDown(6);
    doc
      .fontSize(12)
      .text(`Código: ${text}`, { align: "center" })
      .moveDown();

    doc
      .fontSize(10)
      .fillColor("gray")
      .text("Escanear con la app de RondasQR para registrar el punto.", {
        align: "center",
      });

    doc.end();
  } catch (e) {
    next(e);
  }
});

// Rotar QR de un punto (nuevo código)
router.post("/points/:id/rotate-qr", async (req, res, next) => {
  try {
    const id = toId(req.params.id);
    if (!id) return res.status(400).json({ error: "id inválido" });

    // usamos el helper estático del modelo
    const result = await RqPoint.rotateQr(id);
    // devolvemos el punto actualizado (sin qrSecret)
    res.json({
      item: {
        ...result.point.toJSON(),
      },
      oldQr: result.oldQr,
    });
  } catch (e) {
    // si el static lanzó un error 404, respetarlo
    if (e.status) {
      return res.status(e.status).json({ error: e.message });
    }
    next(e);
  }
});

// Repositorio de QRs por sitio/ronda
router.get("/qr-repo", async (req, res, next) => {
  try {
    const { siteId, roundId } = req.query;
    const filter = {};
    if (siteId) {
      const sid = toId(siteId);
      if (!sid) return res.status(400).json({ error: "siteId inválido" });
      filter.siteId = sid;
    }
    if (roundId) {
      const rid = toId(roundId);
      if (!rid) return res.status(400).json({ error: "roundId inválido" });
      filter.roundId = rid;
    }

    const raw = await RqPoint.find(filter)
      .populate("siteId", "name code")
      .populate("roundId", "name code")
      .sort({ siteId: 1, roundId: 1, order: 1 })
      .lean();

    const items = raw.map((p) => ({
      id: p._id,
      name: p.name,
      order: p.order,
      qr: p.qr,
      qrNo: p.qrNo,
      code: p.code,
      active: p.active,
      siteId: p.siteId?._id || p.siteId,
      siteName: p.siteId?.name,
      siteCode: p.siteId?.code,
      roundId: p.roundId?._id || p.roundId,
      roundName: p.roundId?.name,
      roundCode: p.roundId?.code,
      updatedAt: p.updatedAt,
      createdAt: p.createdAt,
    }));

    res.json({ items });
  } catch (e) {
    next(e);
  }
});

/* =================================================================
   PLANS
   GET    /admin/plans?siteId=&roundId=&shift=
   POST   /admin/plans               (upsert por siteId+roundId+shift)
   PUT    /admin/plans/:id
   DELETE /admin/plans               (por query: siteId+roundId+shift)
   DELETE /admin/plans/:id           (por id)
================================================================= */

// GET: si viene siteId+roundId (y opcional shift) -> { item }, si no -> { items }
router.get("/plans", async (req, res, next) => {
  try {
    const { siteId, roundId, shift, active } = req.query;
    const filter = {};
    if (siteId) {
      const sid = toId(siteId);
      if (!sid) return res.status(400).json({ error: "siteId inválido" });
      filter.siteId = sid;
    }
    if (roundId) {
      const rid = toId(roundId);
      if (!rid) return res.status(400).json({ error: "roundId inválido" });
      filter.roundId = rid;
    }
    const sh = normShift(shift);
    if (sh) filter.shift = sh;

    if (active === "true") filter.active = true;
    if (active === "false") filter.active = false;

    if (filter.siteId && filter.roundId) {
      // consulta específica
      const item = await RqPlan.findOne(filter).lean();
      return res.json({ item: item || null });
    }

    // listado
    const items = await RqPlan.find(filter).lean();
    res.json({ items });
  } catch (e) {
    next(e);
  }
});

// UPSERT por (siteId, roundId, shift)
router.post("/plans", async (req, res, next) => {
  try {
    const { siteId, roundId, shift, pointIds = [], windows = [], active } =
      req.body || {};
    const sid = toId(siteId);
    const rid = toId(roundId);
    if (!sid) return res.status(400).json({ error: "siteId requerido/valido" });
    if (!rid) return res.status(400).json({ error: "roundId requerido/valido" });

    const sh = normShift(shift); // puede ser undefined -> se guarda sin turno si no llega
    const pts = Array.isArray(pointIds) ? pointIds.map(toId).filter(Boolean) : [];

    const doc = {
      siteId: sid,
      roundId: rid,
      shift: sh, // <-- clave
      pointIds: pts,
      windows: Array.isArray(windows)
        ? windows.map((w) => ({
            label: norm(w?.label) || undefined,
            startMin: Number.isFinite(Number(w?.startMin))
              ? Number(w.startMin)
              : undefined,
            endMin: Number.isFinite(Number(w?.endMin))
              ? Number(w.endMin)
              : undefined,
          }))
        : [],
    };
    if (active != null) doc.active = !!active;

    const item = await RqPlan.findOneAndUpdate(
      { siteId: sid, roundId: rid, ...(sh ? { shift: sh } : {}) },
      { $set: doc },
      { upsert: true, new: true, lean: true }
    );
    res.status(201).json({ item });
  } catch (e) {
    next(e);
  }
});

router.put("/plans/:id", async (req, res, next) => {
  try {
    const id = toId(req.params.id);
    if (!id) return res.status(400).json({ error: "id inválido" });

    const { siteId, roundId, shift, pointIds, windows, active } =
      req.body || {};
    const $set = {};
    if (siteId != null) {
      const sid = toId(siteId);
      if (!sid) return res.status(400).json({ error: "siteId inválido" });
      $set.siteId = sid;
    }
    if (roundId != null) {
      const rid = toId(roundId);
      if (!rid) return res.status(400).json({ error: "roundId inválido" });
      $set.roundId = rid;
    }
    if (shift !== undefined) $set.shift = normShift(shift) || undefined;
    if (Array.isArray(pointIds))
      $set.pointIds = pointIds.map(toId).filter(Boolean);
    if (Array.isArray(windows)) {
      $set.windows = windows.map((w) => ({
        label: norm(w?.label) || undefined,
        startMin: Number.isFinite(Number(w?.startMin))
          ? Number(w.startMin)
          : undefined,
        endMin: Number.isFinite(Number(w?.endMin))
          ? Number(w.endMin)
          : undefined,
      }));
    }
    if (active != null) $set.active = !!active;

    const item = await RqPlan.findByIdAndUpdate(
      id,
      { $set },
      { new: true, lean: true }
    );
    if (!item) return res.status(404).json({ error: "no encontrado" });
    res.json({ item });
  } catch (e) {
    next(e);
  }
});

// DELETE por query (siteId+roundId+shift)
router.delete("/plans", async (req, res, next) => {
  try {
    const { siteId, roundId, shift } = req.query;
    const sid = toId(siteId);
    const rid = toId(roundId);
    const sh = normShift(shift);
    if (!sid || !rid)
      return res.status(400).json({ error: "siteId y roundId requeridos" });

    const del = await RqPlan.findOneAndDelete({
      siteId: sid,
      roundId: rid,
      ...(sh ? { shift: sh } : {}),
    }).lean();
    if (!del) return res.status(404).json({ error: "no encontrado" });
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

// DELETE por id (sigue disponible)
router.delete("/plans/:id", async (req, res, next) => {
  try {
    const id = toId(req.params.id);
    if (!id) return res.status(400).json({ error: "id inválido" });
    const del = await RqPlan.findByIdAndDelete(id).lean();
    if (!del) return res.status(404).json({ error: "no encontrado" });
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

export default router;
