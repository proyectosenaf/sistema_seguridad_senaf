import { Router } from "express";
import mongoose from "mongoose";
import Zone from "../models/Zone.model.js";
import CP from "../models/Checkpoint.model.js";
import Shift from "../models/PatrolShift.model.js";
import Scan from "../models/ScanEvent.model.js";

const r = Router();

function parseRange(q) {
  const start = q.start ? new Date(q.start) : new Date(Date.now() - 7*24*3600e3);
  const end   = q.end   ? new Date(q.end)   : new Date();
  return { start, end };
}

// GET /api/rondas/v1/reports/summary?start=2025-10-01&end=2025-10-04
r.get("/summary", async (req, res) => {
  const { start, end } = parseRange(req.query);

  const [totalSimple, areas, users, perArea] = await Promise.all([
    // “Rondas simples” = shifts completados en rango
    Shift.countDocuments({ status: "completed", startAt: { $gte: start, $lte: end } }),
    Zone.countDocuments({}),
    Shift.distinct("guardId", { startAt: { $gte: start, $lte: end } }).then(x => x.length),
    // Conteo por zona (usamos shifts + scans para un aproximado)
    Scan.aggregate([
      { $match: { at: { $gte: start, $lte: end } } },
      { $lookup: { from: "senafRondas_checkpoints", localField: "checkpointId", foreignField: "_id", as: "cp" } },
      { $unwind: "$cp" },
      { $lookup: { from: "senafRondas_zones", localField: "cp.zoneId", foreignField: "_id", as: "zone" } },
      { $unwind: "$zone" },
      { $group: { _id: "$zone._id", zone: { $first: "$zone.name" }, value: { $sum: 1 } } },
      { $sort: { value: -1 } }
    ])
  ]);

  // Últimos escaneos (para mapa/tabla rápida)
  const scans = await Scan.find({ at: { $gte: start, $lte: end } })
    .sort({ at: -1 }).limit(200)
    .select({ at: 1, geo: 1, checkpointId: 1 }).lean();

  res.json({
    period: { start, end },
    cards: {
      totalSimple,                 // Rondas simples realizadas
      areas,                       // Áreas registradas con rondas
      users                        // Usuarios reportantes
    },
    perArea,                       // [{_id, zone, value}]
    scans                          // últimos eventos con geo (para mapa)
  });
});

// --------- Exportaciones ---------

// CSV plano: /api/rondas/v1/reports/exports.csv?start=&end=
r.get("/exports.csv", async (req, res) => {
  const { start, end } = parseRange(req.query);
  const rows = await Scan.find({ at: { $gte: start, $lte: end } })
    .populate({ path: "checkpointId", select: "code name zoneId", populate: { path: "zoneId", select: "name code" } })
    .sort({ at: -1 }).lean();

  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", "attachment; filename=rondas.csv");
  res.write("fecha,guardia,zone,checkpoint,lat,lng\n");
  for (const r0 of rows) {
    const z = r0.checkpointId?.zoneId;
    const cp = r0.checkpointId;
    const lat = r0?.geo?.lat ?? "";
    const lng = r0?.geo?.lng ?? "";
    res.write(`${r0.at.toISOString()},${r0.guardId || ""},${z?.name || ""},${cp?.name || ""},${lat},${lng}\n`);
  }
  res.end();
});

// Excel: /api/rondas/v1/reports/exports.xlsx?start=&end=
r.get("/exports.xlsx", async (req, res) => {
  const { start, end } = parseRange(req.query);
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
  ];

  const rows = await Scan.find({ at: { $gte: start, $lte: end } })
    .populate({ path: "checkpointId", select: "name zoneId", populate: { path: "zoneId", select: "name" } })
    .sort({ at: -1 }).lean();

  rows.forEach(r0 => ws.addRow({
    fecha: r0.at, guard: r0.guardId || "",
    zone: r0.checkpointId?.zoneId?.name || "",
    cp: r0.checkpointId?.name || "",
    lat: r0.geo?.lat, lng: r0.geo?.lng
  }));
  ws.getRow(1).font = { bold: true };

  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", "attachment; filename=rondas.xlsx");
  await wb.xlsx.write(res);
  res.end();
});

// PDF sencillo: /api/rondas/v1/reports/exports.pdf?start=&end=
r.get("/exports.pdf", async (req, res) => {
  const { start, end } = parseRange(req.query);
  const PDFDocument = (await import("pdfkit")).default;
  const doc = new PDFDocument({ margin: 36 });
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", "attachment; filename=rondas.pdf");
  doc.pipe(res);

  doc.fontSize(16).text("Reporte de Rondas", { align: "center" });
  doc.moveDown().fontSize(10).text(`Periodo: ${start.toISOString()} — ${end.toISOString()}`);
  doc.moveDown();

  const total = await Shift.countDocuments({ status: "completed", startAt: { $gte: start, $lte: end } });
  doc.text(`Rondas completadas: ${total}`);
  doc.moveDown();

  const perArea = await Scan.aggregate([
    { $match: { at: { $gte: start, $lte: end } } },
    { $lookup: { from: "senafRondas_checkpoints", localField: "checkpointId", foreignField: "_id", as: "cp" } },
    { $unwind: "$cp" },
    { $lookup: { from: "senafRondas_zones", localField: "cp.zoneId", foreignField: "_id", as: "zone" } },
    { $unwind: "$zone" },
    { $group: { _id: "$zone._id", zone: { $first: "$zone.name" }, value: { $sum: 1 } } },
    { $sort: { value: -1 } }
  ]);
  doc.text("Rondas por área:");
  perArea.forEach(x => doc.text(`• ${x.zone}: ${x.value}`));

  doc.end();
});

// (opcional) DOCX rápido: /api/rondas/v1/reports/exports.docx
r.get("/exports.docx", async (_req, res) => {
  const { Document, Packer, Paragraph, HeadingLevel } = await import("docx");
  const doc = new Document({
    sections: [{ children: [
      new Paragraph({ text: "Reporte de Rondas", heading: HeadingLevel.TITLE }),
      new Paragraph({ text: "Generado por SENAF - Rondas" })
    ]}]
  });
  const buf = await Packer.toBuffer(doc);
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
  res.setHeader("Content-Disposition", "attachment; filename=rondas.docx");
  res.end(buf);
});

export default r;
