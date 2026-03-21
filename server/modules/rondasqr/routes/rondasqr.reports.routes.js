// server/modules/rondasqr/routes/rondasqr.reports.routes.js
import express from "express";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc.js";
import { stringify } from "csv-stringify/sync";
import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";

import RqMark from "../models/RqMark.model.js";
import RqIncident from "../models/RqIncident.model.js";
import RqAssignment from "../models/RqAssignment.model.js";
import RqPlan from "../models/RqPlan.model.js";
import RqPoint from "../models/RqPoint.model.js";

import { requirePermission } from "../../../src/middleware/permissions.js";

dayjs.extend(utc);
const router = express.Router();

const RONDASQR_PERMS = {
  REPORTS_READ: "rondasqr.reports.read",
  REPORTS_EXPORT: "rondasqr.reports.export",
  ROUND_READ: "rondasqr.rounds.read",
  ROUND_WRITE: "rondasqr.rounds.write",
  INCIDENTS_READ: "rondasqr.incidents.read",
  ALERTS_READ: "rondasqr.alerts.read",
  ASSIGNMENTS_READ: "rondasqr.assignments.read",
  POINTS_READ: "rondasqr.points.read",
  SCAN_EXECUTE: "rondasqr.scan.execute",

  READ_LEGACY: "rondasqr.read",
  WRITE_LEGACY: "rondasqr.write",

  ALL: "*",
};

function requireReportsRead() {
  return requirePermission(
    RONDASQR_PERMS.REPORTS_READ,
    RONDASQR_PERMS.ROUND_READ,
    RONDASQR_PERMS.INCIDENTS_READ,
    RONDASQR_PERMS.ALERTS_READ,
    RONDASQR_PERMS.ASSIGNMENTS_READ,
    RONDASQR_PERMS.POINTS_READ,
    RONDASQR_PERMS.READ_LEGACY,
    RONDASQR_PERMS.ALL
  );
}

function requireReportsExport() {
  return requirePermission(
    RONDASQR_PERMS.REPORTS_EXPORT,
    RONDASQR_PERMS.REPORTS_READ,
    RONDASQR_PERMS.ROUND_READ,
    RONDASQR_PERMS.INCIDENTS_READ,
    RONDASQR_PERMS.ALERTS_READ,
    RONDASQR_PERMS.ASSIGNMENTS_READ,
    RONDASQR_PERMS.POINTS_READ,
    RONDASQR_PERMS.READ_LEGACY,
    RONDASQR_PERMS.ALL
  );
}

/* ---------------------------- helpers ---------------------------- */
function parseRange(q) {
  const from = q.from ? dayjs.utc(`${q.from} 00:00`) : dayjs.utc().startOf("day");
  const to = q.to ? dayjs.utc(`${q.to} 23:59:59.999`) : dayjs.utc().endOf("day");
  return { from: from.toDate(), to: to.toDate() };
}

function baseMatch(q) {
  const m = {};
  const { from, to } = parseRange(q);
  m.at = { $gte: from, $lte: to };
  if (q.siteId) m.siteId = q.siteId;
  if (q.roundId) m.roundId = q.roundId;
  if (q.officer) {
    m.$or = [
      { officerEmail: q.officer },
      { officerName: q.officer },
      { guardId: q.officer },
      { guardName: q.officer },
    ];
  }
  return m;
}

const geoProject = {
  lat: {
    $ifNull: [
      "$gps.lat",
      {
        $cond: [
          {
            $and: [
              { $isArray: "$loc.coordinates" },
              { $gte: [{ $size: "$loc.coordinates" }, 2] },
            ],
          },
          { $arrayElemAt: ["$loc.coordinates", 1] },
          null,
        ],
      },
    ],
  },
  lon: {
    $ifNull: [
      "$gps.lon",
      {
        $cond: [
          {
            $and: [
              { $isArray: "$loc.coordinates" },
              { $gte: [{ $size: "$loc.coordinates" }, 2] },
            ],
          },
          { $arrayElemAt: ["$loc.coordinates", 0] },
          null,
        ],
      },
    ],
  },
};

function officerExpr() {
  return {
    $ifNull: [
      "$officerName",
      {
        $ifNull: ["$officerEmail", { $ifNull: ["$guardName", "$guardId"] }],
      },
    ],
  };
}

