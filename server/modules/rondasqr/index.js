// server/modules/rondasqr/index.js
import express from "express";
import mongoose from "mongoose";
import RqPoint from "./models/RqPoint.model.js";
import RqRound from "./models/RqRound.model.js";
import RqSite from "./models/RqSite.model.js";
import RqPlan from "./models/RqPlan.model.js";
import RqMark from "./models/RqMark.model.js";
import RqIncident from "./models/RqIncident.model.js";
import RqDevice from "./models/RqDevice.model.js"; // 👈 usamos esto para guardar estado de dispositivo

// ⬇️ Rutas de asignaciones (crear/listar/borrar)
import assignmentsRoutes from "./routes/assignments.routes.js";

const router = express.Router();

/* ─────────── Inyectar io y notifier al request ─────────── */
router.use((req, _res, next) => {
  req.io = req.app.get("io"); // socket.io
  req.notifier = req.app.get("notifier"); // servicio de notificaciones (si existe)
  next();
});

/* ───────────────── Auth liviano ───────────────── */
const DISABLE_AUTH = String(process.env.DISABLE_AUTH || "0") === "1";
const IAM_ALLOW_DEV_HEADERS = String(process.env.IAM_ALLOW_DEV_HEADERS || "0") === "1";

function auth(req, _res, next) {
  if (DISABLE_AUTH) {
    req.user = {
      sub: req.headers["x-user-id"] || "dev|local",
      email: req.headers["x-user-email"] || "dev@local",
    };
    return next();
  }
  if (IAM_ALLOW_DEV_HEADERS && req.headers["x-user-email"]) {
    req.user = {
      sub: req.headers["x-user-id"] || "dev|local",
      email: req.headers["x-user-email"],
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
        } else if (l.name === "router" && l.regexp) {
          return `USE ${l.regexp}`;
        }
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
      ? { name: { $regex: q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" } }
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
    if (!name) return res.status(400).json({ ok: false, error: "name_required" });
    const exists = await RqSite.findOne({ name: new RegExp(`^${name}$`, "i") }).lean();
    if (exists) return res.status(409).json({ ok: false, error: "site_exists" });
    const doc = await RqSite.create({ name, active: true });
    res.status(201).json({ ok: true, item: doc });
  } catch (e) {
    next(e);
  }
});
admin.delete("/sites/:id", auth, async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!isId(id)) return res.status(400).json({ ok: false, error: "invalid_siteId" });
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
    if (siteId && !isId(siteId))
      return res.status(400).json({ ok: false, error: "invalid_siteId" });
    const filter = siteId ? { siteId } : {};
    const items = await RqRound.find(filter).sort({ createdAt: -1 }).lean();
    res.json({ ok: true, items });
  } catch (e) {
    next(e);
  }
});

/* ───────── ROUNDS: crear ───────── */
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
    if (!name) return res.status(400).json({ ok: false, error: "name_required" });

    let site = null;

    if (rawSiteIdInput && mongoose.Types.ObjectId.isValid(rawSiteIdInput)) {
      site = await RqSite.findById(rawSiteIdInput).lean();
      if (!site) return res.status(400).json({ ok: false, error: "site_not_found_by_id" });
    }

    if (!site) {
      const siteNameCandidate = rawSiteNameInput || rawSiteIdInput;
      if (!siteNameCandidate) return res.status(400).json({ ok: false, error: "site_required" });

      site = await RqSite.findOne({ name: new RegExp(`^${siteNameCandidate}$`, "i") }).lean();
      if (!site) return res.status(400).json({ ok: false, error: "site_not_found_by_name" });
    }

    const exists = await RqRound.findOne({
      siteId: site._id,
      name: new RegExp(`^${name}$`, "i"),
    }).lean();
    if (exists) return res.status(409).json({ ok: false, error: "round_exists" });

    const doc = await RqRound.create({ siteId: site._id, name, active: true });
    return res.status(201).json({ ok: true, item: doc });
  } catch (e) {
    console.error("[admin.rounds.create]", e);
    return res.status(500).json({ ok: false, error: e?.message || "internal_error" });
  }
});

admin.delete("/rounds/:id", auth, async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!isId(id)) return res.status(400).json({ ok: false, error: "invalid_roundId" });
    const r = await RqRound.deleteOne({ _id: id });
    res.json({ ok: true, deleted: r.deletedCount });
  } catch (e) {
    next(e);
  }
});

