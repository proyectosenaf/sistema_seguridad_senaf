// modules/rondas/routes/reports.routes.js
import { Router } from "express";
import Zone from "../models/Zone.model.js";
import CP from "../models/Checkpoint.model.js";
import Shift from "../models/PatrolShift.model.js";
import Scan from "../models/ScanEvent.model.js";

const r = Router();

/* ---------- Helpers ---------- */

function parseRange(q) {
  // Acepta from/to, start/end, since/until (ISO o cualquier parseable por Date)
  const from =
    q.from || q.start || q.since
      ? new Date(q.from || q.start || q.since)
      : new Date(Date.now() - 7 * 24 * 3600 * 1000);
  const to =
    q.to || q.end || q.until
      ? new Date(q.to || q.end || q.until)
      : new Date();

  const start = isNaN(+from)
    ? new Date(Date.now() - 7 * 24 * 3600 * 1000)
    : from;
  const end = isNaN(+to) ? new Date() : to;

  return { start, end };
}

// coalesce para timestamps de scans
function scansTimeMatch(start, end) {
  return {
    $or: [
      { scannedAt: { $gte: start, $lte: end } },
      { at: { $gte: start, $lte: end } },
    ],
  };
}

// coalesce para timestamps de shifts
function shiftsTimeMatch(start, end) {
  return {
    $or: [
      { startedAt: { $gte: start, $lte: end } },
      { startAt: { $gte: start, $lte: end } },
    ],
  };
}

// colecciones reales definidas por Mongoose (evita hardcode)
const CP_COLL = CP.collection?.collectionName || CP.collection?.name || "checkpoints";
const ZONE_COLL = Zone.collection?.collectionName || Zone.collection?.name || "zones";

/* ---------- ENDPOINTS ---------- */

// GET /api/rondas/v1/reports/summary?from=...&to=...
r.get("/summary", async (req, res) => {
  const { start, end } = parseRange(req.query);

  try {
    // totales de scans (y por estado si tu modelo los guarda)
    const [totalScans, onTime, late] = await Promise.all([
      Scan.countDocuments(scansTimeMatch(start, end)),
      Scan.countDocuments({ ...scansTimeMatch(start, end), status: "ok" }).catch(() => 0),
      Scan.countDocuments({ ...scansTimeMatch(start, end), status: "late" }).catch(() => 0),
    ]);

    // "missed" suele venir de los shifts (progress.status === "missed")
    const missedAgg = await Shift.aggregate([
      { $match: { ...shiftsTimeMatch(start, end) } },
      { $unwind: "$progress" },
      { $match: { "progress.status": "missed" } },
      { $count: "missed" },
    ]).catch(() => []);
    const missed = missedAgg?.[0]?.missed || 0;

    // reportantes (guards) distintos: puedes basarte en scans o shifts
    const reporters = await Shift.distinct("guardId", shiftsTimeMatch(start, end)).catch(
      () => []
    );
    const reportersCount = Array.isArray(reporters) ? reporters.length : 0;

    const zonesCount = await Zone.countDocuments({}).catch(() => 0);

    // Por área (usando aggregate con $lookup dinámico)
    const perArea = await Scan.aggregate([
      { $match: scansTimeMatch(start, end) },
      {
        $lookup: {
          from: CP_COLL,
          localField: "checkpointId",
          foreignField: "_id",
          as: "cp",
        },
      },
      { $unwind: "$cp" },
      {
        $lookup: {
          from: ZONE_COLL,
          localField: "cp.zoneId",
          foreignField: "_id",
          as: "zone",
        },
      },
      { $unwind: "$zone" },
      {
        $group: {
          _id: "$zone._id",
          zone: { $first: "$zone.name" },
          value: { $sum: 1 },
        },
      },
      { $sort: { value: -1 } },
    ]).catch(() => []);

    // últimos eventos (para mapa/tabla rápida)
    const scans = await Scan.aggregate([
      { $match: scansTimeMatch(start, end) },
      {
        $addFields: {
          ts: { $ifNull: ["$scannedAt", "$at"] },
        },
      },
      { $sort: { ts: -1 } },
      { $limit: 200 },
      { $project: { ts: 1, geo: 1, checkpointId: 1, status: 1 } },
    ]).catch(() => []);

    return res.json({
      period: { from: start, to: end },
      // shape esperado por tu dashboard:
      totalScans,
      onTime,
      late,
      missed,
      reporters: reportersCount,
      zones: zonesCount,

      // extras útiles para otras vistas
      perArea,
      scans,
    });
  } catch (err) {
    console.error("[reports:summary] error:", err);
    return res.status(500).json({ ok: false, error: err?.message || "internal_error" });
  }
});

