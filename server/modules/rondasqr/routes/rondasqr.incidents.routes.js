// server/modules/rondasqr/routes/rondasqr.incidents.routes.js
import { Router } from "express";
import fs from "node:fs";
import path from "node:path";
import RqIncident from "../models/RqIncident.model.js";
import { requirePermission } from "../../../src/middleware/permissions.js";

const r = Router();

const RONDASQR_PERMS = {
  INCIDENTS_READ: "rondasqr.incidents.read",
  INCIDENTS_WRITE: "rondasqr.incidents.write",
  INCIDENTS_DELETE: "rondasqr.incidents.delete",
  ROUND_READ: "rondasqr.rounds.read",
  ROUND_WRITE: "rondasqr.rounds.write",
  CHECKS_WRITE: "rondasqr.checks.write",
  SCAN_EXECUTE: "rondasqr.scan.execute",

  READ_LEGACY: "rondasqr.read",
  WRITE_LEGACY: "rondasqr.write",

  ALL: "*",
};

const UP_BASE = path.resolve(process.cwd(), "uploads", "incidents");
fs.mkdirSync(UP_BASE, { recursive: true });

function safeTrim(value, fallback = "") {
  return String(value || "").trim() || fallback;
}

function getActor(req) {
  const u = req.user || req?.auth || req?.auth?.payload || req?.iam?.user || {};
  return {
    id: String(u._id || u.id || u.sub || req?.iam?.sub || "dev").trim(),
    name: String(u.name || u.nombreCompleto || u.email || "Anónimo").trim(),
    email: String(u.email || req?.iam?.email || "").trim(),
  };
}

r.post(
  "/incidents",
  requirePermission(
    RONDASQR_PERMS.INCIDENTS_WRITE,
    RONDASQR_PERMS.ROUND_WRITE,
    RONDASQR_PERMS.CHECKS_WRITE,
    RONDASQR_PERMS.SCAN_EXECUTE,
    RONDASQR_PERMS.WRITE_LEGACY,
    RONDASQR_PERMS.ALL
  ),
  async (req, res) => {
    try {
      const {
        siteId,
        roundId,
        pointId,
        type = "custom",
        text = "",
        lat,
        lon,
        photosBase64 = [],
      } = req.body || {};

      const actor = getActor(req);

      const photos = [];

      for (const b64 of Array.isArray(photosBase64) ? photosBase64 : []) {
        if (typeof b64 !== "string") continue;

        const m = b64.match(/^data:(.+);base64,(.+)$/);
        if (!m) continue;

        const mime = m[1] || "application/octet-stream";
        const base64Body = m[2] || "";

        const ext = mime.split("/")[1] || "bin";
        const buf = Buffer.from(base64Body, "base64");

        const filename = `${Date.now()}_${Math.random()
          .toString(36)
          .slice(2)}.${ext}`;

        const full = path.join(UP_BASE, filename);
        fs.writeFileSync(full, buf);

        photos.push(`/uploads/incidents/${filename}`);
      }

      const hasLat = lat != null && lat !== "";
      const hasLon = lon != null && lon !== "";

      const loc =
        hasLat && hasLon
          ? {
              type: "Point",
              coordinates: [Number(lon), Number(lat)],
            }
          : undefined;

      const inc = await RqIncident.create({
        type: safeTrim(type, "custom"),
        text: safeTrim(text),
        siteId: siteId || null,
        roundId: roundId || null,
        pointId: pointId || null,
        guardId: actor.id,
        guardName: actor.name,
        officerName: actor.name,
        officerEmail: actor.email,
        photos,
        gps:
          hasLat && hasLon
            ? { lat: Number(lat), lon: Number(lon) }
            : undefined,
        loc,
      });

      return res.json({
        ok: true,
        incidentId: inc._id,
        photos,
      });
    } catch (err) {
      console.error("[rondasqr.incidents] create error:", err);
      return res.status(500).json({
        ok: false,
        message: "Error al crear incidente",
      });
    }
  }
);

export default r;