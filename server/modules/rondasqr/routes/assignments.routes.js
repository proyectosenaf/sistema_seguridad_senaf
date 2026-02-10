// server/modules/rondasqr/routes/assignments.routes.js
import express from "express";
import mongoose from "mongoose";
import RqAssignment from "../models/RqAssignment.model.js";
import RqRound from "../models/RqRound.model.js";
import RqSite from "../models/RqSite.model.js";
import RqPlan from "../models/RqPlan.model.js";

const router = express.Router();
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

const isObjectIdString = (v) =>
  typeof v === "string" && mongoose.Types.ObjectId.isValid(v);

function toId(v) {
  if (!v) return "";
  if (typeof v === "string") return v.trim();
  if (typeof v === "object") return String(v._id || v.id || "").trim();
  return "";
}

function todayStr(d = new Date()) {
  return d.toISOString().slice(0, 10);
}

/* ───────────────────────────── Helpers ───────────────────────────── */
function inferTimesByRoundName(name = "") {
  const n = String(name).toLowerCase();
  if (n.includes("diurn")) return { startTime: "06:00", endTime: "18:00" };
  if (n.includes("nocturn")) return { startTime: "18:00", endTime: "06:00" };
  if (n.includes("mediod") || n.includes("meridian"))
    return { startTime: "12:00", endTime: "18:00" };
  return {};
}

async function getPlanSnapshot(siteId, roundId) {
  const plan = await RqPlan.findOne({ siteId, roundId, active: true }).lean();
  if (!plan) return { planId: null, planSnap: [] };

  const ordered = (plan.points || [])
    .slice()
    .sort((a, b) => (a.order || 0) - (b.order || 0))
    .map((p) => ({
      pointId: p.pointId,
      order: p.order || 0,
      windowStartMin: p.windowStartMin,
      windowEndMin: p.windowEndMin,
      toleranceMin: p.toleranceMin,
    }));

  return { planId: plan._id, planSnap: ordered };
}

/* ───────────────────────────── GET ALL ───────────────────────────── */
/* GET /admin/assignments?date=YYYY-MM-DD */
router.get("/", async (req, res, next) => {
  try {
    const date = typeof req.query.date === "string" ? req.query.date.trim() : "";
    const filter = date ? { date } : {};

    const items = await RqAssignment.find(filter)
      .sort({ createdAt: -1 })
      .populate({ path: "roundId", select: "name siteId" })
      .populate({ path: "planId", select: "name version" })
      .lean();

    const siteIds = Array.from(
      new Set(
        items
          .map((a) => a.roundId?.siteId || a.siteId)
          .filter(Boolean)
          .map(String)
      )
    );

    const sitesById =
      siteIds.length > 0
        ? (
            await RqSite.find({ _id: { $in: siteIds } })
              .select({ name: 1 })
              .lean()
          ).reduce((acc, s) => ((acc[String(s._id)] = s), acc), {})
        : {};

    const mapped = items.map((a) => ({
      ...a,
      roundName: a.roundId?.name || "",
      planName: a.planId?.name || "",
      planVersion: a.planId?.version || 1,
      siteName:
        sitesById[String(a.roundId?.siteId || a.siteId || "")]?.name || "",
      pointsCount: Array.isArray(a.planSnap) ? a.planSnap.length : 0,
    }));

    res.json({ ok: true, items: mapped });
  } catch (e) {
    next(e);
  }
});

/* ───────────────────────────── CREATE ───────────────────────────── */
/* POST /admin/assignments */
router.post("/", async (req, res, next) => {
  try {
    const b = req.body || {};

    // ✅ date default
    const date = toId(b.date) || todayStr();

    // ✅ guardId acepta alias comunes
    const guardId =
      toId(b.guardId) ||
      toId(b.guardUserId) ||
      toId(b.userId) ||
      toId(b.sub);

    const roundId = toId(b.roundId);
    const startTime = toId(b.startTime);
    const endTime = toId(b.endTime);

    if (!date || !guardId || !isObjectIdString(roundId)) {
      return res.status(400).json({
        ok: false,
        error: "invalid_payload",
        message: "Payload inválido: requiere date, guardId (sub) y roundId (ObjectId).",
        meta: { date, guardId, roundId },
      });
    }

    const round = await RqRound.findById(roundId).lean();
    if (!round)
      return res.status(404).json({ ok: false, error: "round_not_found", message: "Ronda no encontrada" });

    const inferred = inferTimesByRoundName(round.name);
    const { planId, planSnap } = await getPlanSnapshot(round.siteId, round._id);

    const payload = {
      date,
      guardId, // ✅ aquí queda SUB (auth0|...)
      roundId: new mongoose.Types.ObjectId(round._id),
      siteId: round.siteId ? new mongoose.Types.ObjectId(round.siteId) : undefined,
      status: "assigned",
      startTime: HHMM.test(startTime) ? startTime : inferred.startTime || undefined,
      endTime: HHMM.test(endTime) ? endTime : inferred.endTime || undefined,
      planId,
      planSnap,
      notified: false,
      notifiedAt: undefined,
      notifiedBy: null,
    };

    const doc = await RqAssignment.findOneAndUpdate(
      { date, guardId, roundId: payload.roundId },
      { $set: payload },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    ).lean();

    // 🔔 notificación (si existe)
    try {
      const notifier = req.app.get("notifier");
      const site = await RqSite.findById(round.siteId).lean();
      const siteName = site?.name || "";
      const roundName = round?.name || "";

      if (notifier?.assignment) {
        await notifier.assignment({
          userId: guardId, // ✅ sub
          email: null,
          siteName,
          roundName,
          startTime: doc.startTime,
          endTime: doc.endTime,
          assignmentId: String(doc._id),
        });
      } else if (req.io) {
        req.io.to(`guard-${guardId}`).emit("rondasqr:nueva-asignacion", {
          title: "Nueva ronda asignada",
          body: `${roundName} en ${siteName}`,
          meta: { id: doc._id, startTime: doc.startTime, endTime: doc.endTime },
        });
      }

      await RqAssignment.updateOne(
        { _id: doc._id },
        { $set: { notified: true, notifiedAt: new Date(), notifiedBy: "socket" } }
      );
    } catch (err) {
      console.warn("[assignments.notify] aviso:", err?.message || err);
    }

    const resp = { ok: true, item: doc };
    if (!payload.planId) resp.warning = "no_active_plan_found";
    res.status(201).json(resp);
  } catch (e) {
    if (e?.code === 11000)
      return res.status(409).json({ ok: false, error: "assignment_exists", message: "La asignación ya existe" });
    next(e);
  }
});

/* ───────────────────────────── DELETE ───────────────────────────── */
/* DELETE /admin/assignments/:id */
router.delete("/:id", async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!isObjectIdString(id))
      return res.status(400).json({ ok: false, error: "invalid_id", message: "ID inválido" });

    const r = await RqAssignment.deleteOne({ _id: id });
    res.json({ ok: true, deleted: r.deletedCount });
  } catch (e) {
    next(e);
  }
});

export default router;
