// client/src/components/ThemeFxPicker.jsx
import React from "react";

/* =========================
   Paletas
========================= */
const PALETTES = [
  { key: "neon",    name: "Neón",     colors: ["#ff00e6", "#00e1ff", "#00ff87"] },
  { key: "candy",   name: "Candy",    colors: ["#ff3cac", "#784ba0", "#2b86c5"] },
  { key: "retro",   name: "Retro",    colors: ["#f72585", "#4361ee", "#4cc9f0"] },
  { key: "holo",    name: "Holo",     colors: ["#a1ffce", "#faffd1", "#fcb045"] },
  { key: "cyber",   name: "Cyber",    colors: ["#8a2be2", "#00ffff", "#39ff14"] },
  { key: "sunset",  name: "Sunset",   colors: ["#ff5f6d", "#ffc371", "#ffd166"] },
  { key: "ocean",   name: "Océano",   colors: ["#00c6ff", "#0072ff", "#00ffa3"] },
  { key: "aurora",  name: "Aurora",   colors: ["#00ffa3", "#00c2ff", "#7c4dff"] },
  { key: "nebula",  name: "Nébula",   colors: ["#ff6ec7", "#845ef7", "#57d8ff"] },
  { key: "galaxy",  name: "Galaxia",  colors: ["#06b6d4", "#3b82f6", "#a78bfa"] },
  { key: "inferno", name: "Ígneo",    colors: ["#ff4d00", "#f59e0b", "#fde047"] },
  { key: "ice",     name: "Hielo",    colors: ["#e0fbfc", "#90cdf4", "#a7f3d0"] },
  { key: "acid",    name: "Ácido",    colors: ["#d9f99d", "#22d3ee", "#a78bfa"] },
  { key: "prism",   name: "Prisma",   colors: ["#ff0080", "#ff8c00", "#40e0d0"] },
  { key: "quantum", name: "Quantum",  colors: ["#00ffd1", "#00a1ff", "#b300ff"] },
];

const PAL_MAP = Object.fromEntries(PALETTES.map((p) => [p.key, p.colors]));

/* =========================
   Util: luminancia para escoger texto claro/oscuro
========================= */
function hexToRgb(hex) {
  const h = String(hex || "").replace("#", "").trim();
  if (h.length === 3) {
    const r = parseInt(h[0] + h[0], 16);
    const g = parseInt(h[1] + h[1], 16);
    const b = parseInt(h[2] + h[2], 16);
    return { r, g, b };
  }
  if (h.length !== 6) return { r: 0, g: 0, b: 0 };
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}
function relLuminance({ r, g, b }) {
  const srgb = [r, g, b].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * srgb[0] + 0.7152 * srgb[1] + 0.0722 * srgb[2];
}
function bestForegroundFor(bgHex) {
  const lum = relLuminance(hexToRgb(bgHex));
  return lum > 0.56 ? "#0b1220" : "#ffffff";
}

/* =========================
   Icono
========================= */
function PaletteIcon(props) {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none"
      stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M12 22A10 10 0 1 1 22 12a3 3 0 0 1-3 3h-1a2 2 0 0 0 0 4h.5" />
      <circle cx="7.5" cy="10.5" r="1" />
      <circle cx="12" cy="7.2" r="1" />
      <circle cx="16.5" cy="10.5" r="1" />
    </svg>
  );
}

/* =========================
   CSS interno (tu mismo)
========================= */
const THEME_PICKER_CSS = `/* (igual al tuyo) */`;

/* =========================
   Util: asegurar capa de fondo
========================= */
function ensureAmbientLayer() {
  if (typeof document === "undefined") return;
  let el = document.getElementById("fx-ambient");
  if (!el) {
    el = document.createElement("div");
    el.id = "fx-ambient";
    document.body.prepend(el);
  }
}

