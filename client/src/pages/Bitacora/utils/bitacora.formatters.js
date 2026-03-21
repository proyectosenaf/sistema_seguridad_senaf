export const fmtDateTime = (iso) => {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("es-HN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export const fmtDate = (iso) => {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("es-HN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
};

export const clampTxt = (s, n = 80) =>
  s?.length > n ? `${s.slice(0, n - 1)}…` : s || "";

export const percent = (num, den) =>
  !den ? 0 : Math.round((num / den) * 100);

export const monthNameES = (iso) => {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("es-HN", {
    month: "long",
    year: "numeric",
  });
};

export function turnoFromDate(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime()))
    return "Mañana";
  const h = date.getHours();
  if (h < 12) return "Mañana";
  if (h < 19) return "Tarde";
  return "Noche";
}

/* =========================
   PRIORIDAD (mejorado)
========================= */
export const prioridadTone = (p) => {
  const k = String(p || "").toLowerCase();

  if (k.includes("crítica") || k.includes("critica") || k.includes("critical"))
    return "critica";
  if (k.includes("alta") || k.includes("high")) return "alta";
  if (k.includes("media") || k.includes("medium")) return "media";
  if (k.includes("baja") || k.includes("low")) return "baja";

  return "muted";
};

/* =========================
   ESTADO (más completo)
========================= */
export const estadoTone = (e) => {
  const k = String(e || "").toLowerCase();

  if (k.includes("abierto")) return "abierto";
  if (k.includes("proceso") || k.includes("progress")) return "proceso";
  if (k.includes("resuelto") || k.includes("closed")) return "resuelto";
  if (k.includes("registrado")) return "registrado";
  if (k.includes("activo") || k.includes("dentro")) return "activo";
  if (k.includes("completado") || k.includes("finalizado"))
    return "completado";
  if (k.includes("cancelado") || k.includes("denegado"))
    return "cancelado";
  if (k.includes("archivado")) return "archivado";

  return "muted";
};