function siteExpr() {
  return { $ifNull: ["$siteName", "-"] };
}
function roundExpr() {
  return { $ifNull: ["$roundName", "-"] };
}
function pointExpr() {
  return { $ifNull: ["$pointName", "-"] };
}
function qrExpr() {
  return { $ifNull: ["$pointQr", ""] };
}

function escapeXml(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

const aggKey = (date, guardId, roundId) => `${date}|${guardId}|${roundId}`;

async function buildAssignmentContexts(rows) {
  const groups = new Map();
  for (const r of rows) {
    const k = aggKey(r.date, r.guardId || "", r.roundId || "");
    if (!groups.has(k)) {
      groups.set(k, {
        date: r.date,
        guardId: r.guardId || "",
        roundId: r.roundId || "",
        siteId: r.siteId || "",
      });
    }
  }
  if (groups.size === 0) return new Map();

  const dates = [...new Set([...groups.values()].map((g) => g.date))];
  const guards = [...new Set([...groups.values()].map((g) => g.guardId))];
  const rounds = [...new Set([...groups.values()].map((g) => g.roundId))];

  const assignments = await RqAssignment.find({
    date: { $in: dates },
    guardId: { $in: guards },
    roundId: { $in: rounds },
  })
    .select({
      date: 1,
      guardId: 1,
      roundId: 1,
      siteId: 1,
      startTime: 1,
      endTime: 1,
      planId: 1,
      planSnap: 1,
    })
    .lean();

  const ctx = new Map();
  const pairKeys = new Set(
    [...groups.values()].map((g) => `${g.siteId}|${g.roundId}`)
  );
  const sitesNeeded = [...new Set([...pairKeys].map((x) => x.split("|")[0]).filter(Boolean))];
  const roundsNeeded = [...new Set([...pairKeys].map((x) => x.split("|")[1]).filter(Boolean))];
  const activePlans = await RqPlan.find({
    siteId: { $in: sitesNeeded },
    roundId: { $in: roundsNeeded },
    active: true,
  })
    .select({ siteId: 1, roundId: 1, points: 1 })
    .lean();
  const planByPair = activePlans.reduce(
    (m, p) => ((m[`${String(p.siteId)}|${String(p.roundId)}`] = p), m),
    {}
  );

  const assByKey = assignments.reduce(
    (m, a) => ((m[aggKey(a.date, a.guardId, String(a.roundId))] = a), m),
    {}
  );

  for (const g of groups.values()) {
    const a = assByKey[aggKey(g.date, g.guardId, g.roundId)];
    let startTime,
      endTime,
      winMap = {};
    if (a) {
      startTime = a.startTime;
      endTime = a.endTime;
      const pts =
        a.planSnap && a.planSnap.length
          ? a.planSnap
          : planByPair[`${g.siteId}|${g.roundId}`]?.points || [];
      winMap = {};
      for (const p of pts) {
        const pid = String(p.pointId || "");
        if (!pid) continue;
        winMap[pid] = {
          startMin: typeof p.windowStartMin === "number" ? p.windowStartMin : undefined,
          endMin: typeof p.windowEndMin === "number" ? p.windowEndMin : undefined,
          toleranceMin: typeof p.toleranceMin === "number" ? p.toleranceMin : 0,
        };
      }
    } else {
      const pts = planByPair[`${g.siteId}|${g.roundId}`]?.points || [];
      winMap = {};
      for (const p of pts) {
        const pid = String(p.pointId || "");
        if (!pid) continue;
        winMap[pid] = {
          startMin: typeof p.windowStartMin === "number" ? p.windowStartMin : undefined,
          endMin: typeof p.windowEndMin === "number" ? p.windowEndMin : undefined,
          toleranceMin: typeof p.toleranceMin === "number" ? p.toleranceMin : 0,
        };
      }
    }
    ctx.set(aggKey(g.date, g.guardId, g.roundId), { startTime, endTime, winMap });
  }
  return ctx;
}

function evalOnWindow(markISO, dateStr, pointId, ctxForKey) {
  if (!ctxForKey) return { onWindow: null };
  const w = ctxForKey.winMap?.[String(pointId || "")];
  const startTime = ctxForKey.startTime;

  if (!w || typeof w.startMin !== "number" || typeof w.endMin !== "number" || !startTime) {
    return {
      onWindow: null,
      windowStartMin: w?.startMin,
      windowEndMin: w?.endMin,
      toleranceMin: w?.toleranceMin ?? 0,
    };
  }

  const base = dayjs.utc(`${dateStr} ${startTime}:00`);
  const at = dayjs.utc(markISO);
  const diffMin = Math.floor((at.valueOf() - base.valueOf()) / 60000);
  const tol = w.toleranceMin ?? 0;

  const inWindow = diffMin >= w.startMin - tol && diffMin <= w.endMin + tol;
  return {
    onWindow: inWindow,
    windowStartMin: w.startMin,
    windowEndMin: w.endMin,
    toleranceMin: tol,
  };
}

async function fetchDetailedRows(q) {
  const items = await RqMark.aggregate([
    { $match: baseMatch(q) },
    { $sort: { at: 1 } },
    {
      $project: {
        hardwareId: 1,
        steps: { $ifNull: ["$steps", 0] },
        qr: qrExpr(),
        site: siteExpr(),
        round: roundExpr(),
        point: pointExpr(),
        at: 1,
        officer: officerExpr(),
        message: { $ifNull: ["$message", ""] },
        siteId: 1,
        roundId: 1,
        pointId: 1,
        guardId: { $ifNull: ["$guardId", ""] },
        ...geoProject,
      },
    },
  ]);

  if (items.length === 0) return [];

  const rowsBase = items.map((i) => ({
    date: dayjs(i.at).utc().format("YYYY-MM-DD"),
    time: dayjs(i.at).utc().format("HH:mm:ss"),
    at: i.at,
    siteName: i.site || "-",
    roundName: i.round || "-",
    pointName: i.point || "-",
    qr: i.qr || "",
    officer: i.officer || "",
    message: i.message || "",
    lat: typeof i.lat === "number" ? i.lat : "",
    lon: typeof i.lon === "number" ? i.lon : "",
    hardwareId: i.hardwareId || "",
    steps: i.steps || 0,
    siteId: i.siteId ? String(i.siteId) : "",
    roundId: i.roundId ? String(i.roundId) : "",
    pointId: i.pointId ? String(i.pointId) : "",
    guardId: i.guardId ? String(i.guardId) : "",
  }));

  const ctxMap = await buildAssignmentContexts(rowsBase);

  const rows = rowsBase.map((r) => {
    const ctx = ctxMap.get(aggKey(r.date, r.guardId, r.roundId));
    const ev = evalOnWindow(r.at, r.date, r.pointId, ctx);
    return {
      ...r,
      startTime: ctx?.startTime || "",
      endTime: ctx?.endTime || "",
      onWindow: ev.onWindow,
      windowStartMin: ev.windowStartMin,
      windowEndMin: ev.windowEndMin,
      toleranceMin: ev.toleranceMin,
    };
  });

  return rows;
}

async function computeOmissions(q) {
  const { from, to } = parseRange(q);

  const marks = await RqMark.find(baseMatch(q))
    .select({ at: 1, guardId: 1, roundId: 1, siteId: 1, pointId: 1 })
    .lean();

  const groups = new Map();
  for (const m of marks) {
    const day = dayjs(m.at).utc().format("YYYY-MM-DD");
    const k = aggKey(day, String(m.guardId || ""), String(m.roundId || ""));
    if (!groups.has(k)) {
      groups.set(k, {
        date: day,
        guardId: String(m.guardId || ""),
        roundId: String(m.roundId || ""),
        siteId: String(m.siteId || ""),
        scanned: new Set(),
      });
    }
    if (m.pointId) groups.get(k).scanned.add(String(m.pointId));
  }

  const assignments = await RqAssignment.find({
    date: {
      $gte: dayjs(from).utc().format("YYYY-MM-DD"),
      $lte: dayjs(to).utc().format("YYYY-MM-DD"),
    },
  })
    .select({ date: 1, guardId: 1, roundId: 1, siteId: 1, planId: 1, planSnap: 1 })
    .lean();

  for (const a of assignments) {
    const k = aggKey(a.date, a.guardId, String(a.roundId));
    if (!groups.has(k)) {
      groups.set(k, {
        date: a.date,
        guardId: a.guardId,
        roundId: String(a.roundId),
        siteId: String(a.siteId || ""),
        scanned: new Set(),
      });
    }
    groups.get(k).assignment = a;
  }

  if (groups.size === 0) return [];

  const roundPairs = [...new Set([...groups.values()].map((g) => `${g.siteId}|${g.roundId}`))];
  const pairSiteIds = roundPairs.map((p) => p.split("|")[0]).filter(Boolean);
  const pairRoundIds = roundPairs.map((p) => p.split("|")[1]).filter(Boolean);

  const activePlans = await RqPlan.find({
    siteId: { $in: pairSiteIds },
    roundId: { $in: pairRoundIds },
    active: true,
  })
    .select({ siteId: 1, roundId: 1, points: 1 })
    .lean();
  const activePlanMap = activePlans.reduce(
    (m, p) => ((m[`${String(p.siteId)}|${String(p.roundId)}`] = p), m),
    {}
  );

  const allPointIds = new Set();
  const omissions = [];
  for (const g of groups.values()) {
    let expected = [];
    if (g.assignment?.planSnap?.length) {
      expected = g.assignment.planSnap.map((p) => String(p.pointId)).filter(Boolean);
    } else {
      const plan = activePlanMap[`${g.siteId}|${g.roundId}`];
      if (plan?.points?.length)
        expected = plan.points.map((p) => String(p.pointId)).filter(Boolean);
    }

    expected.forEach((id) => allPointIds.add(id));

    const omitted = expected.filter((id) => !g.scanned.has(id));
    omitted.forEach((pid) => {
      omissions.push({
        date: g.date,
        siteId: g.siteId,
        roundId: g.roundId,
        guardId: g.guardId,
        pointId: pid,
        state: "Omitido",
      });
    });
  }

  const points = allPointIds.size
    ? await RqPoint.find({ _id: { $in: [...allPointIds] } })
        .select({ name: 1 })
        .lean()
    : [];
  const pointName = points.reduce((m, p) => ((m[String(p._id)] = p.name), m), {});

  return omissions.map((o) => ({
    ...o,
    pointName: pointName[o.pointId] || o.pointId,
  }));
}

router.get("/reports/detailed", requireReportsRead(), async (req, res, next) => {
  try {
    const rows = await fetchDetailedRows(req.query || {});
    res.json({ items: rows });
  } catch (e) {
    next(e);
  }
});

router.get("/reports/summary", requireReportsRead(), async (req, res, next) => {
  try {
    const match = baseMatch(req.query);

    const stats = await RqMark.aggregate([
      { $match: match },
      {
        $group: {
          _id: {
            site: siteExpr(),
            round: roundExpr(),
            officer: officerExpr(),
            day: { $dateToString: { format: "%Y-%m-%d", date: "$at" } },
          },
          firstAt: { $min: "$at" },
          lastAt: { $max: "$at" },
          puntosRegistrados: { $sum: 1 },
          pasos: { $sum: { $ifNull: ["$steps", 0] } },
          guardId: { $first: "$guardId" },
          officerName: { $first: "$officerName" },
          officerEmail: { $first: "$officerEmail" },
        },
      },
      {
        $sort: {
          "_id.day": 1,
          "_id.site": 1,
          "_id.round": 1,
          "_id.officer": 1,
        },
      },
    ]);

    const statsFmt = stats.map((r) => {
      const durMs =
        (r.lastAt?.getTime?.() || 0) - (r.firstAt?.getTime?.() || 0);
      const secs = Math.max(0, Math.round(durMs / 1000));
      const dd = Math.floor(secs / 86400);
      const hh = Math.floor((secs % 86400) / 3600);
      const mm = Math.floor((secs % 3600) / 60);
      const ss = secs % 60;

      const siteName = r._id.site || "-";
      const roundName = r._id.round || "-";
      const officerLabel = r._id.officer || "-";

      return {
        site: siteName,
        siteName,
        round: roundName,
        roundName,
        day: r._id.day,
        officer: officerLabel,
        guardId: r.guardId || "",
        officerName: r.officerName || "",
        officerEmail: r.officerEmail || "",
        puntosRegistrados: r.puntosRegistrados,
        pasos: r.pasos || 0,
        primeraMarca: r.firstAt,
        ultimaMarca: r.lastAt,
        duracionText: `Duración ${dd} días - ${String(hh).padStart(
          2,
          "0"
        )} Horas - ${String(mm).padStart(2, "0")} Minutos - ${String(
          ss
        ).padStart(2, "0")} Segundos`,
        banner: `Reporte: ${siteName} / ${roundName} : ${
          r._id.day
        } : ${officerLabel} : ${r.puntosRegistrados} puntos : ${
          r.pasos || 0
        } pasos`,
      };
    });

    const omissions = await computeOmissions(req.query);

    const { from, to } = parseRange(req.query);
    const incMatch = { at: { $gte: from, $lte: to } };
    if (req.query.siteId) incMatch.siteId = req.query.siteId;
    if (req.query.roundId) incMatch.roundId = req.query.roundId;
    if (req.query.officer) {
      incMatch.$or = [
        { officerEmail: req.query.officer },
        { officerName: req.query.officer },
        { guardId: req.query.officer },
        { guardName: req.query.officer },
      ];
    }

    const messages = await RqIncident.find(incMatch, {
      _id: 0,
      type: 1,
      text: 1,
      at: 1,
      siteName: 1,
      roundName: 1,
      officerName: 1,
      officerEmail: 1,
      guardId: 1,
      guardName: 1,
      gps: 1,
      durationMin: 1,
      stepsAtAlert: 1,
      fallDetected: 1,
    })
      .sort({ at: 1 })
      .lean();

    res.json({ stats: statsFmt, omissions, messages });
  } catch (e) {
    next(e);
  }
});

router.get("/reports/export/excel", requireReportsExport(), async (req, res, next) => {
  try {
    const wb = new ExcelJS.Workbook();

    const rowsDet = await fetchDetailedRows(req.query || {});

    const byOfficer = {};
    for (const r of rowsDet) {
      const k = r.officer || "-";
      byOfficer[k] = byOfficer[k] || { total: 0, inWin: 0, offWin: 0 };
      byOfficer[k].total += 1;
      if (r.onWindow === true) byOfficer[k].inWin += 1;
      else if (r.onWindow === false) byOfficer[k].offWin += 1;
    }

    const ws1 = wb.addWorksheet("Resumen");
    ws1.columns = [
      { header: "Oficial/Guardia", key: "officer", width: 32 },
      { header: "Total marcas", key: "total", width: 16 },
      { header: "En ventana", key: "inWin", width: 16 },
      { header: "Fuera de ventana", key: "offWin", width: 18 },
    ];
    Object.entries(byOfficer).forEach(([officer, v]) =>
      ws1.addRow({ officer, ...v })
    );
    ws1.getRow(1).font = { bold: true };

    const ws2 = wb.addWorksheet("Detalle");
    ws2.columns = [
      { header: "Fecha", key: "date", width: 12 },
      { header: "Hora", key: "time", width: 10 },
      { header: "Sitio", key: "siteName", width: 28 },
      { header: "Ronda", key: "roundName", width: 28 },
      { header: "Punto", key: "pointName", width: 28 },
      { header: "QR", key: "qr", width: 18 },
      { header: "Oficial", key: "officer", width: 28 },
      { header: "Inicio", key: "startTime", width: 10 },
      { header: "Fin", key: "endTime", width: 10 },
      { header: "En ventana", key: "onWindow", width: 12 },
      { header: "Win start", key: "windowStartMin", width: 12 },
      { header: "Win end", key: "windowEndMin", width: 12 },
      { header: "Tol (min)", key: "toleranceMin", width: 10 },
      { header: "Mensaje", key: "message", width: 40 },
      { header: "Lat", key: "lat", width: 12 },
      { header: "Lon", key: "lon", width: 12 },
      { header: "HW", key: "hardwareId", width: 14 },
      { header: "Pasos", key: "steps", width: 10 },
    ];
    rowsDet.forEach((r) =>
      ws2.addRow({
        ...r,
        onWindow: r.onWindow === null ? "" : r.onWindow ? "Sí" : "No",
      })
    );
    ws2.getRow(1).font = { bold: true };

    const omissions = await computeOmissions(req.query || {});
    const ws3 = wb.addWorksheet("Omisiones");
    ws3.columns = [
      { header: "Fecha", key: "date", width: 12 },
      { header: "Guardia/ID", key: "guardId", width: 20 },
      { header: "SiteId", key: "siteId", width: 24 },
      { header: "RoundId", key: "roundId", width: 24 },
      { header: "Punto", key: "pointName", width: 30 },
      { header: "Estado", key: "state", width: 16 },
    ];
    omissions.forEach((o) => ws3.addRow(o));
    ws3.getRow(1).font = { bold: true };

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="rondas_${Date.now()}.xlsx"`
    );
    await wb.xlsx.write(res);
    res.end();
  } catch (e) {
    next(e);
  }
});

router.get("/reports/export/pdf", requireReportsExport(), async (req, res, next) => {
  try {
    const rows = await fetchDetailedRows(req.query || {});
    const sum = rows.reduce(
      (a, r) => ((a[r.officer] = (a[r.officer] || 0) + 1), a),
      {}
    );
    const from = req.query.from || "-";
    const to = req.query.to || "-";

    const doc = new PDFDocument({ size: "A4", margin: 40 });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="rondas_${Date.now()}.pdf"`
    );

    doc.pipe(res);

    doc.fontSize(16).text("Informe de Rondas, Omisiones e Incidentes", {
      align: "center",
    });
    doc.moveDown(0.5);
    doc.fontSize(10).text(`Rango: ${from} → ${to}`);
    if (req.query.siteId) doc.text(`SiteId: ${req.query.siteId}`);
    if (req.query.roundId) doc.text(`RoundId: ${req.query.roundId}`);
    if (req.query.officer) doc.text(`Oficial: ${req.query.officer}`);
    doc.moveDown();

    doc.fontSize(12).text("Resumen por guardia");
    Object.entries(sum).forEach(([k, v]) =>
      doc.fontSize(10).text(`• ${k}: ${v}`)
    );
    doc.moveDown();

    doc.fontSize(12).text("Detalle");
    doc.moveDown(0.2);
    doc.fontSize(9).text(
      "Fecha | Hora | Sitio | Ronda | Punto | Oficial | En ventana"
    );
    doc.moveTo(doc.x, doc.y).lineTo(550, doc.y).stroke();

    rows.forEach((r) => {
      const onw =
        r.onWindow === null ? "-" : r.onWindow ? "Sí" : "No";
      const line = [
        r.date,
        r.time,
        r.siteName,
        r.roundName,
        r.pointName,
        r.officer,
        onw,
      ].join(" | ");
      doc.text(line, { width: 520 });
    });

    doc.end();
  } catch (e) {
    next(e);
  }
});

