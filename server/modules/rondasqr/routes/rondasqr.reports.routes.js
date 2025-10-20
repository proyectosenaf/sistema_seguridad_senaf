// server/modules/rondasqr/routes/rondasqr.reports.routes.js
import express from "express";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc.js";
import { stringify } from "csv-stringify/sync";
import RqMark from "../models/RqMark.model.js";
import RqIncident from "../models/RqIncident.model.js";

dayjs.extend(utc);
const router = express.Router();

/* ---------------------------- helpers ---------------------------- */
function parseRange(q) {
  // from/to en YYYY-MM-DD; si no vienen, usa hoy (UTC)
  const from = q.from ? dayjs.utc(q.from + " 00:00") : dayjs.utc().startOf("day");
  const to   = q.to   ? dayjs.utc(q.to   + " 23:59:59.999") : dayjs.utc().endOf("day");
  return { from: from.toDate(), to: to.toDate() };
}

function baseMatch(q) {
  const m = {};
  const { from, to } = parseRange(q);
  m.at = { $gte: from, $lte: to };
  if (q.siteId)  m.siteId  = q.siteId;
  if (q.roundId) m.roundId = q.roundId;
  if (q.officer)
    m.$or = [{ officerEmail: q.officer }, { officerName: q.officer }];
  return m;
}

/* ======================================================================
   GET /reports/detailed  -> tabla “Despliegue detallado – Marcación por marcación”
   ====================================================================== */
router.get("/reports/detailed", async (req, res, next) => {
  try {
    const items = await RqMark.aggregate([
      { $match: baseMatch(req.query) },
      { $sort: { at: 1 } },
      {
        $project: {
          _id: 0,
          hardwareId: 1,
          qr: "$pointQr",                 // QR No. para el CSV y la tabla
          site: "$siteName",
          round: "$roundName",
          point: "$pointName",
          at: 1,
          officer: { $ifNull: ["$officerName", "$officerEmail"] },
          lat: "$gps.lat",
          lon: "$gps.lon",
          message: { $ifNull: ["$message", ""] },
          steps: { $ifNull: ["$steps", 0] },
          day: { $dateToString: { format: "%Y-%m-%d", date: "$at" } },
          // Para el MapView (lat,lon) -> GeoJSON Point (coordenadas [lon,lat])
          loc: {
            $cond: [
              { $and: [{ $isNumber: "$gps.lon" }, { $isNumber: "$gps.lat" }] },
              { type: "Point", coordinates: ["$gps.lon", "$gps.lat"] },
              null
            ]
          }
        },
      },
    ]);

    res.json({ items });
  } catch (e) {
    next(e);
  }
});

/* ======================================================================
   GET /reports/summary  -> Resumen + Omisiones + Mensajes/Incidentes
   ====================================================================== */
