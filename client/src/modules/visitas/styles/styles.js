export function sxCard(extra = {}) {
  return {
    background: "color-mix(in srgb, var(--card) 90%, transparent)",
    border: "1px solid var(--border)",
    boxShadow: "var(--shadow-md)",
    backdropFilter: "blur(12px) saturate(130%)",
    WebkitBackdropFilter: "blur(12px) saturate(130%)",
    ...extra,
  };
}

export function sxCardSoft(extra = {}) {
  return {
    background: "color-mix(in srgb, var(--card-solid) 88%, transparent)",
    border: "1px solid var(--border)",
    boxShadow: "var(--shadow-sm)",
    ...extra,
  };
}

export function sxInput(extra = {}) {
  return {
    background: "var(--input-bg)",
    color: "var(--text)",
    border: "1px solid var(--input-border)",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,.04)",
    ...extra,
  };
}

export function sxGhostBtn(extra = {}) {
  return {
    background: "color-mix(in srgb, var(--card-solid) 88%, transparent)",
    color: "var(--text)",
    border: "1px solid var(--border)",
    boxShadow: "var(--shadow-sm)",
    ...extra,
  };
}

export function sxPrimaryBtn(extra = {}) {
  return {
    background: "linear-gradient(135deg, #2563eb, #06b6d4)",
    color: "#fff",
    border: "1px solid transparent",
    boxShadow: "0 10px 20px color-mix(in srgb, #2563eb 22%, transparent)",
    ...extra,
  };
}

export function sxSuccessBtn(extra = {}) {
  return {
    background: "linear-gradient(135deg, #16a34a, #22c55e)",
    color: "#fff",
    border: "1px solid transparent",
    boxShadow: "0 10px 20px color-mix(in srgb, #16a34a 22%, transparent)",
    ...extra,
  };
}

export function sxDangerBtn(extra = {}) {
  return {
    background: "linear-gradient(135deg, #dc2626, #ef4444)",
    color: "#fff",
    border: "1px solid transparent",
    boxShadow: "0 10px 20px color-mix(in srgb, #dc2626 22%, transparent)",
    ...extra,
  };
}

export function sxKpi(tone = "default") {
  const tones = {
    success: {
      border: "color-mix(in srgb, #22c55e 40%, transparent)",
      dot: "#22c55e",
      label: "#86efac",
      value: "#4ade80",
      glow: "color-mix(in srgb, #22c55e 10%, transparent)",
    },
    info: {
      border: "color-mix(in srgb, #3b82f6 40%, transparent)",
      dot: "#3b82f6",
      label: "#93c5fd",
      value: "#60a5fa",
      glow: "color-mix(in srgb, #3b82f6 10%, transparent)",
    },
    purple: {
      border: "color-mix(in srgb, #a855f7 40%, transparent)",
      dot: "#a855f7",
      label: "#d8b4fe",
      value: "#c084fc",
      glow: "color-mix(in srgb, #a855f7 10%, transparent)",
    },
  };

  const t = tones[tone] || tones.info;

  return {
    background: `linear-gradient(
      to bottom right,
      color-mix(in srgb, var(--card) 88%, transparent),
      color-mix(in srgb, ${t.glow} 50%, var(--card))
    )`,
    border: `1px solid ${t.border}`,
    boxShadow: "var(--shadow-md)",
    backdropFilter: "blur(12px) saturate(130%)",
    WebkitBackdropFilter: "blur(12px) saturate(130%)",
    "--kpi-dot": t.dot,
    "--kpi-label": t.label,
    "--kpi-value": t.value,
  };
}