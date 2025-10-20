// services/export.service.js
import fs from "fs";
import path from "path";
import RqMark from "../models/RqMark.model.js";
const TMP = process.env.RQ_EXPORT_TMP || "/tmp";

function toCSV(rows) {
  const header = Object.keys(rows[0]||{});
  const lines = [header.join(",")].concat(rows.map(r=>header.map(k=>JSON.stringify(r[k]??"")).join(",")));
  return lines.join("\n");
}

export default {
  async exportCSV(q) {
    const { from, to, siteId, roundId } = q;
    const filter = { at: { $gte:new Date(from+"T00:00:00Z"), $lte:new Date(to+"T23:59:59Z") },
      ...(siteId?{siteId}:{ }), ...(roundId?{roundId}:{ }) };
    const items = await RqMark.find(filter).sort({ at:1 }).lean();
    const rows = items.map(it => ({
      hardwareId: it.hardwareId, qrNo: it.qrNo, sitio: it.siteId, ronda: it.roundId,
      punto: it.pointName, fechaHora: it.at.toISOString(), oficial: it.guardName,
      latitud: it.loc?.coordinates?.[1], longitud: it.loc?.coordinates?.[0],
      mensaje: it.message || "", pasos: it.steps || 0
    }));
    const file = path.join(TMP, `rondas_${Date.now()}.csv`);
    fs.writeFileSync(file, toCSV(rows));
    return file;
  },

  async exportKML(q) {
    const { from, to, siteId, roundId } = q;
    const filter = { at: { $gte:new Date(from+"T00:00:00Z"), $lte:new Date(to+"T23:59:59Z") },
      ...(siteId?{siteId}:{ }), ...(roundId?{roundId}:{ }) };
    const items = (await RqMark.find(filter).sort({ at:1 }).lean())
      .filter(m=>m.loc?.coordinates?.length===2);

    const placemarks = items.map(m => `
      <Placemark>
        <name>${m.pointName || "Marca"}</name>
        <description>${m.guardName} - ${m.at.toISOString()}</description>
        <Point><coordinates>${m.loc.coordinates[0]},${m.loc.coordinates[1]},0</coordinates></Point>
      </Placemark>`).join("\n");

    const kml = `<?xml version="1.0" encoding="UTF-8"?>
      <kml xmlns="http://www.opengis.net/kml/2.2"><Document>
      ${placemarks}
      </Document></kml>`;

    const file = path.join(TMP, `rondas_${Date.now()}.kml`);
    fs.writeFileSync(file, kml);
    return file;
  }
};