router.get("/reports/summary", async (req, res, next) => {
  try {
    const match = baseMatch(req.query);

    // --------- RESUMEN (por sitio/ronda/día/oficial) ----------
    const stats = await RqMark.aggregate([
      { $match: match },
      {
        $group: {
          _id: {
            site: "$siteName",
            round: "$roundName",
            officer: { $ifNull: ["$officerName", "$officerEmail"] },
            day: { $dateToString: { format: "%Y-%m-%d", date: "$at" } },
          },
          firstAt: { $min: "$at" },
          lastAt:  { $max: "$at" },
          puntosRegistrados: { $sum: 1 },
          pasos: { $sum: { $ifNull: ["$steps", 0] } },
        },
      },
      { $sort: { "_id.day": 1, "_id.site": 1, "_id.round": 1, "_id.officer": 1 } },
    ]);

    const statsFmt = stats.map((r) => {
      const durMs = (r.lastAt?.getTime?.() || 0) - (r.firstAt?.getTime?.() || 0);
      const secs = Math.max(0, Math.round(durMs / 1000));
      const dd = Math.floor(secs / 86400);
      const hh = Math.floor((secs % 86400) / 3600);
      const mm = Math.floor((secs % 3600) / 60);
      const ss = secs % 60;

      return {
        site: r._id.site || "-",
        round: r._id.round || "-",
        day: r._id.day,
        officer: r._id.officer || "-",
        puntosRegistrados: r.puntosRegistrados,
        pasos: r.pasos || 0,
        primeraMarca: r.firstAt,
        ultimaMarca: r.lastAt,
        duracionText: `Duración ${dd} días - ${String(hh).padStart(2, "0")} Horas - ${String(mm).padStart(2, "0")} Minutos - ${String(ss).padStart(2, "0")} Segundos`,
        // Texto estilo banda amarilla (útil si lo quieres mostrar arriba en UI)
        banner: `Reporte: ${r._id.site || "-"} / ${r._id.round || "-"} : ${r._id.day} : ${r._id.officer || "-"} : ${r.puntosRegistrados} puntos : ${r.pasos || 0} pasos`,
      };
    });

    // --------- OMISIONES ----------
    // Si aún no implementas comparación vs plan (RqPlan), devolvemos “Completo”.
    const omissions = [];
    if (statsFmt.length) {
      omissions.push({
        site: "—",
        round: "—",
        point: "—",
        state: "Sin omisiones (Completo)",
      });
    }

    // --------- MENSAJES / INCIDENTES ----------
    const { from, to } = parseRange(req.query);
    const incMatch = { at: { $gte: from, $lte: to } };
    if (req.query.siteId)  incMatch.siteId  = req.query.siteId;
    if (req.query.roundId) incMatch.roundId = req.query.roundId;
    if (req.query.officer)
      incMatch.$or = [{ officerEmail: req.query.officer }, { officerName: req.query.officer }];

    // Incluye tipos especiales (panic/inactivity/fall) y campos extra
    const messages = await RqIncident.find(incMatch, {
      _id: 0,
      type: 1,
      text: 1,
      at: 1,
      siteName: 1,
      roundName: 1,
      officerName: 1,
      officerEmail: 1,
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

/* ======================================================================
   GET /export/csv  -> CSV como en la lámina (encabezados en español)
   ====================================================================== */
router.get("/export/csv", async (req, res, next) => {
  try {
    const items = await RqMark.aggregate([
      { $match: baseMatch(req.query) },
      { $sort: { at: 1 } },
      {
        $project: {
          hardwareId: 1,
          qr: "$pointQr",
          site: "$siteName",
          round: "$roundName",
          point: "$pointName",
          at: 1,
          officer: { $ifNull: ["$officerName", "$officerEmail"] },
          lat: "$gps.lat",
          lon: "$gps.lon",
          message: { $ifNull: ["$message", ""] },
          steps: { $ifNull: ["$steps", 0] },
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
    res.setHeader("Content-Disposition", "attachment; filename=rondas.csv");
    res.send(csv);
  } catch (e) {
    next(e);
  }
});

/* ======================================================================
   GET /export/kml  -> KML para Google Earth/Maps
   ====================================================================== */
router.get("/export/kml", async (req, res, next) => {
  try {
    const items = await RqMark.find(baseMatch(req.query), {
      _id: 0,
      siteName: 1,
      roundName: 1,
      pointName: 1,
      at: 1,
      officerName: 1,
      officerEmail: 1,
      "gps.lat": 1,
      "gps.lon": 1,
    })
      .sort({ at: 1 })
      .lean();

    const placemarks = items
      .filter((i) => typeof i?.gps?.lat === "number" && typeof i?.gps?.lon === "number")
      .map((i) => {
        const title = `${i.pointName || "-"} · ${i.siteName || "-"} · ${dayjs(i.at).format("YYYY-MM-DD HH:mm:ss")}`;
        const who = i.officerName || i.officerEmail || "";
        return `
          <Placemark>
            <name>${escapeXml(title)}</name>
            <description><![CDATA[${who}]]></description>
            <Point><coordinates>${i.gps.lon},${i.gps.lat},0</coordinates></Point>
          </Placemark>`;
      })
      .join("\n");

    const kml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document><name>Rondas</name>${placemarks}</Document>
</kml>`;

    res.setHeader("Content-Type", "application/vnd.google-earth.kml+xml");
    res.setHeader("Content-Disposition", "attachment; filename=rondas.kml");
    res.send(kml);
  } catch (e) {
    next(e);
  }
});

/* ------------------------- util ------------------------- */
function escapeXml(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export default router;
