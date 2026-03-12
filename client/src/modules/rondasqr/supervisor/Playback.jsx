// src/modules/rondasqr/supervisor/Playback.jsx
import React from "react";
import MapView from "./MapView";

export default function Playback({ items = [] }) {
  const [idx, setIdx] = React.useState(0);

  const safe = React.useMemo(() => {
    return items.filter((m) => {
      if (m?.loc?.coordinates?.length === 2) return true;
      if (typeof m?.lat === "number" && typeof m?.lon === "number") return true;
      return false;
    });
  }, [items]);

  React.useEffect(() => {
    if (!safe.length) {
      setIdx(0);
      return;
    }

    if (idx > safe.length - 1) {
      setIdx(0);
    }
  }, [safe.length, idx]);

  React.useEffect(() => {
    if (!safe.length) return;

    const t = setInterval(() => {
      setIdx((i) => (i + 1) % safe.length);
    }, 1500);

    return () => clearInterval(t);
  }, [safe.length]);

  const current = safe[idx] ? [safe[idx]] : [];
  const total = safe.length;
  const currentPoint = total ? idx + 1 : 0;

  return (
    <div className="mod-card p-4 md:p-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h3
            className="text-lg font-semibold tracking-tight"
            style={{ color: "var(--text)" }}
          >
            Reproducción de ronda
          </h3>
          <p
            className="mt-1 text-sm"
            style={{ color: "var(--text-muted)" }}
          >
            Seguimiento visual del recorrido punto por punto.
          </p>
        </div>

        <div
          className="inline-flex items-center rounded-full px-3 py-1 text-sm font-semibold"
          style={{
            color: "var(--text)",
            background: "color-mix(in srgb, var(--panel) 70%, transparent)",
            border: "1px solid var(--border)",
          }}
        >
          Punto {currentPoint}/{total}
        </div>
      </div>

      <div
        className="overflow-hidden rounded-[16px]"
        style={{
          border: "1px solid var(--border)",
          background: "color-mix(in srgb, var(--card) 88%, transparent)",
          boxShadow: "var(--shadow-sm)",
        }}
      >
        <MapView items={current.length ? current : safe} />
      </div>

      <div className="mt-4">
        <input
          type="range"
          min={0}
          max={Math.max(0, total - 1)}
          value={idx}
          onChange={(e) => setIdx(Number(e.target.value))}
          className="w-full cursor-pointer"
          style={{ accentColor: "var(--accent)" }}
          aria-label="Control de reproducción de ronda"
        />
      </div>
    </div>
  );
}