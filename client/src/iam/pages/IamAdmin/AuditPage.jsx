import React, { useEffect, useState, useMemo } from "react";
import { iamApi } from "../../api/iamApi.js";
import { saveAs } from "file-saver";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export default function AuditPage() {
  const [audits, setAudits] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  // Filtros
  const [filterAction, setFilterAction] = useState("");
  const [filterEntity, setFilterEntity] = useState("");
  const [filterActor, setFilterActor] = useState("");
  const [dateFrom, setDateFrom] = useState(""); // "YYYY-MM-DD"
  const [dateTo, setDateTo] = useState("");     // "YYYY-MM-DD"
  const [dateErr, setDateErr] = useState("");

  // -------- Fetch ----------
  async function fetchAudits() {
    try {
      setErr("");
      setLoading(true);
      const res = await iamApi.listAudit(1000); // traemos más por si el rango es amplio
      const items = res?.items ?? res?.data?.items ?? [];
      setAudits(Array.isArray(items) ? items : []);
      setFiltered(Array.isArray(items) ? items : []);
    } catch (e) {
      setErr(e?.message || "No se pudo cargar el historial de auditoría");
      setAudits([]);
      setFiltered([]);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { fetchAudits(); }, []);

  // -------- Helpers de fecha ----------
  const toStartOfDay = (s) => {
    if (!s) return null;
    const d = new Date(s + "T00:00:00");
    return isNaN(d.getTime()) ? null : d;
  };
  const toEndOfDay = (s) => {
    if (!s) return null;
    const d = new Date(s + "T23:59:59.999");
    return isNaN(d.getTime()) ? null : d;
  };

  // -------- Filters ----------
  useEffect(() => {
    let list = [...audits];

    // Validación de fechas
    const from = toStartOfDay(dateFrom);
    const to = toEndOfDay(dateTo);
    if (from && to && from > to) {
      setDateErr("La fecha 'desde' no puede ser mayor que 'hasta'.");
    } else {
      setDateErr("");
    }

    // Rango de fechas
    if (from) {
      list = list.filter((a) => {
        const t = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        return t >= from.getTime();
      });
    }
    if (to) {
      list = list.filter((a) => {
        const t = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        return t <= to.getTime();
      });
    }

    // Otros filtros
    if (filterAction) list = list.filter((a) => a.action === filterAction);
    if (filterEntity) list = list.filter((a) => a.entity === filterEntity);
    if (filterActor)
      list = list.filter((a) =>
        (a.actorEmail || a.actorId || "")
          .toLowerCase()
          .includes(filterActor.toLowerCase())
      );

    setFiltered(list);
  }, [filterAction, filterEntity, filterActor, dateFrom, dateTo, audits]);

  // -------- Export Excel (usa filtrados) ----------
  const exportExcel = () => {
    const rows = filtered.map((a) => ({
      Fecha: a.createdAt ? new Date(a.createdAt).toLocaleString() : "",
      Acción: a.action,
      Entidad: a.entity,
      Actor: a.actorEmail || a.actorId || "",
      Antes: a.before ? JSON.stringify(a.before) : "",
      Después: a.after ? JSON.stringify(a.after) : "",
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Auditoría");
    const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    saveAs(new Blob([buf], { type: "application/octet-stream" }), "auditoria.xlsx");
  };

  // -------- Export PDF (usa filtrados) ----------
  const exportPDF = async () => {
    const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
    const marginX = 40;
    const marginY = 32;
    const generatedAt = new Date().toLocaleString();

    doc.setFontSize(14);
    doc.text("Sistema SENAF - Historial de Auditoría", marginX, marginY);
    doc.setFontSize(10);
    doc.text(`Generado: ${generatedAt}`, marginX, marginY + 12);

    // Texto del rango (si aplica)
    let rango = "";
    if (dateFrom && dateTo) rango = `Rango: ${dateFrom} → ${dateTo}`;
    else if (dateFrom) rango = `Desde: ${dateFrom}`;
    else if (dateTo) rango = `Hasta: ${dateTo}`;
    if (rango) doc.text(rango, doc.internal.pageSize.getWidth() - marginX, marginY + 12, { align: "right" });

    const body = filtered.map((a) => [
      a.createdAt ? new Date(a.createdAt).toLocaleString() : "",
      a.action,
      a.entity,
      a.actorEmail || a.actorId || "",
      a.before ? JSON.stringify(a.before) : "",
      a.after ? JSON.stringify(a.after) : "",
    ]);

    autoTable(doc, {
      startY: marginY + 22,
      head: [["Fecha", "Acción", "Entidad", "Actor", "Antes", "Después"]],
      body,
      styles: { fontSize: 9, cellPadding: 4 },
      headStyles: { fillColor: [32, 32, 32] },
    });
    doc.save("auditoria.pdf");
  };

  // -------- UI helpers ----------
  const actions = useMemo(() => [...new Set(audits.map((a) => a.action))], [audits]);
  const entities = useMemo(() => [...new Set(audits.map((a) => a.entity))], [audits]);
  const zebra = useMemo(
    () => filtered.map((_, i) => (i % 2 === 0 ? "bg-white/5" : "bg-white/[0.03]")),
    [filtered]
  );

  return (
    <div className="min-h-[calc(100vh-4rem)] relative">
      {/* Fondo tipo SENAF */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-70"
        style={{
          background:
            "radial-gradient(1000px 600px at 10% 10%, rgba(0,255,255,0.08), transparent 60%), radial-gradient(800px 500px at 90% 20%, rgba(168,85,247,0.10), transparent 60%)",
        }}
      />

      {/* Contenido */}
      <div className="relative z-10 space-y-6 p-4 md:p-6">
        {/* HEADER */}
        <div className="rounded-2xl border border-gray-700/40 bg-neutral-900/80 backdrop-blur-md p-6 shadow-[0_0_30px_rgba(0,0,0,0.2)]">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-semibold text-slate-100">Historial de Auditoría</h1>
              <p className="text-sm text-slate-400">
                Bitácora de acciones sobre usuarios, roles y permisos
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={fetchAudits}
                className="px-3 py-2 rounded-lg bg-slate-800 text-white hover:bg-slate-700"
              >
                Actualizar
              </button>
              <button
                onClick={exportExcel}
                className="px-3 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-500"
                disabled={!!dateErr}
                title={dateErr || ""}
              >
                Excel
              </button>
              <button
                onClick={exportPDF}
                className="px-3 py-2 rounded-lg bg-rose-600 text-white hover:bg-rose-500"
                disabled={!!dateErr}
                title={dateErr || ""}
              >
                PDF
              </button>
            </div>
          </div>

          {/* Filtros (sobrios) */}
          <div className="mt-4 grid grid-cols-1 md:grid-cols-5 gap-3">
            <select
              className="bg-neutral-800 border border-gray-700 rounded-lg px-3 py-2 text-slate-200 focus:outline-none"
              value={filterAction}
              onChange={(e) => setFilterAction(e.target.value)}
            >
              <option value="">Todas las acciones</option>
              {actions.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>

            <select
              className="bg-neutral-800 border border-gray-700 rounded-lg px-3 py-2 text-slate-200 focus:outline-none"
              value={filterEntity}
              onChange={(e) => setFilterEntity(e.target.value)}
            >
              <option value="">Todas las entidades</option>
              {entities.map((e) => (
                <option key={e} value={e}>
                  {e}
                </option>
              ))}
            </select>

            <input
              type="text"
              placeholder="Buscar actor…"
              className="bg-neutral-800 border border-gray-700 rounded-lg px-3 py-2 text-slate-200 placeholder-slate-500 focus:outline-none"
              value={filterActor}
              onChange={(e) => setFilterActor(e.target.value)}
            />

            <input
              type="date"
              className="bg-neutral-800 border border-gray-700 rounded-lg px-3 py-2 text-slate-200 focus:outline-none"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
            />
            <input
              type="date"
              className="bg-neutral-800 border border-gray-700 rounded-lg px-3 py-2 text-slate-200 focus:outline-none"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
            />
          </div>

          {dateErr && (
            <div className="mt-2 text-xs text-rose-300">{dateErr}</div>
          )}
        </div>

        {/* TABLA */}
        <div className="rounded-2xl border border-gray-700/40 bg-neutral-900/80 backdrop-blur-md overflow-hidden shadow-[0_0_30px_rgba(0,0,0,0.2)]">
          {err && <div className="p-3 text-rose-300 text-sm">{err}</div>}

          <div className="overflow-auto">
            <table className="min-w-full text-sm text-slate-200">
              <thead className="sticky top-0 bg-neutral-800/95 backdrop-blur">
                <tr className="[&>th]:px-3 [&>th]:py-2 [&>th]:font-semibold border-b border-gray-700/60">
                  <th>Fecha</th>
                  <th>Acción</th>
                  <th>Entidad</th>
                  <th>Actor</th>
                  <th>Antes</th>
                  <th>Después</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="6" className="text-center py-12 text-slate-400">
                      Cargando…
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="text-center py-12 text-slate-400">
                      Sin registros
                    </td>
                  </tr>
                ) : (
                  filtered.map((a, i) => (
                    <tr
                      key={a._id || i}
                      className={`${zebra[i]} hover:bg-slate-800/50 transition-colors border-b border-gray-800`}
                    >
                      <td className="px-3 py-2 text-slate-300">
                        {a.createdAt ? new Date(a.createdAt).toLocaleString() : ""}
                      </td>
                      <td className="px-3 py-2">
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-white/5 text-slate-200 ring-1 ring-white/10">
                          {a.action}
                        </span>
                      </td>
                      <td className="px-3 py-2">{a.entity || "—"}</td>
                      <td className="px-3 py-2 text-slate-300">
                        {a.actorEmail || a.actorId || "—"}
                      </td>
                      <td className="px-3 py-2 text-xs font-mono text-slate-400 whitespace-pre-wrap">
                        {JSON.stringify(a.before || {}, null, 1)}
                      </td>
                      <td className="px-3 py-2 text-xs font-mono text-slate-400 whitespace-pre-wrap">
                        {JSON.stringify(a.after || {}, null, 1)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Resumen */}
          <div className="px-4 py-3 text-[12px] text-slate-400 border-t border-gray-800">
            Mostrando <span className="text-slate-200">{filtered.length}</span> de{" "}
            <span className="text-slate-200">{audits.length}</span> registros totales
            {dateFrom || dateTo ? (
              <> · rango aplicado {dateFrom || "—"} → {dateTo || "—"}</>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

