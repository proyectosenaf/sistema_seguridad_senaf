import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import CitaEstadoPill from "../pages/agenda/components/CitaEstadoPill.jsx";
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

function toSafeArray(v) {
  return Array.isArray(v) ? v : [];
}

function normalizeRowCita(cita = {}) {
  const citaAt =
    cita.citaAt || cita.fechaHora || cita.fechaEntrada || cita.fecha || "";

  const fechaDate =
    citaAt && !Number.isNaN(new Date(citaAt).getTime())
      ? new Date(citaAt)
      : null;

  return {
    ...cita,
    _id:
      cita._id ||
      cita.id ||
      `${cita.documento || "sin-doc"}-${citaAt || "sin-fecha"}`,
    visitante:
      cita.nombre ||
      cita.visitante ||
      cita.nombreVisitante ||
      cita.fullName ||
      "—",
    documento:
      cita.documento ||
      cita.dni ||
      cita.identidad ||
      cita.identityNumber ||
      "—",
    empresa: cita.empresa || "—",
    empleado: cita.empleado || cita.empleadoNombre || cita.contacto || "—",
    motivo: cita.motivo || "—",
    telefono: cita.telefono || cita.phone || "—",
    tipoCita: cita.tipoCita || cita.tipo || "",
    citaAt,
    fechaDate,
    estado: normalizeCitaEstado(cita.estado),
    qrDataUrl: cita.qrDataUrl || "",
    qrPayload: cita.qrPayload || "",
    qrToken: cita.qrToken || "",
  };
}