/** POINTS *********************************************************/
// list
admin.get("/points", auth, async (req, res, next) => {
  try {
    const roundId = String(req.query.roundId || "").trim();
    const siteId = String(req.query.siteId || "").trim();
    if (roundId && !isId(roundId))
      return res.status(400).json({ ok: false, error: "invalid_roundId" });
    if (siteId && !isId(siteId))
      return res.status(400).json({ ok: false, error: "invalid_siteId" });

    const filter = {};
    if (roundId) filter.roundId = roundId;
    if (siteId) filter.siteId = siteId;

    const items = await RqPoint.find(filter).sort({ order: 1, createdAt: 1 }).lean();
    res.json({ ok: true, items });
  } catch (e) {
    next(e);
  }
});
// create
admin.post("/points", auth, async (req, res, next) => {
  try {
    const b = req.body || {};
    const siteId = String(b.siteId || "").trim();
    const roundId = String(b.roundId || "").trim();
    const name = String(b.name || "").trim();
    if (!isId(siteId)) return res.status(400).json({ ok: false, error: "invalid_siteId" });
    if (!isId(roundId)) return res.status(400).json({ ok: false, error: "invalid_roundId" });
    if (!name) return res.status(400).json({ ok: false, error: "name_required" });

    const site = await RqSite.findById(siteId).lean();
    const round = await RqRound.findById(roundId).lean();
    if (!site) return res.status(404).json({ ok: false, error: "site_not_found" });
    if (!round) return res.status(404).json({ ok: false, error: "round_not_found" });

    const idFields = getPointIdFields();
    if (idFields.length === 0) {
      return res
        .status(500)
        .json({ ok: false, error: "No id fields in RqPoint schema (expected qr or qrNo)" });
    }

    const rawQr = typeof b.qr === "string" ? b.qr.trim() : null;
    const rawQrNo = typeof b.qrNo === "string" ? b.qrNo.trim() : null;

    const toInsert = { siteId, roundId, name, active: true };
    let order = normalizeOrder(b.order) ?? normalizeOrder(b.ord) ?? normalizeOrder(b.index);
    if (order === null) order = await nextOrderForRound(roundId);
    toInsert.order = order;

    if (idFields.includes("qr")) {
      if (!rawQr && !rawQrNo) return res.status(400).json({ ok: false, error: "qr_required" });
      toInsert.qr = rawQr || rawQrNo;
      const dup = await RqPoint.findOne({ qr: toInsert.qr }).lean();
      if (dup) return res.status(409).json({ ok: false, error: "point_qr_exists" });
    } else {
      if (!rawQr && !rawQrNo) return res.status(400).json({ ok: false, error: "qrNo_required" });
      toInsert.qrNo = rawQrNo || rawQr;
      const dup = await RqPoint.findOne({ qrNo: toInsert.qrNo }).lean();
      if (dup) return res.status(409).json({ ok: false, error: "point_qrNo_exists" });
    }

    const doc = await RqPoint.create(toInsert);
    res.status(201).json({ ok: true, item: doc });
  } catch (e) {
    next(e);
  }
});
// update
admin.patch("/points/:id", auth, async (req, res, next) => {
  try {
    const id = req.params.id;
    if (!isId(id)) return res.status(400).json({ ok: false, error: "invalid_pointId" });

    const b = req.body || {};
    const updates = {};
    if (typeof b.name === "string") updates.name = b.name.trim();
    const idFields = getPointIdFields();
    if (idFields.includes("qr") && typeof b.qr === "string") {
      const qr = b.qr.trim();
      const dup = await RqPoint.findOne({ _id: { $ne: id }, qr }).lean();
      if (dup) return res.status(409).json({ ok: false, error: "point_qr_exists" });
      updates.qr = qr;
    } else if (idFields.includes("qrNo") && typeof b.qrNo === "string") {
      const qrNo = b.qrNo.trim();
      const dup = await RqPoint.findOne({ _id: { $ne: id }, qrNo }).lean();
      if (dup) return res.status(409).json({ ok: false, error: "point_qrNo_exists" });
      updates.qrNo = qrNo;
    }
    let order =
      normalizeOrder(b.order) ?? normalizeOrder(b.ord) ?? normalizeOrder(b.index);
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
    next(e);
  }
});
// delete
admin.delete("/points/:id", auth, async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!isId(id)) return res.status(400).json({ ok: false, error: "invalid_pointId" });
    const doc = await RqPoint.findOneAndDelete({ _id: id });
    res.json({ ok: true, deleted: doc ? 1 : 0 });
  } catch (e) {
    next(e);
  }
});
// reorder
admin.put("/points/reorder", auth, async (req, res, next) => {
  try {
    const { roundId, pointIds } = req.body || {};
    if (!isId(roundId) || !Array.isArray(pointIds)) {
      return res
        .status(400)
        .json({ ok: false, error: "roundId_and_pointIds_required" });
    }
    const ops = pointIds.map((id, idx) => ({
      updateOne: { filter: { _id: id, roundId }, update: { $set: { order: idx } } },
    }));
    if (ops.length) await RqPoint.bulkWrite(ops);
    res.json({ ok: true, count: ops.length });
  } catch (e) {
    next(e);
  }
});

