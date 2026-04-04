import React, { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { percent } from "../utils/bitacora.formatters";
import ProgressBar from "./ProgressBar";

const MODULE_GRADIENTS = {
  Todos: "linear-gradient(90deg, #94a3b8 0%, #cbd5e1 100%)",
  "Control de Acceso": "linear-gradient(90deg, #7cc7ff 0%, #8ee3d1 100%)",
  "Rondas de Vigilancia": "linear-gradient(90deg, #67e8f9 0%, #86efac 100%)",
  "Control de Visitas": "linear-gradient(90deg, #93c5fd 0%, #99f6e4 100%)",
  "Gestión de Incidentes": "linear-gradient(90deg, #60a5fa 0%, #7dd3fc 100%)",
  IAM: "linear-gradient(90deg, #c084fc 0%, #a78bfa 100%)",
  Bitácora: "linear-gradient(90deg, #f59e0b 0%, #fbbf24 100%)",
  Sistema: "linear-gradient(90deg, #34d399 0%, #10b981 100%)",
};

const TURNO_GRADIENT = "linear-gradient(90deg, #7cc7ff 0%, #8ee3d1 100%)";

function cardStyle() {
  return {
    background: "color-mix(in srgb, var(--panel) 88%, transparent)",
    border: "1px solid var(--border)",
    boxShadow: "var(--shadow-md)",
    backdropFilter: "blur(12px) saturate(130%)",
    WebkitBackdropFilter: "blur(12px) saturate(130%)",
  };
}

function normalizeModuloLabel(value) {
  const raw = String(value || "").trim();
  if (!raw) return "Sin módulo";

  const k = raw.toLowerCase();

  if (k === "control de acceso" || k === "accesos" || k === "acceso") {
    return "Control de Acceso";
  }

  if (
    k === "rondas de vigilancia" ||
    k === "rondas" ||
    k === "rondas qr" ||
    k === "rondasqr"
  ) {
    return "Rondas de Vigilancia";
  }

  if (k === "control de visitas" || k === "visitas" || k === "visitantes") {
    return "Control de Visitas";
  }

  if (
    k === "gestión de incidentes" ||
    k === "gestion de incidentes" ||
    k === "incidentes"
  ) {
    return "Gestión de Incidentes";
  }

  if (k === "iam" || k === "usuarios y permisos") {
    return "IAM";
  }

  if (k === "bitacora" || k === "bitácora") {
    return "Bitácora";
  }

  if (
    k === "sistema" ||
    k === "system" ||
    k === "auth" ||
    k === "autenticación" ||
    k === "autenticacion"
  ) {
    return "Sistema";
  }

  return raw;
}

function sortModuleEntries(entries) {
  const preferredOrder = [
    "Control de Acceso",
    "Rondas de Vigilancia",
    "Control de Visitas",
    "Gestión de Incidentes",
    "IAM",
    "Bitácora",
    "Sistema",
    "Sin módulo",
  ];

  return [...entries].sort((a, b) => {
    const aIndex = preferredOrder.indexOf(a[0]);
    const bIndex = preferredOrder.indexOf(b[0]);

    const aRank = aIndex === -1 ? Number.MAX_SAFE_INTEGER : aIndex;
    const bRank = bIndex === -1 ? Number.MAX_SAFE_INTEGER : bIndex;

    if (aRank !== bRank) return aRank - bRank;

    if (b[1] !== a[1]) return b[1] - a[1];

    return a[0].localeCompare(b[0], "es");
  });
}

export default function BitacoraAnalytics({ rows = [] }) {
  const { t } = useTranslation();
  const totalRows = rows.length;

  const shiftOptions = [
    {
      value: "Mañana",
      label: t("bitacora.analytics.shifts.morning", { defaultValue: "Mañana" }),
    },
    {
      value: "Tarde",
      label: t("bitacora.analytics.shifts.afternoon", { defaultValue: "Tarde" }),
    },
    {
      value: "Noche",
      label: t("bitacora.analytics.shifts.night", { defaultValue: "Noche" }),
    },
  ];

  const moduleEntries = useMemo(() => {
    const counts = rows.reduce((acc, row) => {
      const label = normalizeModuloLabel(row?.modulo);
      acc[label] = (acc[label] || 0) + 1;
      return acc;
    }, {});

    return sortModuleEntries(Object.entries(counts));
  }, [rows]);

  return (
    <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <div className="fx-card rounded-[24px] p-5" style={cardStyle()}>
        <h3 className="mb-4 flex items-center gap-2 text-base font-semibold">
          <span>📊</span>
          <span style={{ color: "var(--text)" }}>
            {t("bitacora.analytics.eventsByModule", {
              defaultValue: "Eventos por Módulo",
            })}
          </span>
        </h3>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-3 text-sm">
              <span style={{ color: "var(--text)" }}>
                {t("bitacora.analytics.modules.Todos", {
                  defaultValue: "Todos",
                })}
              </span>

              <span
                className="shrink-0"
                style={{ color: "var(--text-muted)" }}
              >
                {t("bitacora.analytics.eventsCount", {
                  defaultValue: "{{count}} eventos ({{pct}}%)",
                  count: totalRows,
                  pct: totalRows > 0 ? 100 : 0,
                })}
              </span>
            </div>

            <ProgressBar
              value={totalRows > 0 ? 100 : 0}
              gradient={MODULE_GRADIENTS.Todos}
              height={12}
            />
          </div>

          {moduleEntries.map(([moduleName, count]) => {
            const pctVal = percent(count, totalRows);

            return (
              <div key={moduleName} className="space-y-1.5">
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span style={{ color: "var(--text)" }}>
                    {t(`bitacora.analytics.modules.${moduleName}`, {
                      defaultValue: moduleName,
                    })}
                  </span>

                  <span
                    className="shrink-0"
                    style={{ color: "var(--text-muted)" }}
                  >
                    {t("bitacora.analytics.eventsCount", {
                      defaultValue: "{{count}} eventos ({{pct}}%)",
                      count,
                      pct: pctVal,
                    })}
                  </span>
                </div>

                <ProgressBar
                  value={pctVal}
                  gradient={
                    MODULE_GRADIENTS[moduleName] ||
                    "linear-gradient(90deg, #7cc7ff 0%, #8ee3d1 100%)"
                  }
                  height={12}
                />
              </div>
            );
          })}
        </div>
      </div>

      <div className="fx-card rounded-[24px] p-5" style={cardStyle()}>
        <h3 className="mb-4 flex items-center gap-2 text-base font-semibold">
          <span>🕒</span>
          <span style={{ color: "var(--text)" }}>
            {t("bitacora.analytics.byShift", {
              defaultValue: "Distribución por Turno",
            })}
          </span>
        </h3>

        <div className="space-y-4">
          {shiftOptions.map((turno) => {
            const count = rows.filter((r) => r?.turno === turno.value).length;
            const pctVal = percent(count, totalRows);

            return (
              <div key={turno.value} className="space-y-1.5">
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span style={{ color: "var(--text)" }}>
                    {t("bitacora.analytics.shiftLabel", {
                      defaultValue: "Turno {{shift}}",
                      shift: turno.label,
                    })}
                  </span>

                  <span
                    className="shrink-0"
                    style={{ color: "var(--text-muted)" }}
                  >
                    {t("bitacora.analytics.eventsCount", {
                      defaultValue: "{{count}} eventos ({{pct}}%)",
                      count,
                      pct: pctVal,
                    })}
                  </span>
                </div>

                <ProgressBar
                  value={pctVal}
                  gradient={TURNO_GRADIENT}
                  height={12}
                />
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}