// src/controllers/reports.controller.js
import dayjs from "dayjs";
import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";
import RondaEvent from "../models/RondaEvent.js";
import Route from "../models/Route.js";

// Función auxiliar para obtener el resumen de SLA
async function getSlaSummaryData(query) {
  const { from, to, routeId } = query;
  const $match = {
    ts: { $gte: new Date(from), $lte: new Date(to) }
  };
  if (routeId) $match.routeId = routeId;

  const agg = await RondaEvent.aggregate([
    { $match },
    {
      $group: {
        _id: { routeId: "$routeId", result: "$result" },
        count: { $sum: 1 }
      }
    }
  ]);

  const byRoute = {};
  for (const r of agg) {
    const key = String(r._id.routeId);
    byRoute[key] ??= { ok:0, late:0, invalid:0, missed:0, out_of_order:0, total:0 };
    byRoute[key][r._id.result] += r.count;
    byRoute[key].total += r.count;
  }

  const ids = Object.keys(byRoute);
  const routes = await Route.find({ _id: { $in: ids } }).select("name").lean();
  const nameMap = Object.fromEntries(routes.map(r => [String(r._id), r.name]));

  const items = ids.map(k => ({
    routeId: k,
    routeName: nameMap[k] ?? k,
    ...byRoute[k],
    score: byRoute[k].total ? Math.round((byRoute[k].ok/byRoute[k].total)*100) : 0
  }));

  const totals = items.reduce((acc, it) => {
    acc.ok += it.ok; acc.late += it.late; acc.invalid += it.invalid; acc.total += it.total;
    return acc;
  }, { ok:0, late:0, invalid:0, total:0 });
  
  return { range: { from, to }, items, totals };
}


/** KPIs por rango (API) */
export async function slaSummary(req, res) {
  const data = await getSlaSummaryData(req.query);
  res.json(data);
}

/** Excel */
export async function slaExcel(req, res) {
  const data = await getSlaSummaryData(req.query);
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("SLA");
  ws.columns = [
    { header: "Ruta", key: "routeName", width: 28 },
    { header: "OK", key: "ok", width: 8 },
    { header: "Tarde", key: "late", width: 10 },
    { header: "Inválido", key: "invalid", width: 10 },
    { header: "Total", key: "total", width: 10 },
    { header: "Score (%)", key: "score", width: 12 },
  ];
  data.items.forEach(r => ws.addRow(r));

  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename="sla_${dayjs().format("YYYYMMDD_HHmm")}.xlsx"`);
  await wb.xlsx.write(res);
  res.end();
}

/** PDF */
export async function slaPdf(req, res) {
  const data = await getSlaSummaryData(req.query);
  const doc = new PDFDocument({ size: "A4", margin: 36 });
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `inline; filename="sla_${dayjs().format("YYYYMMDD_HHmm")}.pdf"`);

  doc.fontSize(16).text("Reporte SLA Rondas", { align: "center" });
  doc.moveDown(0.5);
  doc.fontSize(10).text(`Rango: ${data.range.from} a ${data.range.to}`);
  doc.moveDown();

  data.items.forEach(it => {
    doc.fontSize(12).text(it.routeName);
    doc.fontSize(10).text(`OK: ${it.ok}  Tarde: ${it.late}  Inválido: ${it.invalid}  Total: ${it.total}  Score: ${it.score}%`);
    doc.moveDown(0.5);
  });

  doc.end();
  doc.pipe(res);
}