router.get("/reports/export/csv", requireReportsExport(), async (req, res, next) => {
  try {
    const items = await RqMark.aggregate([
      { $match: baseMatch(req.query) },
      { $sort: { at: 1 } },
      {
        $project: {
          hardwareId: 1,
          qr: qrExpr(),
          site: siteExpr(),
          round: roundExpr(),
          point: pointExpr(),
          at: 1,
          officer: officerExpr(),
          message: { $ifNull: ["$message", ""] },
          steps: { $ifNull: ["$steps", 0] },
          ...geoProject,
        },
      },
    ]);

    const rows = [
      [
        "Hardware ID",
        "QR No.",
        "Nombre Sitio",
        "Ronda",
        "Nombre punto",
        "Fecha / Hora",
        "Vigilante",
        "Latitud",
        "Longitud",
        "Mensaje",
        "Pasos",
      ],
      ...items.map((it) => [
        it.hardwareId || "",
        it.qr || "",
        it.site || "",
        it.round || "",
        it.point || "",
        dayjs(it.at).format("YYYY-MM-DD HH:mm:ss"),
        it.officer || "",
        it.lat ?? "",
        it.lon ?? "",
        it.message || "",
        it.steps || 0,
      ]),
    ];

    const csv = stringify(rows);
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=rondas.csv"
    );
    res.send(csv);
  } catch (e) {
    next(e);
  }
});

