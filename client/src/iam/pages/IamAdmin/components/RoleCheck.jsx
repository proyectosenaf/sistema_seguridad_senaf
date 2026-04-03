import React from "react";

export default function RoleCheck({ checked, onChange, label }) {
  return (
    <label className="inline-flex cursor-pointer select-none items-center gap-2">
      <input
        type="checkbox"
        checked={Boolean(checked)}
        onChange={onChange}
        className="h-4 w-4 rounded border-neutral-400 text-blue-600 focus:ring-blue-500 dark:border-neutral-600"
        aria-label={label}
      />
    </label>
  );
}