/** PLANS *********************************************************/
// GET /admin/plans?siteId=&roundId=
// 👉 ahora NO obliga a mandar los dos; si no mandas nada, devuelve todos.
admin.get("/plans", auth, async (req, res, next) => {
  try {
    const siteId = String(req.query.siteId || "").trim();
    const roundId = String(req.query.roundId || "").trim();

    const filter = {};
    if (siteId) {
      if (!isId(siteId))
        return res.status(400).json({ ok: false, error: "invalid_siteId" });
      filter.siteId = siteId;
    }
    if (roundId) {
      if (!isId(roundId))
        return res.status(400).json({ ok: false, error: "invalid_roundId" });
      filter.roundId = roundId;
    }

    const plans = await RqPlan.find(filter).lean();

    // normalizamos igual que antes
    const items = plans.map((plan) => ({
      ...plan,
      pointIds: plan.pointIds?.length
        ? plan.pointIds
        : (plan.points || []).map((p) => p.pointId),
    }));

    res.json({ ok: true, items, count: items.length });
  } catch (e) {
    next(e);
  }
});

// POST /admin/plans  (upsert)
admin.post("/plans", auth, async (req, res, next) => {
  try {
    const b = req.body || {};
    const siteId = String(b.siteId || "").trim();
    const roundId = String(b.roundId || "").trim();
    if (!isId(siteId) || !isId(roundId)) {
      return res
        .status(400)
        .json({ ok: false, error: "siteId_and_roundId_required" });
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
      points = source.map((id, idx) => ({ pointId: String(id), order: idx }));
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
      .map((p, i) => ({ ...p, order: Number.isFinite(p.order) ? p.order : i }))
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

// DELETE /admin/plans?siteId=&roundId=
admin.delete("/plans", auth, async (req, res, next) => {
  try {
    const siteId = String(req.query.siteId || "").trim();
    const roundId = String(req.query.roundId || "").trim();
    if (!isId(siteId) || !isId(roundId)) {
      return res
        .status(400)
        .json({ ok: false, error: "siteId_and_roundId_required" });
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

/* ──────────────── SCAN (CHECK-IN) ──────────────── */
router.post("/checkin/scan", auth, async (req, res, next) => {
  try {
    const b = req.body || {};
    const qr = typeof b.qr === "string" ? b.qr.trim() : "";
    if (!qr) return res.status(400).json({ ok: false, error: "qr_required" });

    const idFields = getPointIdFields();
    if (idFields.length === 0)
      return res
        .status(500)
        .json({ ok: false, error: "No id fields in RqPoint schema (expected qr or qrNo)" });

    const or = idFields.map((f) => ({ [f]: qr }));
    const point = await RqPoint.findOne({ active: true, $or: or }).lean();
    if (!point) return res.status(404).json({ ok: false, error: "point_not_found" });

    const [round, site] = await Promise.all([
      point.roundId ? RqRound.findById(point.roundId).lean() : null,
      point.siteId ? RqSite.findById(point.siteId).lean() : null,
    ]);

    const gps = b.gps || {};
    const hasGps = typeof gps.lat === "number" && typeof gps.lon === "number";

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
      qr: point.qr || qr,
      qrNo: point.qrNo || undefined,
      pointQr: point.qrNo,
      at: b.ts ? new Date(b.ts) : new Date(),
      gps,
      loc: hasGps
        ? { type: "Point", coordinates: [Number(gps.lon), Number(gps.lat)] }
        : undefined,
      officerEmail: req?.user?.email || "",
      officerName: req?.user?.email || "",
      guardId: req?.user?.sub || "",
    });

    req.io?.emit?.("rondasqr:mark", { item: mark });

    res.json({
      ok: true,
      item: mark,
      point: {
        id: point._id,
        name: point.name,
        qr: point.qr || point.qrNo || qr,
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
    if (!b.text) return res.status(400).json({ ok: false, error: "text_required" });

    const gps = b.gps || (b.lat && b.lon ? { lat: b.lat, lon: b.lon } : {});
    const doc = await RqIncident.create({
      type: "message",
      text: b.text,
      photosBase64: Array.isArray(b.photosBase64) ? b.photosBase64.slice(0, 10) : [],
      gps,
      at: new Date(),
      officerEmail: req?.user?.email || "",
      officerName: req?.user?.email || "",
      officerSub: req?.user?.sub || "",
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
    const { gps = {} } = req.body || {};
    const doc = await RqIncident.create({
      type: "panic",
      text: "Botón de pánico",
      gps,
      at: new Date(),
      officerEmail: req?.user?.email || "",
      officerName: req?.user?.email || "",
      officerSub: req?.user?.sub || "",
    });

    // que todos los conectados lo vean
    req.io?.emit?.("rondasqr:alert", { kind: "panic", item: doc });

    res.json({ ok: true, item: doc });
  } catch (e) {
    next(e);
  }
});

/* ──────────────── INACTIVIDAD ──────────────── */
router.post("/checkin/inactivity", auth, async (req, res, next) => {
  try {
    const b = req.body || {};
    const doc = await RqIncident.create({
      type: "inactivity",
      text: `Inmovilidad de ${b.minutes ?? "?"} minutos`,
      gps: b.gps || {},
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
      officerName: req?.user?.email || "",
      officerSub: req?.user?.sub || "",
    });

    req.io?.emit?.("rondasqr:alert", { kind: "inactivity", item: doc });
    res.json({ ok: true, item: doc });
  } catch (e) {
    next(e);
  }
});

/* ──────────────── HOMBRE CAÍDO ──────────────── */
router.post("/checkin/fall", auth, async (req, res, next) => {
  try {
    const b = req.body || {};
    const doc = await RqIncident.create({
      type: "fall",
      text: `Hombre caído${
        b.afterInactivityMin ? ` tras ${b.afterInactivityMin} min de inmovilidad` : ""
      }`,
      gps: b.gps || {},
      at: new Date(),
      stepsAtAlert: typeof b.steps === "number" ? b.steps : null,
      fallDetected: true,
      officerEmail: req?.user?.email || "",
      officerName: req?.user?.email || "",
      officerSub: req?.user?.sub || "",
    });

    req.io?.emit?.("rondasqr:alert", { kind: "fall", item: doc });
    res.json({ ok: true, item: doc });
  } catch (e) {
    next(e);
  }
});

/* ──────────────── OFFLINE (dump) ──────────────── */
/* acepta el formato que manda React: { outbox:[], progress:{}, device:{}, at:... } */
router.get("/offline/ping", (_req, res) => {
  res.json({ ok: true, where: "/api/rondasqr/v1/offline/ping", ts: Date.now() });
});

router.post("/offline/dump", auth, async (req, res, next) => {
  try {
    const { outbox = [], progress = {}, device = {}, at = null } = req.body || {};
    const u = req.user || {};
    const officerEmail = u.email || req.headers["x-user-email"] || "";
    const officerName = u.name || officerEmail || "";
    const officerSub = u.sub || "";

    const saved = { marks: 0, device: 0 };
    const errors = [];

    // 1) convertir outbox en marcas reales
    for (const it of Array.isArray(outbox) ? outbox : []) {
      try {
        const qr = String(it.qr || "").trim();
        if (!qr) {
          errors.push({ kind: "mark", reason: "qr_missing", raw: it });
          continue;
        }

        const point = await RqPoint.findOne({
          active: true,
          $or: [{ qr }, { qrNo: qr }, { code: qr }],
        }).lean();

        if (!point) {
          errors.push({ kind: "mark", reason: "point_not_found", qr, raw: it });
          continue;
        }

        const hasGps =
          it.gps &&
          typeof it.gps.lat === "number" &&
          typeof it.gps.lon === "number";

        await RqMark.create({
          pointId: point._id,
          pointName: point.name || "",
          siteId: point.siteId || null,
          roundId: point.roundId || null,
          qr: point.qr || qr,
          qrNo: point.qrNo || undefined,
          at: it.at ? new Date(it.at) : new Date(),
          gps: it.gps || {},
          loc: hasGps
            ? {
                type: "Point",
                coordinates: [Number(it.gps.lon), Number(it.gps.lat)],
              }
            : undefined,
          deviceId: it.hardwareId || it.deviceId || null,
          message: it.message || "",
          officerEmail,
          officerName,
          officerSub,
        });

        saved.marks += 1;
      } catch (err) {
        errors.push({ kind: "mark", reason: err.message, raw: it });
      }
    }

    // 2) guardar último estado de dispositivo/progreso
    if (Object.keys(progress).length || Object.keys(device).length) {
      try {
        await RqDevice.findOneAndUpdate(
          {
            officerSub: officerSub || undefined,
            officerEmail: officerEmail || undefined,
          },
          {
            $set: {
              lastProgress: progress,
              lastDeviceInfo: device,
              lastDumpAt: at ? new Date(at) : new Date(),
            },
          },
          { upsert: true, new: true }
        ).lean();
        saved.device += 1;
      } catch (err) {
        errors.push({ kind: "device", reason: err.message });
      }
    }

    return res.json({ ok: true, saved, errors });
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
    if (idFields.length === 0)
      return res
        .status(500)
        .json({ ok: false, error: "No id fields in RqPoint schema (expected qr or qrNo)" });

    const target = idFields[0];
    const up = await RqPoint.updateOne(
      { [target]: code },
      { $setOnInsert: { name: `Dev ${code}`, [target]: code, active: true, order: 0 } },
      { upsert: true }
    );

    res.json({ ok: true, up, usingField: target });
  } catch (e) {
    next(e);
  }
});

export default router;
