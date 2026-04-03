import React from "react";
import { useTranslation } from "react-i18next";
import PermissionRow from "./PermissionRow";

function roleIdOf(r) {
  return r?._id || r?.id || null;
}

export default function GroupSection({
  group,
  roles = [],
  gridCols,
  roleMatrix,
  origMatrix,
  onToggle,
  onDelete,
}) {
  const { t } = useTranslation();

  return (
    <div>
      {/* Cabecera del grupo: nombre del módulo fijo a la izquierda */}
      <div
        className="grid items-center text-sm font-semibold uppercase tracking-wide backdrop-blur-sm"
        style={{
          gridTemplateColumns: gridCols,
          background:
            "linear-gradient(90deg, color-mix(in srgb, var(--card-solid) 92%, transparent), color-mix(in srgb, #2563eb 5%, var(--card-solid)))",
          borderTop: "1px solid var(--border)",
          borderBottom: "1px solid var(--border)",
          color: "var(--text)",
        }}
      >
        <div
          className="sticky left-0 z-40 px-4 py-2 flex items-center gap-2"
          style={{
            background:
              "linear-gradient(90deg, color-mix(in srgb, var(--card-solid) 94%, transparent), color-mix(in srgb, #2563eb 6%, var(--card-solid)))",
            boxShadow:
              "2px 0 0 0 color-mix(in srgb, var(--border) 90%, transparent)",
          }}
        >
          <span className="text-base font-bold capitalize">
            {group?.group
              ? t(`iam.permissions.groups.${String(group.group).trim().toLowerCase()}`, {
                  defaultValue: group.group,
                })
              : ""}
          </span>

          <span
            className="text-xs font-bold rounded-md px-2 py-0.5"
            style={{
              background: "color-mix(in srgb, #2563eb 14%, transparent)",
              color: "#bfdbfe",
            }}
            title={t("iam.permissions.groupSection.permissionCount", {
              count: group?.items?.length || 0,
              defaultValue_one: "{{count}} permiso",
              defaultValue_other: "{{count}} permisos",
            })}
          >
            {group?.items?.length || 0}
          </span>
        </div>

        <div className="col-span-full h-full" />
      </div>

      {/* Filas de permisos */}
      {(group?.items || []).map((item) => {
        const permKey = String(item?.key || "").trim().toLowerCase();

        const flags = {};
        const origFlags = {};

        for (const role of roles || []) {
          const rid = String(roleIdOf(role) || "");
          if (!rid) continue;

          flags[rid] = !!roleMatrix?.[rid]?.[permKey];
          origFlags[rid] = !!origMatrix?.[rid]?.[permKey];
        }

        const dirty = JSON.stringify(flags) !== JSON.stringify(origFlags);

        return (
          <PermissionRow
            key={item?._id || item?.key}
            item={item}
            roles={roles}
            gridCols={gridCols}
            flags={flags}
            dirty={dirty}
            onToggle={onToggle}
            onDelete={onDelete}
          />
        );
      })}
    </div>
  );
}