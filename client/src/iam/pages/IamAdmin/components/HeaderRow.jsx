import React from "react";
import { useTranslation } from "react-i18next";

/** Encabezado sticky en Y; primera celda sticky en X+Y */
export default function HeaderRow({ roles = [], gridCols }) {
  const { t } = useTranslation();

  return (
    <div
      className="sticky top-0 z-40 grid items-center px-4 py-3 text-xs font-semibold uppercase tracking-wide backdrop-blur-sm"
      style={{
        gridTemplateColumns: gridCols,
        background: "color-mix(in srgb, var(--card-solid) 94%, transparent)",
        borderBottom: "1px solid var(--border)",
        color: "var(--text-muted)",
      }}
    >
      {/* Celda Permisos fija a la izquierda y arriba */}
      <div
        className="sticky left-0 top-0 z-50 pr-4"
        style={{
          background: "color-mix(in srgb, var(--card-solid) 94%, transparent)",
          boxShadow: "2px 0 0 0 color-mix(in srgb, var(--border) 90%, transparent)",
        }}
      >
        <span style={{ color: "var(--text)" }}>
          {t("iam.permissionCatalog.header.permissions", {
            defaultValue: "Permisos",
          })}
        </span>
      </div>

      {roles.map((r) => (
        <div key={r._id || r.id || r.code || r.name} className="text-center">
          {r.name || r.code}
        </div>
      ))}

      <div className="text-center">
        {t("actions.title", {
          defaultValue: "Acciones",
        })}
      </div>
    </div>
  );
}