import React from "react";
import PermissionRow from "./PermissionRow";

export default function GroupSection({
  group, roles, gridCols, roleMatrix, origMatrix, onToggle, onDelete
}) {
  return (
    <details open className="group">
      <summary
        className="
          list-none cursor-pointer select-none
          px-4 py-3
          bg-neutral-100 dark:bg-neutral-900
          text-neutral-900 dark:text-neutral-100
          border-b border-neutral-200 dark:border-neutral-800
          flex items-center gap-3
        "
      >
        <span className="inline-flex w-5 h-5 items-center justify-center rounded-md bg-neutral-200/70 dark:bg-neutral-800">
          <svg className="transition-transform duration-200 group-open:rotate-90" width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <path d="M9 6l6 6-6 6" />
          </svg>
        </span>
        <span className="font-semibold capitalize">{group.group}</span>
        <span className="text-xs font-bold rounded-md px-2 py-0.5 bg-blue-600/15 text-blue-500 dark:bg-blue-400/15 dark:text-blue-300">
          {group.items.length}
        </span>
      </summary>

      <div className="divide-y divide-neutral-200 dark:divide-neutral-800">
        {group.items.map((it) => {
          const flags = roleMatrix[it.key] || {};
          const prev  = origMatrix[it.key] || {};
          const dirty = roles.some(r => Boolean(flags[r._id]) !== Boolean(prev[r._id]));
          return (
            <PermissionRow
              key={it._id || it.key}
              item={it}
              roles={roles}
              gridCols={gridCols}
              flags={flags}
              dirty={dirty}
              onToggle={onToggle}
              onDelete={() => onDelete(it)}
            />
          );
        })}
      </div>
    </details>
  );
}
