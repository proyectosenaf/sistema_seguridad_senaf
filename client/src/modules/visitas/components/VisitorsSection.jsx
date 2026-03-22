import React from "react";
import {
  sxCard,
  sxGhostBtn,
  sxPrimaryBtn,
  sxDangerBtn,
} from "../styles/styles.js";

export default function VisitorsSection({
  loading,
  filteredVisitors,
  savingExit,
  handleEditVisitor,
  handleExit,
  exportExcel,
  exportPDF,
}) {
  return (
    <section
      className="relative z-[2] p-4 md:p-5 overflow-x-auto text-sm rounded-[24px]"
      style={sxCard()}
    >
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
        <div
          className="font-semibold text-base"
          style={{ color: "var(--text)" }}
        >
          Lista de Visitantes
        </div>
      </div>

      <table className="w-full text-left border-collapse min-w-[1200px]">
        <thead
          className="text-xs uppercase"
          style={{ color: "var(--text-muted)" }}
        >
          <tr
            className="[&>th]:py-2 [&>th]:pr-4"
            style={{ borderBottom: "1px solid var(--border)" }}
          >
            <th>Visitante</th>
            <th>DNI</th>
            <th>Empresa</th>
            <th>Empleado</th>
            <th>Teléfono</th>
            <th>Tipo</th>
            <th>Acompañado</th>
            <th>Acompañantes</th>
            <th>Vehículo</th>
            <th>Entrada</th>
            <th>Salida</th>
            <th>Estado</th>
            <th className="text-right">Acciones</th>
          </tr>
        </thead>

        <tbody style={{ color: "var(--text)" }}>
          {loading ? (
            <tr>
              <td
                colSpan={13}
                className="py-6 text-center text-sm"
                style={{ color: "var(--text-muted)" }}
              >
                Cargando…
              </td>
            </tr>
          ) : filteredVisitors.length === 0 ? (
            <tr>
              <td
                colSpan={13}
                className="py-6 text-center text-sm"
                style={{ color: "var(--text-muted)" }}
              >
                Sin resultados
              </td>
            </tr>
          ) : (
            filteredVisitors.map((v) => (
              <tr
                key={v.id}
                className="text-sm [&>td]:py-3 [&>td]:pr-4 align-top"
                style={{ borderBottom: "1px solid var(--border)" }}
              >
                <td className="font-medium">{v.name}</td>
                <td style={{ color: "var(--text-muted)" }}>{v.document}</td>
                <td>{v.company}</td>
                <td>{v.employee}</td>
                <td>{v.phone || "—"}</td>
                <td>{v.kind || "Presencial"}</td>
                <td>{v.acompanado ? "Sí" : "No"}</td>
                <td className="max-w-[260px] whitespace-pre-wrap break-words">
                  {v.companionsSummary || "—"}
                </td>
                <td>{v.vehicleSummary}</td>
                <td>{v.entry}</td>
                <td style={{ color: "var(--text-muted)" }}>{v.exit}</td>
                <td>
                  {v.status === "Dentro" ? (
                    <span
                      className="px-2 py-1 rounded-full text-xs font-semibold"
                      style={{
                        background:
                          "color-mix(in srgb, #22c55e 12%, transparent)",
                        color: "#86efac",
                        border:
                          "1px solid color-mix(in srgb, #22c55e 36%, transparent)",
                      }}
                    >
                      Dentro
                    </span>
                  ) : (
                    <span
                      className="px-2 py-1 rounded-full text-xs font-semibold"
                      style={{
                        background:
                          "color-mix(in srgb, #64748b 16%, transparent)",
                        color: "#cbd5e1",
                        border:
                          "1px solid color-mix(in srgb, #64748b 36%, transparent)",
                      }}
                    >
                      Finalizada
                    </span>
                  )}
                </td>
                <td className="text-right">
                  <div className="flex flex-wrap gap-2 justify-end">
                    <button
                      type="button"
                      onClick={() => handleEditVisitor(v)}
                      className="px-2 py-1 rounded-md text-xs font-semibold transition"
                      style={sxPrimaryBtn()}
                    >
                      Editar
                    </button>

                    {v.status === "Dentro" ? (
                      <button
                        type="button"
                        disabled={savingExit === v.id}
                        onClick={() => handleExit(v.id)}
                        className="px-2 py-1 rounded-md text-xs font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed"
                        style={sxDangerBtn()}
                      >
                        {savingExit === v.id ? "…" : "⏏ Salida"}
                      </button>
                    ) : (
                      <span
                        className="text-xs"
                        style={{ color: "var(--text-muted)" }}
                      >
                        (cerrada)
                      </span>
                    )}
                  </div>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      <div className="mt-4 flex flex-col sm:flex-row justify-end gap-3">
        <button
          type="button"
          onClick={() => exportExcel(filteredVisitors)}
          className="px-3 py-2 text-sm rounded-lg transition"
          style={sxGhostBtn()}
          title="Exportar lista (xlsx)"
        >
          Exportar Excel
        </button>

        <button
          type="button"
          onClick={() => exportPDF(filteredVisitors)}
          className="px-3 py-2 text-sm rounded-lg transition"
          style={sxGhostBtn()}
          title="Exportar PDF"
        >
          Exportar PDF
        </button>
      </div>
    </section>
  );
}