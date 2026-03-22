import React from "react";
import { useNavigate } from "react-router-dom";
import CitaEstadoPill from "./CitaEstadoPill.jsx";
import {
  getRenderableQrValue,
  normalizeCitaEstado,
} from "../utils/helpers.js";
import {
  sxCard,
  sxGhostBtn,
  sxPrimaryBtn,
  sxSuccessBtn,
  sxDangerBtn,
} from "../styles/styles.js";

export default function CitasSection({
  isVisitor,
  filteredCitas,
  savingCitaAction,
  setQrCita,
  updateCitaStatus,
  handleRegistrarIngreso,
  exportCitasExcel,
  exportCitasPDF,
}) {
  const navigate = useNavigate();

  return (
    <section className="p-4 md:p-5 text-sm rounded-[24px]" style={sxCard()}>
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
        <div>
          <div
            className="font-semibold text-base"
            style={{ color: "var(--text)" }}
          >
            {isVisitor
              ? "Mis citas registradas"
              : "Solicitudes en línea (pre-registro)"}
          </div>
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            {isVisitor
              ? "Aquí solo ves las citas asociadas a tu correo o documento."
              : "Citas agendadas por los visitantes para revisión del guardia"}
          </p>
        </div>

        {!isVisitor && (
          <button
            type="button"
            onClick={() => navigate("/visitas/agenda")}
            className="text-xs self-start md:self-auto underline-offset-4 hover:underline relative z-10"
            style={{ color: "#60a5fa" }}
          >
            Ver agenda completa →
          </button>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[1100px]">
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
              <th>Motivo</th>
              <th>Teléfono</th>
              <th>Tipo de cita</th>
              <th>Fecha</th>
              <th>Hora</th>
              <th>Estado</th>
              <th className="text-right">Acciones</th>
            </tr>
          </thead>

          <tbody style={{ color: "var(--text)" }}>
            {filteredCitas.length === 0 ? (
              <tr>
                <td
                  colSpan={11}
                  className="py-6 text-center text-sm"
                  style={{ color: "var(--text-muted)" }}
                >
                  {isVisitor ? "No tienes citas registradas." : "Sin resultados"}
                </td>
              </tr>
            ) : (
              filteredCitas.map((cita) => {
                const tipoLegible =
                  cita.tipoCita === "profesional"
                    ? "Profesional"
                    : cita.tipoCita === "personal"
                    ? "Personal"
                    : "—";

                const estadoNormalizado = normalizeCitaEstado(cita.estado);
                const qrValue = getRenderableQrValue(cita);
                const canShowQr = !!qrValue || !!cita.qrDataUrl;

                const canRegistrarIngreso =
                  !isVisitor &&
                  ["Autorizada", "En revisión", "Programada"].includes(
                    estadoNormalizado
                  );

                return (
                  <tr
                    key={cita._id}
                    className="text-sm [&>td]:py-3 [&>td]:pr-4"
                    style={{ borderBottom: "1px solid var(--border)" }}
                  >
                    <td className="font-medium" style={{ color: "var(--text)" }}>
                      {cita.nombre || cita.visitante}
                    </td>
                    <td style={{ color: "var(--text-muted)" }}>
                      {cita.documento || "-"}
                    </td>
                    <td>{cita.empresa || "—"}</td>
                    <td>{cita.empleado || "—"}</td>
                    <td style={{ color: "var(--text-muted)" }}>
                      {cita.motivo || "—"}
                    </td>
                    <td>{cita.telefono || "—"}</td>
                    <td>{tipoLegible}</td>
                    <td style={{ color: "var(--text-muted)" }}>
                      {cita.citaAt instanceof Date &&
                      !Number.isNaN(cita.citaAt.getTime())
                        ? cita.citaAt.toLocaleDateString("es-ES", {
                            day: "2-digit",
                            month: "2-digit",
                            year: "numeric",
                          })
                        : cita.fecha || "—"}
                    </td>
                    <td style={{ color: "var(--text-muted)" }}>
                      {cita.citaAt instanceof Date &&
                      !Number.isNaN(cita.citaAt.getTime())
                        ? cita.citaAt.toLocaleTimeString("es-ES", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : cita.hora || "—"}
                    </td>
                    <td>
                      <CitaEstadoPill estado={estadoNormalizado} />
                    </td>
                    <td className="text-right">
                      <div className="flex flex-wrap gap-2 justify-end">
                        {canShowQr && (
                          <button
                            type="button"
                            onClick={() => setQrCita(cita)}
                            className="px-2 py-1 rounded-md text-xs font-semibold transition"
                            style={sxGhostBtn()}
                          >
                            Ver QR
                          </button>
                        )}

                        {!isVisitor && (
                          <>
                            <button
                              type="button"
                              disabled={
                                savingCitaAction === `${cita._id}:En revisión` ||
                                estadoNormalizado === "Dentro" ||
                                estadoNormalizado === "Finalizada"
                              }
                              onClick={() =>
                                updateCitaStatus(cita._id, "En revisión")
                              }
                              className="px-2 py-1 rounded-md text-xs font-semibold transition disabled:opacity-50"
                              style={sxGhostBtn()}
                            >
                              En revisión
                            </button>

                            <button
                              type="button"
                              disabled={
                                savingCitaAction === `${cita._id}:Autorizada` ||
                                estadoNormalizado === "Dentro" ||
                                estadoNormalizado === "Finalizada"
                              }
                              onClick={() =>
                                updateCitaStatus(cita._id, "Autorizada")
                              }
                              className="px-2 py-1 rounded-md text-xs font-semibold transition disabled:opacity-50"
                              style={sxSuccessBtn()}
                            >
                              Autorizar
                            </button>

                            {canRegistrarIngreso && (
                              <button
                                type="button"
                                disabled={
                                  savingCitaAction === `${cita._id}:checkin`
                                }
                                onClick={() => handleRegistrarIngreso(cita)}
                                className="px-2 py-1 rounded-md text-xs font-semibold transition disabled:opacity-50"
                                style={sxPrimaryBtn()}
                              >
                                Registrar ingreso
                              </button>
                            )}

                            <button
                              type="button"
                              disabled={
                                savingCitaAction === `${cita._id}:Denegada` ||
                                estadoNormalizado === "Dentro" ||
                                estadoNormalizado === "Finalizada"
                              }
                              onClick={() =>
                                updateCitaStatus(cita._id, "Denegada")
                              }
                              className="px-2 py-1 rounded-md text-xs font-semibold transition disabled:opacity-50"
                              style={sxDangerBtn()}
                            >
                              Denegar
                            </button>

                            <button
                              type="button"
                              disabled={
                                savingCitaAction === `${cita._id}:Cancelada` ||
                                estadoNormalizado === "Dentro" ||
                                estadoNormalizado === "Finalizada"
                              }
                              onClick={() =>
                                updateCitaStatus(cita._id, "Cancelada")
                              }
                              className="px-2 py-1 rounded-md text-xs font-semibold transition disabled:opacity-50"
                              style={sxGhostBtn()}
                            >
                              Cancelar
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {!isVisitor && (
        <div className="mt-4 flex flex-col sm:flex-row justify-end gap-3">
          <button
            type="button"
            onClick={() => exportCitasExcel(filteredCitas)}
            className="px-3 py-2 text-sm rounded-lg transition"
            style={sxGhostBtn()}
            title="Exportar citas (xlsx)"
          >
            Exportar Excel
          </button>

          <button
            type="button"
            onClick={() => exportCitasPDF(filteredCitas)}
            className="px-3 py-2 text-sm rounded-lg transition"
            style={sxGhostBtn()}
            title="Exportar citas (PDF)"
          >
            Exportar PDF
          </button>
        </div>
      )}
    </section>
  );
}