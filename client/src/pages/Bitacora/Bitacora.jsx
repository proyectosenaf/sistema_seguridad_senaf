import React, { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { MODULES } from "./constants";
import { useBitacoraData } from "./hooks/useBitacoraData";
import { downloadExcel, printPDF } from "./utils/bitacora.exports";
import BitacoraFilters from "./components/BitacoraFilters";
import BitacoraTable from "./components/BitacoraTable";
import BitacoraAnalytics from "./components/BitacoraAnalytics";
import EventDetailModal from "./components/EventDetailModal";
import DeleteConfirmModal from "./components/DeleteConfirmModal";

const DEFAULT_VISIBLE_ROWS = 5;

export default function Bitacora() {
  const { t } = useTranslation();
  const [tab, setTab] = useState("bitacora");
  const {
    rows,
    loading,
    loadError,
    removeRow,
    deletingId,
    fetchDetail,
    detailLoading,
  } = useBitacoraData();

  const [view, setView] = useState(null);
  const [confirmRow, setConfirmRow] = useState(null);
  const [showAllRows, setShowAllRows] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [detailError, setDetailError] = useState("");

  const [filters, setFilters] = useState({
    desde: "",
    hasta: "",
    agente: "",
    turno: "Todos",
    tipo: "Todos",
    modulo: "Todos",
  });

  const [temp, setTemp] = useState({
    desde: "",
    hasta: "",
    agente: "",
    turno: "Todos",
    tipo: "Todos",
    modulo: "Todos",
  });

  const hasActiveFilters = useMemo(() => {
    return (
      filters.desde !== "" ||
      filters.hasta !== "" ||
      filters.agente !== "" ||
      filters.turno !== "Todos" ||
      filters.tipo !== "Todos" ||
      filters.modulo !== "Todos"
    );
  }, [filters]);

  const applyFilters = () => {
    setFilters({ ...temp });
    setShowAllRows(false);
  };

  const clearFilters = () => {
    const reset = {
      desde: "",
      hasta: "",
      agente: "",
      turno: "Todos",
      tipo: "Todos",
      modulo: "Todos",
    };

    setFilters(reset);
    setTemp(reset);
    setShowAllRows(false);
  };

  const turnos = useMemo(() => {
    return [
      "Todos",
      ...Array.from(new Set(rows.map((r) => r.turno).filter(Boolean))).sort(),
    ];
  }, [rows]);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (!r) return false;

      if (!MODULES.includes(r.modulo)) return false;

      if (
        filters.desde &&
        new Date(r.fecha) < new Date(`${filters.desde}T00:00:00`)
      ) {
        return false;
      }

      if (
        filters.hasta &&
        new Date(r.fecha) > new Date(`${filters.hasta}T23:59:59`)
      ) {
        return false;
      }

      if (
        filters.agente &&
        !(
          `${r.agente || ""} ${r.nombre || ""} ${r.actorEmail || ""}`
            .toLowerCase()
            .includes(filters.agente.toLowerCase())
        )
      ) {
        return false;
      }

      if (filters.turno !== "Todos" && r.turno !== filters.turno) return false;
      if (filters.tipo !== "Todos" && r.tipo !== filters.tipo) return false;
      if (filters.modulo !== "Todos" && r.modulo !== filters.modulo) return false;

      return true;
    });
  }, [rows, filters]);

  const visibleRows = useMemo(() => {
    if (showAllRows || hasActiveFilters) return filtered;
    return filtered.slice(0, DEFAULT_VISIBLE_ROWS);
  }, [filtered, showAllRows, hasActiveFilters]);

  const visitas = filtered.filter((r) => r.tipo === "Visita");
  const visitasActivas = visitas.filter((v) =>
    /activo|activa|dentro/i.test(v.estado || "")
  ).length;

  const rondas = filtered.filter(
    (r) => r.tipo === "Ronda" || r.modulo === "Rondas de Vigilancia"
  );

  const accesosTotal = filtered.filter((r) => r.tipo === "Acceso").length;

  const stats = {
    registros: filtered.length,
    incidentes: filtered.filter((r) => r.tipo === "Incidente").length,
    rondas: filtered.filter((r) => r.tipo === "Ronda").length,
    visitas: filtered.filter((r) => r.tipo === "Visita").length,
    accesos: filtered.filter((r) => r.tipo === "Acceso").length,
  };

  useEffect(() => {
    if (!confirmRow) return;

    const stillExists = rows.some(
      (r) => String(r._id || r.id) === String(confirmRow._id || confirmRow.id)
    );

    if (!stillExists) {
      setConfirmRow(null);
    }
  }, [rows, confirmRow]);

  const handleView = async (row) => {
    if (!row) return;

    setDetailError("");
    setView(row);

    const rowId = String(row._id || row.id || "");
    if (!rowId) return;

    try {
      const detail = await fetchDetail(rowId);
      if (detail) {
        setView((prev) => {
          const prevId = String(prev?._id || prev?.id || "");
          if (prevId !== rowId) return prev;
          return {
            ...prev,
            ...detail,
            id: detail.id || detail._id || rowId,
            _id: detail._id || row._id,
          };
        });
      }
    } catch (err) {
      setDetailError(
        err?.response?.data?.message ||
          err?.message ||
          t("bitacora.detailLoadError")
      );
    }
  };

  const doDelete = async () => {
    if (!confirmRow) return;

    const rowId = String(confirmRow._id || confirmRow.id || "");
    if (!rowId) {
      setDeleteError(t("bitacora.invalidId"));
      return;
    }

    setDeleteError("");

    if (view && String(view._id || view.id) === rowId) {
      setView(null);
    }

    try {
      await removeRow(confirmRow);
      setConfirmRow(null);
      setDeleteError("");
    } catch (err) {
      setDeleteError(
        err?.response?.data?.message ||
          err?.message ||
          t("bitacora.archiveError")
      );
    }
  };

  return (
    <div className="layer-content bitacora-uniform" data-fx="neon">
      <div className="mb-2 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{t("bitacora.titleUpper")}</h1>
          <p className="text-sm opacity-75">{t("bitacora.subtitle")}</p>
        </div>
      </div>

      {loading && (
        <p className="mb-2 text-sm opacity-70">{t("bitacora.loading")}</p>
      )}

      {!!loadError && !loading && (
        <p className="mb-3 text-xs text-amber-500">{loadError}</p>
      )}

      <div className="bitacora-tabs mb-4 grid grid-cols-2 overflow-hidden rounded-xl">
        {[
          { id: "bitacora", label: t("bitacora.tabLog") },
          { id: "analitica", label: t("bitacora.tabAnalytics") },
        ].map((tabItem) => (
          <button
            key={tabItem.id}
            type="button"
            onClick={() => setTab(tabItem.id)}
            className={`bitacora-tab py-2 text-sm font-medium transition ${
              tab === tabItem.id ? "is-active" : ""
            }`}
          >
            {tabItem.label}
          </button>
        ))}
      </div>

      {tab === "bitacora" && (
        <>
          <section className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-4">
            <div className="fx-card fx-kpi">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold">{t("bitacora.kpiVisits")}</h4>
                <span>👥</span>
              </div>
              <div className="mt-1 text-3xl font-bold">{visitas.length}</div>
              <div className="text-sm opacity-75">
                {t("bitacora.kpiActiveVisits", { count: visitasActivas })}
              </div>
            </div>

            <div className="fx-card fx-kpi">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold">{t("bitacora.kpiRounds")}</h4>
                <span>⭕</span>
              </div>
              <div className="mt-1 text-3xl font-bold">{rondas.length}</div>
              <div className="text-sm opacity-75">
                {t("bitacora.kpiRegisteredInPeriod")}
              </div>
            </div>

            <div className="fx-card fx-kpi">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold">{t("bitacora.kpiAccesses")}</h4>
                <span>🛂</span>
              </div>
              <div className="mt-1 text-3xl font-bold">{accesosTotal}</div>
              <div className="text-sm opacity-75">
                {t("bitacora.kpiAccessRecords")}
              </div>
            </div>

            <div className="fx-card fx-kpi">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold">{t("bitacora.kpiIncidents")}</h4>
                <span>🚨</span>
              </div>
              <div className="mt-1 text-3xl font-bold">{stats.incidentes}</div>
              <div className="text-sm opacity-75">
                {t("bitacora.kpiManagedInLog")}
              </div>
            </div>
          </section>

          <BitacoraFilters
            turnos={turnos}
            temp={temp}
            setTemp={setTemp}
            onApply={applyFilters}
            onClear={clearFilters}
            onExportExcel={() => downloadExcel(filtered, stats)}
            onExportPDF={() => printPDF(filtered, stats)}
          />

          <div className="fx-card mb-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="font-semibold">
                  {t("bitacora.showingRecords", {
                    visible: visibleRows.length,
                    total: filtered.length,
                  })}
                </h3>
                <p className="text-sm opacity-75">
                  {!hasActiveFilters
                    ? t("bitacora.defaultShowingLast", {
                        count: DEFAULT_VISIBLE_ROWS,
                      })
                    : t("bitacora.filteredShowing")}
                </p>
              </div>

              {!hasActiveFilters && filtered.length > DEFAULT_VISIBLE_ROWS && (
                <button
                  type="button"
                  onClick={() => setShowAllRows((prev) => !prev)}
                  className="bitacora-outline-btn rounded-xl px-3 py-2 transition"
                >
                  {showAllRows
                    ? t("bitacora.viewOnlyLast", {
                        count: DEFAULT_VISIBLE_ROWS,
                      })
                    : t("bitacora.viewAll")}
                </button>
              )}
            </div>
          </div>

          <BitacoraTable
            rows={visibleRows}
            onView={handleView}
            onDelete={setConfirmRow}
            deletingId={deletingId}
          />
        </>
      )}

      {tab === "analitica" && <BitacoraAnalytics rows={rows} />}

      <EventDetailModal
        view={view}
        loading={detailLoading}
        error={detailError}
        deleting={
          String(deletingId || "") === String(view?._id || view?.id || "")
        }
        onClose={() => {
          setView(null);
          setDetailError("");
        }}
        onDelete={(row) => setConfirmRow(row)}
      />

      <DeleteConfirmModal
        row={confirmRow}
        error={deleteError}
        deleting={
          String(deletingId || "") ===
          String(confirmRow?._id || confirmRow?.id || "")
        }
        onCancel={() => {
          if (
            String(deletingId || "") ===
            String(confirmRow?._id || confirmRow?.id || "")
          ) {
            return;
          }
          setDeleteError("");
          setConfirmRow(null);
        }}
        onConfirm={doDelete}
      />
    </div>
  );
}