import React from "react";

export default function Pill({ children, tone = "muted" }) {
  const tones = {
    muted:
      "bg-black/5 text-neutral-800 dark:bg-white/10 dark:text-neutral-100 border border-black/5 dark:border-white/10",
    alta:
      "bg-rose-100 text-rose-700 border border-rose-200 dark:bg-rose-500/20 dark:text-rose-200 dark:border-rose-400/30",
    media:
      "bg-amber-100 text-amber-700 border border-amber-200 dark:bg-amber-500/20 dark:text-amber-100 dark:border-amber-400/30",
    baja:
      "bg-emerald-100 text-emerald-700 border border-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-100 dark:border-emerald-400/30",
    abierto:
      "bg-sky-100 text-sky-700 border border-sky-200 dark:bg-sky-500/20 dark:text-sky-100 dark:border-sky-400/30",
    proceso:
      "bg-indigo-100 text-indigo-700 border border-indigo-200 dark:bg-indigo-500/20 dark:text-indigo-100 dark:border-indigo-400/30",
    resuelto:
      "bg-emerald-100 text-emerald-700 border border-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-100 dark:border-emerald-400/30",
    firmado:
      "bg-neutral-100 text-neutral-700 border border-neutral-200 dark:bg-white/10 dark:text-neutral-200 dark:border-white/15",
    activo:
      "bg-emerald-100 text-emerald-700 border border-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-100 dark:border-emerald-400/30",
    completado:
      "bg-blue-100 text-blue-700 border border-blue-200 dark:bg-blue-500/20 dark:text-blue-100 dark:border-blue-400/30",
  };

  return (
    <span
      className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
        tones[tone] || tones.muted
      }`}
    >
      {children}
    </span>
  );
}