import React from "react";

function formatBytes(bytes = 0) {
  if (!bytes) return "0 B";

  const units = ["B", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"];
  let value = Number(bytes);
  let unit = 0;

  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }

  return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[unit]}`;
}

function isValidDateValue(value) {
  if (!value) return false;
  const d = new Date(value);
  return !Number.isNaN(d.getTime()) && d.getTime() > 0;
}

function formatDate(value) {
  if (!isValidDateValue(value)) return "Sin registros";
  return new Date(value).toLocaleString();
}

export default function BackupStatsCards({ backups = [] }) {
  const safeBackups = Array.isArray(backups) ? backups : [];

  const total = safeBackups.length;
  const totalSize = safeBackups.reduce(
    (acc, item) => acc + Number(item?.size || 0),
    0
  );

  const latestBackup = safeBackups.find((item) => isValidDateValue(item?.createdAt));

  const cards = [
    { label: "Respaldos", value: total },
    { label: "Tamaño total", value: formatBytes(totalSize) },
    {
      label: "Último respaldo",
      value: latestBackup
        ? formatDate(latestBackup.createdAt)
        : "Sin registros",
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