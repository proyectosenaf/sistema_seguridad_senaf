import React from "react";

export default function ProgressBar({
  value = 0,
  label,
  gradient = "linear-gradient(90deg, #7cc7ff 0%, #8ee3d1 100%)",
  height = 12,
}) {
  const v = Math.max(0, Math.min(100, Math.round(Number(value) || 0)));

  return (
    <div className="w-full">
      {label ? (
        <div className="mb-1 text-xs" style={{ color: "var(--text-muted)" }}>
          {label}
        </div>
      ) : null}

      <div
        className="w-full overflow-hidden rounded-full"
        style={{
          height,
          background: "color-mix(in srgb, var(--text) 10%, transparent)",
          boxShadow: "inset 0 1px 2px rgba(0,0,0,0.10)",
        }}
      >
        <div
          className="rounded-full transition-all duration-500"
          style={{
            width: `${v}%`,
            height: "100%",
            background: gradient,
            boxShadow: "0 0 10px rgba(124, 199, 255, 0.14)",
          }}
        />
      </div>
    </div>
  );
}