/* =========================
   Componente
========================= */
export default function ThemeFxPicker({ palettes = PALETTES, onChange }) {
  const [open, setOpen] = React.useState(false);
  const [fx, setFx] = React.useState("neon");
  const ref = React.useRef(null);

  const applyFx = React.useCallback(
    (next) => {
      if (typeof document === "undefined") return;
      const root = document.documentElement;
      const [c1, c2, c3] = PAL_MAP[next] || PAL_MAP.neon;

      root.setAttribute("data-fx", next);
      root.style.setProperty("--fx1", c1);
      root.style.setProperty("--fx2", c2);
      root.style.setProperty("--fx3", c3);

      // ✅ tokens que usa tu app
      root.style.setProperty("--accent", c2);
      root.style.setProperty("--accent-foreground", bestForegroundFor(c2));

      try {
        localStorage.setItem("fx", next);
      } catch {}

      onChange?.(next, [c1, c2, c3]);
    },
    [onChange]
  );

  React.useEffect(() => {
    ensureAmbientLayer();
    const saved =
      (typeof localStorage !== "undefined" && localStorage.getItem("fx")) ||
      "neon";
    setFx(saved);
    applyFx(saved);
  }, [applyFx]);

  React.useEffect(() => {
    const click = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    const esc = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    if (open) {
      document.addEventListener("mousedown", click);
      document.addEventListener("keydown", esc);
    }
    return () => {
      document.removeEventListener("mousedown", click);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  function choose(key) {
    setFx(key);
    applyFx(key);
    setOpen(false);
  }

  return (
    <div ref={ref} className="relative">
      <style>{THEME_PICKER_CSS}</style>

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="btn-palette inline-flex items-center gap-2 px-4 py-2 rounded-2xl ring-1 ring-white/10"
        aria-haspopup="menu"
        aria-expanded={open}
        title="Cambiar paleta de colores"
      >
        <PaletteIcon />
        <span className="font-medium">Paleta</span>
        <span className="sheen" />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-2 w-72 rounded-xl dropdown-panel bg-white/90 dark:bg-neutral-950/85 shadow-2xl p-3 z-50"
        >
          <div className="grid grid-cols-8 gap-2">
            {palettes.map(({ key, colors }) => {
              const gradient = `linear-gradient(135deg, ${colors[0]}, ${colors[1]} 60%, ${colors[2]})`;
              const active = fx === key;
              return (
                <button
                  key={key}
                  className={`swatch-btn ${active ? "is-active" : ""}`}
                  style={{ background: gradient }}
                  aria-label={key}
                  aria-pressed={active}
                  onClick={() => choose(key)}
                />
              );
            })}
          </div>

          <div className="mt-3 grid grid-cols-2 gap-1">
            {palettes.map((p) => (
              <button
                key={`label-${p.key}`}
                className="w-full text-left px-2 py-1.5 rounded-md hover:bg-black/5 dark:hover:bg-white/10 flex items-center gap-2"
                onClick={() => choose(p.key)}
              >
                <span
                  className="inline-block w-3.5 h-3.5 rounded-full"
                  style={{
                    background: `linear-gradient(135deg, ${p.colors[0]}, ${p.colors[1]} 60%, ${p.colors[2]})`,
                  }}
                />
                <span className="text-sm">{p.name}</span>
                {fx === p.key && <span className="ml-auto text-xs opacity-70">Actual</span>}
              </button>
            ))}
          </div>

          <div className="flex items-center justify-between mt-3 pt-2 border-t border-neutral-200/60 dark:border-neutral-800/60">
            <button
              className="px-2 py-1 text-xs rounded-md border border-neutral-300/60 dark:border-neutral-700/60"
              onClick={() => choose("neon")}
            >
              Predeterminado
            </button>
            <button
              className="px-2 py-1 text-xs rounded-md border border-transparent hover:border-neutral-300/60 dark:hover:border-neutral-700/60"
              onClick={() => setOpen(false)}
            >
              Cerrar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
