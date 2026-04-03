import React from "react";

function formatBytes(bytes = 0) {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[unit]}`;
}

export default function BackupStatsCards({ backups = [] }) {
  const total = backups.length;
  const totalSize = backups.reduce((acc, item) => acc + (item.size || 0), 0);
  const last = backups[0];

  const cards = [
    { label: "Respaldos", value: total },
    { label: "Tamaño total", value: formatBytes(totalSize) },
    {
      label: "Último respaldo",
      value: last ? new Date(last.createdAt).toLocaleString() : "Sin registros",
    },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-3">
      {cards.map((card) => (
        <div
          key={card.label}
          className="rounded-2xl border p-4 shadow-sm backdrop-blur"
          style={{
            background: "color-mix(in srgb, var(--card) 88%, transparent)",
            borderColor: "var(--border)",
          }}
        >
          <div className="text-sm opacity-70">{card.label}</div>
          <div className="mt-2 text-xl font-semibold">{card.value}</div>
        </div>
      ))}
    </div>
  );
}