// CSV plano: /api/rondas/v1/reports/exports.csv?from=&to=
r.get("/exports.csv", async (req, res) => {
  const { start, end } = parseRange(req.query);

  try {
    const rows = await Scan.find(scansTimeMatch(start, end))
      .populate({
        path: "checkpointId",
        select: "code name zoneId",
        populate: { path: "zoneId", select: "name code" },
      })
      .sort({ scannedAt: -1, at: -1 })
      .lean();

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", "attachment; filename=rondas.csv");
    res.write("fecha,guardia,zona,checkpoint,lat,lng,estado\n");
    for (const r0 of rows) {
      const z = r0.checkpointId?.zoneId;
      const cp = r0.checkpointId;
      const lat = r0?.geo?.lat ?? "";
      const lng = r0?.geo?.lng ?? "";
      const ts = r0.scannedAt || r0.at || null;
      const status = r0.status || "";
      res.write(
        `${ts ? new Date(ts).toISOString() : ""},${r0.guardId || ""},${z?.name || ""},${
          cp?.name || ""
        },${lat},${lng},${status}\n`
      );
    }
    res.end();
  } catch (err) {
    console.error("[reports:csv] error:", err);
    res.status(500).json({ ok: false, error: err?.message || "internal_error" });
  }
});

// Excel: /api/rondas/v1/reports/exports.xlsx?from=&to=
r.get("/exports.xlsx", async (req, res) => {
  const { start, end } = parseRange(req.query);
  try {
    const ExcelJS = (await import("exceljs")).default;
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Rondas");

    ws.columns = [
      { header: "Fecha", key: "fecha", width: 24 },
      { header: "Guardia", key: "guard", width: 20 },
      { header: "Zona", key: "zone", width: 28 },
      { header: "Checkpoint", key: "cp", width: 28 },
      { header: "Lat", key: "lat", width: 12 },
      { header: "Lng", key: "lng", width: 12 },
      { header: "Estado", key: "status", width: 14 },
    ];

    const rows = await Scan.find(scansTimeMatch(start, end))
      .populate({
        path: "checkpointId",
        select: "name zoneId",
        populate: { path: "zoneId", select: "name" },
      })
      .sort({ scannedAt: -1, at: -1 })
      .lean();

    rows.forEach((r0) =>
      ws.addRow({
        fecha: r0.scannedAt || r0.at || null,
        guard: r0.guardId || "",
        zone: r0.checkpointId?.zoneId?.name || "",
        cp: r0.checkpointId?.name || "",
        lat: r0.geo?.lat,
        lng: r0.geo?.lng,
        status: r0.status || "",
      })
    );
    ws.getRow(1).font = { bold: true };

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader("Content-Disposition", "attachment; filename=rondas.xlsx");
    await wb.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error("[reports:xlsx] error:", err);
    res.status(500).json({ ok: false, error: err?.message || "internal_error" });
  }
});

// PDF sencillo: /api/rondas/v1/reports/exports.pdf?from=&to=
r.get("/exports.pdf", async (req, res) => {
  const { start, end } = parseRange(req.query);
  try {
    const PDFDocument = (await import("pdfkit")).default;
    const doc = new PDFDocument({ margin: 36 });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", "attachment; filename=rondas.pdf");
    doc.pipe(res);

    doc.fontSize(16).text("Reporte de Rondas", { align: "center" });
    doc.moveDown().fontSize(10).text(`Periodo: ${start.toISOString()} — ${end.toISOString()}`);
    doc.moveDown();

    const total = await Shift.countDocuments({
      ...shiftsTimeMatch(start, end),
      status: "completed",
    });
    doc.text(`Rondas completadas: ${total}`);
    doc.moveDown();

    const perArea = await Scan.aggregate([
      { $match: scansTimeMatch(start, end) },
      {
        $lookup: {
          from: CP_COLL,
          localField: "checkpointId",
          foreignField: "_id",
          as: "cp",
        },
      },
      { $unwind: "$cp" },
      {
        $lookup: {
          from: ZONE_COLL,
          localField: "cp.zoneId",
          foreignField: "_id",
          as: "zone",
        },
      },
      { $unwind: "$zone" },
      { $group: { _id: "$zone._id", zone: { $first: "$zone.name" }, value: { $sum: 1 } } },
      { $sort: { value: -1 } },
    ]);

    doc.text("Rondas por área:");
    perArea.forEach((x) => doc.text(`• ${x.zone}: ${x.value}`));

    doc.end();
  } catch (err) {
    console.error("[reports:pdf] error:", err);
    res.status(500).json({ ok: false, error: err?.message || "internal_error" });
  }
});

// (opcional) DOCX rápido: /api/rondas/v1/reports/exports.docx
r.get("/exports.docx", async (_req, res) => {
  try {
    const { Document, Packer, Paragraph, HeadingLevel } = await import("docx");
    const doc = new Document({
      sections: [
        {
          children: [
            new Paragraph({ text: "Reporte de Rondas", heading: HeadingLevel.TITLE }),
            new Paragraph({ text: "Generado por SENAF - Rondas" }),
          ],
        },
      ],
    });
    const buf = await Packer.toBuffer(doc);
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    );
    res.setHeader("Content-Disposition", "attachment; filename=rondas.docx");
    res.end(buf);
  } catch (err) {
    console.error("[reports:docx] error:", err);
    res.status(500).json({ ok: false, error: err?.message || "internal_error" });
  }
});

export default r;
