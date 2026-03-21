// server/modules/rondasqr/routes/alerts.routes.js
import express from "express";
import RqAlert from "../models/RqAlert.model.js";
import RqMark from "../models/RqMark.model.js";
import { requirePermission } from "../../../src/middleware/permissions.js";

const router = express.Router();

const RONDASQR_PERMS = {
  ALERTS_READ: "rondasqr.alerts.read",
  ALERTS_WRITE: "rondasqr.alerts.write",
  INCIDENTS_READ: "rondasqr.incidents.read",
  INCIDENTS_WRITE: "rondasqr.incidents.write",
  ROUND_READ: "rondasqr.rounds.read",
  ROUND_WRITE: "rondasqr.rounds.write",
  SCAN_EXECUTE: "rondasqr.scan.execute",

  READ_LEGACY: "rondasqr.read",
  WRITE_LEGACY: "rondasqr.write",

  ALL: "*",
};

function safeTrim(value, fallback = "") {
  return String(value || "").trim() || fallback;
}

function safeNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function parseDateStart(value) {
  const v = safeTrim(value);
  if (!v) return null;
  const d = new Date(`${v} 00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function parseDateEnd(value) {
  const v = safeTrim(value);
  if (!v) return null;
  const d = new Date(`${v} 23:59:59.999`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function normalizeMeta(meta) {
  return meta && typeof meta === "object" && !Array.isArray(meta) ? meta : {};
}

router.post(
  "/",
  requirePermission(
    RONDASQR_PERMS.ALERTS_WRITE,
    RONDASQR_PERMS.INCIDENTS_WRITE,
    RONDASQR_PERMS.ROUND_WRITE,
    RONDASQR_PERMS.SCAN_EXECUTE,
    RONDASQR_PERMS.WRITE_LEGACY,
    RONDASQR_PERMS.ALL
  ),
  async (req, res, next) => {
    try {
      const {
        type,
        gps,
        officerEmail,
        officerName,
        siteId,
        roundId,
        steps = 0,
        meta = {},
      } = req.body || {};

      if (!["panic", "man_down", "immobility"].includes(type)) {
        return res.status(400).json({ error: "type inválido" });
      }

      const item = await RqAlert.create({
        type: safeTrim(type),
        gps: gps && typeof gps === "object" ? gps : undefined,
        officerEmail: safeTrim(officerEmail),
        officerName: safeTrim(officerName),
        siteId: siteId || null,
        roundId: roundId || null,
        steps: safeNumber(steps, 0),
        meta: normalizeMeta(meta),
      });

      res.status(201).json({ item });
    } catch (e) {
      next(e);
    }
  }
);

router.get(
  "/",
  requirePermission(
    RONDASQR_PERMS.ALERTS_READ,
    RONDASQR_PERMS.INCIDENTS_READ,
    RONDASQR_PERMS.ROUND_READ,
    RONDASQR_PERMS.READ_LEGACY,
    RONDASQR_PERMS.ALL
  ),
  async (req, res, next) => {
    try {
      const q = {};

      if (req.query.type) q.type = safeTrim(req.query.type);

      const from = parseDateStart(req.query.from);
      const to = parseDateEnd(req.query.to);

      if (from || to) {
        q.at = {};
        if (from) q.at.$gte = from;
        if (to) q.at.$lte = to;
      }

      if (req.query.siteId) q.siteId = req.query.siteId;
      if (req.query.roundId) q.roundId = req.query.roundId;

      if (req.query.officer) {
        const officer = safeTrim(req.query.officer);
        q.$or = [
          { officerEmail: officer },
          { officerName: officer },
          { guardId: officer },
          { guardName: officer },
        ];
      }

      const items = await RqAlert.find(q).sort({ at: -1 }).limit(500).lean();
      res.json({ items });
    } catch (e) {
      next(e);
    }
  }
);

export default router;