export default function CitasSection({
  isVisitor,
  filteredCitas,
  savingCitaAction,
  setQrCita,
  updateCitaStatus,
  handleRegistrarIngreso,
  exportCitasExcel,
  exportCitasPDF,
  onEditCita,
}) {
  const navigate = useNavigate();

  const [openMenuId, setOpenMenuId] = useState(null);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });
  const menuRef = useRef(null);

  const renderCitas = useMemo(() => {
    return toSafeArray(filteredCitas)
      .map(normalizeRowCita)
      .sort((a, b) => {
        const da = a?.fechaDate ? a.fechaDate.getTime() : 0;
        const db = b?.fechaDate ? b.fechaDate.getTime() : 0;
        return da - db;
      });
  }, [filteredCitas]);

  function closeMenu() {
    setOpenMenuId(null);
  }

  function toggleMenu(event, citaId) {
    if (openMenuId === citaId) {
      closeMenu();
      return;
    }

    const rect = event.currentTarget.getBoundingClientRect();
    const menuWidth = 190;
    const estimatedHeight = 210;
    const gap = 8;

    let left = rect.right - menuWidth;
    let top = rect.bottom + gap;

    if (left < 12) left = 12;
    if (left + menuWidth > window.innerWidth - 12) {
      left = window.innerWidth - menuWidth - 12;
    }

    if (top + estimatedHeight > window.innerHeight - 12) {
      top = rect.top - estimatedHeight - gap;
    }

    if (top < 12) top = 12;

    setMenuPosition({ top, left });
    setOpenMenuId(citaId);
  }

  useEffect(() => {
    function handleClickOutside(e) {
      if (!menuRef.current) return;
      if (!menuRef.current.contains(e.target)) {
        setOpenMenuId(null);
      }
    }

    function handleEscape(e) {
      if (e.key === "Escape") setOpenMenuId(null);
    }

    function handleScrollOrResize() {
      setOpenMenuId(null);
    }

    document.addEventListener("mousedown", handleClickOutside);
    window.addEventListener("keydown", handleEscape);
    window.addEventListener("scroll", handleScrollOrResize, true);
    window.addEventListener("resize", handleScrollOrResize);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("keydown", handleEscape);
      window.removeEventListener("scroll", handleScrollOrResize, true);
      window.removeEventListener("resize", handleScrollOrResize);
    };
  }, []);

  const activeMenuCita = useMemo(() => {
    return renderCitas.find(
      (x) => String(x?._id || x?.id || "") === String(openMenuId || "")
    );
  }, [renderCitas, openMenuId]);

  const menuPortal =
    openMenuId && activeMenuCita
      ? createPortal(
          (() => {
            const cita = activeMenuCita;
            const estadoNormalizado = normalizeCitaEstado(cita.estado);
            const qrValue = getRenderableQrValue(cita);
            const canShowQr = !!qrValue || !!cita.qrDataUrl;

            const canEdit =
              !isVisitor &&
              typeof onEditCita === "function" &&
              !["Dentro", "Finalizada", "Cancelada"].includes(
                estadoNormalizado
              );

            const canMarkReview =
              !isVisitor &&
              !["Dentro", "Finalizada"].includes(estadoNormalizado);

            const canCancel =
              !isVisitor &&
              !["Dentro", "Finalizada"].includes(estadoNormalizado);

            return (
              <div
                ref={menuRef}
                className="fixed z-[999999] w-48 rounded-xl p-2 flex flex-col gap-1 shadow-2xl"
                style={{
                  top: `${menuPosition.top}px`,
                  left: `${menuPosition.left}px`,
                  background: "var(--card)",
                  border: "1px solid var(--border)",
                  backdropFilter: "blur(14px)",
                  WebkitBackdropFilter: "blur(14px)",
                  boxShadow:
                    "0 20px 50px rgba(2,6,23,0.34), 0 0 0 1px rgba(255,255,255,0.04) inset",
                }}
              >
                {canShowQr && (
                  <button
                    type="button"
                    onClick={() => {
                      setQrCita?.(cita);
                      closeMenu();
                    }}
                    className="text-left px-3 py-2 text-xs rounded-lg transition"
                    style={{ color: "var(--text)" }}
                  >
                    Ver QR
                  </button>
                )}

                {canEdit && (
                  <button
                    type="button"
                    onClick={() => {
                      onEditCita(cita);
                      closeMenu();
                    }}
                    className="text-left px-3 py-2 text-xs rounded-lg transition"
                    style={{ color: "var(--text)" }}
                  >
                    Editar
                  </button>
                )}

                {canMarkReview && (
                  <button
                    type="button"
                    disabled={savingCitaAction === `${cita._id}:En revisión`}
                    onClick={() => {
                      updateCitaStatus?.(cita._id, "En revisión");
                      closeMenu();
                    }}
                    className="text-left px-3 py-2 text-xs rounded-lg transition disabled:opacity-50"
                    style={{ color: "var(--text)" }}
                  >
                    En revisión
                  </button>
                )}

                {canCancel && (
                  <button
                    type="button"
                    disabled={savingCitaAction === `${cita._id}:Cancelada`}
                    onClick={() => {
                      updateCitaStatus?.(cita._id, "Cancelada");
                      closeMenu();
                    }}
                    className="text-left px-3 py-2 text-xs rounded-lg transition disabled:opacity-50"
                    style={{ color: "var(--text)" }}
                  >
                    Cancelar
                  </button>
                )}
              </div>
            );
          })(),
          document.body
        )
      : null;

  return (
    <section
      className="p-4 md:p-5 text-sm rounded-[24px] relative w-full min-w-0"
      style={sxCard()}
    >
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

      <div className="w-full">
        <div className="w-full overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[1380px] table-fixed">
            <thead
              className="text-xs uppercase"
              style={{ color: "var(--text-muted)" }}
            >
              <tr
                className="[&>th]:py-2 [&>th]:pr-4"
                style={{ borderBottom: "1px solid var(--border)" }}
              >
                <th className="w-[160px]">Visitante</th>
                <th className="w-[170px]">DNI</th>
                <th className="w-[120px]">Empresa</th>
                <th className="w-[150px]">Empleado</th>
                <th className="w-[110px]">Motivo</th>
                <th className="w-[150px]">Teléfono</th>
                <th className="w-[120px]">Tipo de cita</th>
                <th className="w-[120px]">Fecha</th>
                <th className="w-[90px]">Hora</th>
                <th className="w-[130px]">Estado</th>
                <th className="w-[320px] text-right">Acciones</th>
              </tr>
            </thead>

            <tbody style={{ color: "var(--text)" }}>
              {renderCitas.length === 0 ? (
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
                renderCitas.map((cita) => {
                  const tipoLegible =
                    cita.tipoCita === "profesional"
                      ? "Profesional"
                      : cita.tipoCita === "personal"
                        ? "Personal"
                        : cita.tipoCita
                          ? cita.tipoCita
                          : "—";

                  const estadoNormalizado = normalizeCitaEstado(cita.estado);

                  const canRegistrarIngreso =
                    !isVisitor &&
                    ["Autorizada", "En revisión", "Programada"].includes(
                      estadoNormalizado
                    );

                  const canAuthorize =
                    !isVisitor &&
                    !["Dentro", "Finalizada"].includes(estadoNormalizado);

                  const canDeny =
                    !isVisitor &&
                    !["Dentro", "Finalizada"].includes(estadoNormalizado);

                  return (
                    <tr
                      key={cita._id}
                      className="text-sm [&>td]:py-3 [&>td]:pr-4 align-middle"
                      style={{ borderBottom: "1px solid var(--border)" }}
                    >
                      <td
                        className="font-medium max-w-[160px] truncate"
                        style={{ color: "var(--text)" }}
                        title={cita.visitante}
                      >
                        {cita.visitante}
                      </td>

                      <td
                        className="max-w-[170px] truncate"
                        style={{ color: "var(--text-muted)" }}
                        title={cita.documento}
                      >
                        {cita.documento}
                      </td>

                      <td className="max-w-[120px] truncate" title={cita.empresa}>
                        {cita.empresa}
                      </td>

                      <td className="max-w-[150px] truncate" title={cita.empleado}>
                        {cita.empleado}
                      </td>

                      <td
                        className="max-w-[110px] truncate"
                        style={{ color: "var(--text-muted)" }}
                        title={cita.motivo}
                      >
                        {cita.motivo}
                      </td>

                      <td className="whitespace-nowrap" title={cita.telefono}>
                        {cita.telefono}
                      </td>

                      <td className="whitespace-nowrap" title={tipoLegible}>
                        {tipoLegible}
                      </td>

                      <td
                        className="whitespace-nowrap"
                        style={{ color: "var(--text-muted)" }}
                      >
                        {cita.fechaDate
                          ? cita.fechaDate.toLocaleDateString("es-ES", {
                              day: "2-digit",
                              month: "2-digit",
                              year: "numeric",
                            })
                          : "—"}
                      </td>

                      <td
                        className="whitespace-nowrap"
                        style={{ color: "var(--text-muted)" }}
                      >
                        {cita.fechaDate
                          ? cita.fechaDate.toLocaleTimeString("es-ES", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : "—"}
                      </td>

                      <td className="whitespace-nowrap">
                        <CitaEstadoPill estado={estadoNormalizado} />
                      </td>

                      <td className="text-right align-middle">
                        <div className="flex flex-wrap gap-2 justify-end items-center min-w-[290px]">
                          {canRegistrarIngreso && (
                            <button
                              type="button"
                              disabled={
                                savingCitaAction === `${cita._id}:checkin`
                              }
                              onClick={() => handleRegistrarIngreso?.(cita)}
                              className="px-3 py-1 rounded-md text-xs font-semibold transition disabled:opacity-50"
                              style={sxPrimaryBtn()}
                            >
                              Registrar ingreso
                            </button>
                          )}

                          {canAuthorize && (
                            <button
                              type="button"
                              disabled={
                                savingCitaAction === `${cita._id}:Autorizada`
                              }
                              onClick={() =>
                                updateCitaStatus?.(cita._id, "Autorizada")
                              }
                              className="px-3 py-1 rounded-md text-xs font-semibold transition disabled:opacity-50"
                              style={sxSuccessBtn()}
                            >
                              Autorizar
                            </button>
                          )}

                          {canDeny && (
                            <button
                              type="button"
                              disabled={
                                savingCitaAction === `${cita._id}:Denegada`
                              }
                              onClick={() =>
                                updateCitaStatus?.(cita._id, "Denegada")
                              }
                              className="px-3 py-1 rounded-md text-xs font-semibold transition disabled:opacity-50"
                              style={sxDangerBtn()}
                            >
                              Denegar
                            </button>
                          )}

                          {!isVisitor && (
                            <button
                              type="button"
                              onClick={(e) => toggleMenu(e, cita._id)}
                              className="px-3 py-1 rounded-md text-xs font-semibold transition"
                              style={sxGhostBtn()}
                            >
                              Más
                            </button>
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
      </div>

      {!isVisitor && (
        <div className="mt-4 flex flex-col sm:flex-row justify-end gap-3">
          <button
            type="button"
            onClick={() => exportCitasExcel?.(renderCitas)}
            className="px-3 py-2 text-sm rounded-lg transition"
            style={sxGhostBtn()}
            title="Exportar citas (xlsx)"
          >
            Exportar Excel
          </button>

          <button
            type="button"
            onClick={() => exportCitasPDF?.(renderCitas)}
            className="px-3 py-2 text-sm rounded-lg transition"
            style={sxGhostBtn()}
            title="Exportar citas (PDF)"
          >
            Exportar PDF
          </button>
        </div>
      )}

      {menuPortal}
    </section>
  );
}