router.get("/reports/export/kml", requireReportsExport(), async (req, res, next) => {
  try {
    const items = await RqMark.aggregate([
      { $match: baseMatch(req.query) },
      { $sort: { at: 1 } },
      {
        $project: {
          site: siteExpr(),
          round: roundExpr(),
          point: pointExpr(),
          at: 1,
          officer: officerExpr(),
          ...geoProject,
        },
      },
    ]);

    const placemarks = items
      .filter(
        (i) => typeof i?.lat === "number" && typeof i?.lon === "number"
      )
      .map((i) => {
        const title = `${i.point || "-"} · ${i.site || "-"} · ${dayjs(
          i.at
        ).format("YYYY-MM-DD HH:mm:ss")}`;
        const who = i.officer || "";
        return `
          <Placemark>
            <name>${escapeXml(title)}</name>
            <description><![CDATA[${who}]]></description>
            <Point><coordinates>${i.lon},${i.lat},0</coordinates></Point>
          </Placemark>`;
      })
      .join("\n");

    const kml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document><name>Rondas</name>${placemarks}</Document>
</kml>`;

    res.setHeader(
      "Content-Type",
      "application/vnd.google-earth.kml+xml"
    );
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=rondas.kml"
    );
    res.send(kml);
  } catch (e) {
    next(e);
  }
});

export default router;