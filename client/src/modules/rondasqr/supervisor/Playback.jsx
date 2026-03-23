// src/modules/rondasqr/supervisor/Playback.jsx
import React from "react";
import MapView from "./MapView";

function numberOrNull(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function hasCoords(item) {
  if (Array.isArray(item?.loc?.coordinates) && item.loc.coordinates.length >= 2) {
    const lon = numberOrNull(item.loc.coordinates[0]);
    const lat = numberOrNull(item.loc.coordinates[1]);
    return lat != null && lon != null;
  }

  const lat = numberOrNull(
    item?.gps?.lat ??
      item?.location?.lat ??
      item?.lat ??
      item?.latitude
  );

  const lon = numberOrNull(
    item?.gps?.lon ??
      item?.gps?.lng ??
      item?.location?.lon ??
      item?.location?.lng ??
      item?.lon ??
      item?.lng ??
      item?.longitude
  );

  return lat != null && lon != null;
}

function getWhen(item) {
  const raw = item?.at || item?.date || item?.createdAt || item?.emittedAt || null;
  if (!raw) return 0;
  const t = new Date(raw).getTime();
  return Number.isFinite(t) ? t : 0;
}

function getLabel(item) {
  return (
    item?.title ||
    item?.text ||
    item?.message ||
    item?.pointName ||
    item?.point?.name ||
    item?.qr ||
    "Punto de ronda"
  );
}

export default function Playback({ items = [] }) {
  const [idx, setIdx] = React.useState(0);
  const [playing, setPlaying] = React.useState(true);
  const [speedMs, setSpeedMs] = React.useState(1500);

  const safe = React.useMemo(() => {
    return (Array.isArray(items) ? items : [])
      .filter((m) => hasCoords(m))
      .sort((a, b) => getWhen(a) - getWhen(b));
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
    if (!playing) return;
    if (safe.length <= 1) return;

    const t = setInterval(() => {
      setIdx((i) => (i + 1) % safe.length);
    }, speedMs);

    return () => clearInterval(t);
  }, [safe.length, playing, speedMs]);

  const current = safe[idx] ? [safe[idx]] : [];
  const total = safe.length;
  const currentPoint = total ? idx + 1 : 0;
  const currentItem = safe[idx] || null;

  return (
    <div className="mod-card p-4 md:p-5">
      <div className="mb-3 flex items-center justify-between gap-3 flex-wrap">
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

        <div className="flex items-center gap-2 flex-wrap">
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

          <button
            type="button"
            onClick={() => setPlaying((v) => !v)}
            className="rounded-xl px-3 py-2 text-sm font-semibold"
            style={{
              color: "var(--text)",
              background: "color-mix(in srgb, var(--panel) 70%, transparent)",
              border: "1px solid var(--border)",
            }}
          >
            {playing ? "Pausar" : "Reproducir"}
          </button>

          <select
            value={speedMs}
            onChange={(e) => setSpeedMs(Number(e.target.value))}
            className="rounded-xl px-3 py-2 text-sm"
            style={{
              color: "var(--text)",
              background: "color-mix(in srgb, var(--panel) 70%, transparent)",
              border: "1px solid var(--border)",
            }}
          >
            <option value={800}>Rápido</option>
            <option value={1500}>Normal</option>
            <option value={2500}>Lento</option>
          </select>
        </div>
      </div>

      {!!currentItem && (
        <div
          className="mb-3 rounded-xl px-3 py-2 text-sm"
          style={{
            color: "var(--text)",
            background: "color-mix(in srgb, var(--panel) 65%, transparent)",
            border: "1px solid var(--border)",
          }}
        >
          <div className="font-semibold">{getLabel(currentItem)}</div>
          <div style={{ color: "var(--text-muted)" }}>
            {currentItem?.at || currentItem?.date || currentItem?.createdAt || currentItem?.emittedAt
              ? new Date(
                  currentItem.at ||
                    currentItem.date ||
                    currentItem.createdAt ||
                    currentItem.emittedAt
                ).toLocaleString()
              : "Sin fecha"}
          </div>
        </div>
      )}

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
          disabled={!total}
        />
      </div>
    </div>
  );
}