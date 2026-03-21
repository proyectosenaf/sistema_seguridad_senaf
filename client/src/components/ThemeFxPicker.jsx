import React from "react";

/* =========================
   Paletas
   - Reordenadas para mostrar primero las más sobrias/corporativas
   - Se mantienen algunas creativas al final
========================= */
const PALETTES = [
  { key: "titan", name: "Titan", colors: ["#0f172a", "#1d4ed8", "#38bdf8"] },
  { key: "midnight", name: "Midnight", colors: ["#020617", "#1e3a8a", "#22d3ee"] },
  { key: "command", name: "Command", colors: ["#0b1220", "#1d4ed8", "#10b981"] },
  { key: "carbon", name: "Carbon", colors: ["#111827", "#374151", "#06b6d4"] },
  { key: "steel", name: "Steel", colors: ["#334155", "#475569", "#0ea5e9"] },
  { key: "iron", name: "Iron", colors: ["#1f2937", "#4b5563", "#93c5fd"] },
  { key: "tactical", name: "Táctico", colors: ["#1f2937", "#14532d", "#22c55e"] },
  { key: "ocean", name: "Océano", colors: ["#00c6ff", "#0072ff", "#00ffa3"] },
  { key: "galaxy", name: "Galaxia", colors: ["#06b6d4", "#3b82f6", "#a78bfa"] },
  { key: "ember", name: "Ember", colors: ["#3f3f46", "#b45309", "#f59e0b"] },
  { key: "inferno", name: "Ígneo", colors: ["#ff4d00", "#f59e0b", "#fde047"] },
  { key: "aurora", name: "Aurora", colors: ["#00ffa3", "#00c2ff", "#7c4dff"] },
  { key: "cyber", name: "Cyber", colors: ["#8a2be2", "#00ffff", "#39ff14"] },
  { key: "acid", name: "Ácido", colors: ["#d9f99d", "#22d3ee", "#a78bfa"] },
  { key: "ice", name: "Hielo", colors: ["#e0fbfc", "#90cdf4", "#a7f3d0"] },

  /* Más experimentales al final */
  { key: "neon", name: "Neón", colors: ["#ff00e6", "#00e1ff", "#00ff87"] },
  { key: "retro", name: "Retro", colors: ["#f72585", "#4361ee", "#4cc9f0"] },
  { key: "sunset", name: "Sunset", colors: ["#ff5f6d", "#ffc371", "#ffd166"] },
  { key: "candy", name: "Candy", colors: ["#ff3cac", "#784ba0", "#2b86c5"] },
  { key: "holo", name: "Holo", colors: ["#a1ffce", "#faffd1", "#fcb045"] },
  { key: "nebula", name: "Nébula", colors: ["#ff6ec7", "#845ef7", "#57d8ff"] },
  { key: "prism", name: "Prisma", colors: ["#ff0080", "#ff8c00", "#40e0d0"] },
  { key: "quantum", name: "Quantum", colors: ["#00ffd1", "#00a1ff", "#b300ff"] },
];

const PAL_MAP = Object.fromEntries(PALETTES.map((p) => [p.key, p.colors]));

/* =========================
   Utilidades color
========================= */
function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}

function hexToRgb(hex) {
  const h = String(hex || "").replace("#", "").trim();

  if (h.length === 3) {
    return {
      r: parseInt(h[0] + h[0], 16),
      g: parseInt(h[1] + h[1], 16),
      b: parseInt(h[2] + h[2], 16),
    };
  }

  if (h.length !== 6) return { r: 0, g: 0, b: 0 };

  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

function rgbToHex({ r, g, b }) {
  const toHex = (v) =>
    clamp(Math.round(v), 0, 255).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function hexToRgba(hex, alpha = 1) {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function mixHex(a, b, amount = 0.5) {
  const x = hexToRgb(a);
  const y = hexToRgb(b);
  const t = clamp(amount, 0, 1);

  return rgbToHex({
    r: x.r + (y.r - x.r) * t,
    g: x.g + (y.g - x.g) * t,
    b: x.b + (y.b - x.b) * t,
  });
}

function lighten(hex, amount = 0.15) {
  return mixHex(hex, "#ffffff", amount);
}

function darken(hex, amount = 0.15) {
  return mixHex(hex, "#000000", amount);
}

function relLuminance({ r, g, b }) {
  const srgb = [r, g, b].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });

  return 0.2126 * srgb[0] + 0.7152 * srgb[1] + 0.0722 * srgb[2];
}

function bestForegroundFor(bgHex) {
  return relLuminance(hexToRgb(bgHex)) > 0.56 ? "#0b1220" : "#ffffff";
}

/* =========================
   Generador de tema completo
========================= */
function buildSystemTheme(colors, mode = "light") {
  const [c1, c2, c3] = colors || PAL_MAP.titan;

  const accent = c2;
  const accent2 = c3;
  const accentFg = bestForegroundFor(accent);

  if (mode === "dark") {
    const bg = mixHex("#020617", c2, 0.08);
    const bgElevated = mixHex("#08101f", c1, 0.08);
    const panel = mixHex("#0b1220", c2, 0.1);
    const cardSolid = mixHex("#0f172a", c2, 0.08);
    const sidebarBase = mixHex("#0b1220", c1, 0.12);

    return {
      "--bg": bg,
      "--bg-elevated": bgElevated,
      "--panel": panel,
      "--card": hexToRgba(cardSolid, 0.78),
      "--card-solid": cardSolid,

      "--text": "#e8eef8",
      "--text-muted": lighten(mixHex("#64748b", c2, 0.28), 0.12),

      "--border": "rgba(255,255,255,0.10)",
      "--border-strong": "rgba(255,255,255,0.16)",

      "--input-bg": hexToRgba(mixHex("#0f172a", c2, 0.06), 0.82),
      "--input-border": "rgba(255,255,255,0.12)",

      "--shadow-sm": "0 2px 10px rgba(0,0,0,0.24)",
      "--shadow-md": "0 10px 30px rgba(0,0,0,0.30)",
      "--shadow-lg": "0 20px 55px rgba(0,0,0,0.38)",

      "--accent": accent,
      "--accent-2": accent2,
      "--accent-soft": hexToRgba(accent, 0.18),
      "--accent-foreground": accentFg,
      "--ring": hexToRgba(accent, 0.40),

      "--fx1": c1,
      "--fx2": c2,
      "--fx3": c3,

      "--sidebar-bg": `linear-gradient(
        180deg,
        ${hexToRgba(mixHex(sidebarBase, c1, 0.55), 0.32)} 0%,
        ${hexToRgba(mixHex(sidebarBase, c2, 0.28), 0.18)} 55%,
        ${hexToRgba(mixHex("#020617", c3, 0.18), 0.16)} 100%
      )`,
      "--sidebar-border": "rgba(255,255,255,0.08)",
      "--sidebar-logo": "#f8fafc",
      "--sidebar-logo-muted": "#a8b3c7",

      "--nav-item-hover": "rgba(255,255,255,0.05)",
      "--nav-item-active": hexToRgba(mixHex("#0f172a", c2, 0.08), 0.78),
      "--nav-item-active-border": hexToRgba(accent, 0.34),
      "--nav-item-active-glow": `0 0 0 1px ${hexToRgba(accent, 0.12)}, 0 12px 28px rgba(0,0,0,0.26)`,

      "--nav-text": "#d2def2",
      "--nav-text-hover": "#ffffff",
      "--nav-text-active": "#ffffff",

      "--nav-icon": "#95a7c0",
      "--nav-icon-hover": lighten(c3, 0.18),
      "--nav-icon-active": accent,
      "--nav-rail": `linear-gradient(180deg, ${accent}, ${accent2})`,

      "--chat-1": darken(c1, 0.55),
      "--chat-2": darken(c2, 0.18),
      "--chat-3": c3,
      "--chat-ink": bestForegroundFor(c2),
      "--chat-out-1": accent,
      "--chat-out-2": accent2,
      "--chat-out-fg": bestForegroundFor(accent),
      "--chat-in-bg": "rgba(255,255,255,0.10)",
      "--chat-in-fg": "#e5e7eb",
      "--chat-meta": "#9aa4b2",
    };
  }

  const bg = mixHex("#f8fafc", c2, 0.06);
  const panel = mixHex("#f8fafc", c1, 0.04);
  const cardSolid = mixHex("#ffffff", c2, 0.04);

  return {
    "--bg": bg,
    "--bg-elevated": "#ffffff",
    "--panel": panel,
    "--card": "rgba(255,255,255,0.84)",
    "--card-solid": cardSolid,

    "--text": "#0f172a",
    "--text-muted": mixHex("#64748b", c2, 0.14),

    "--border": "rgba(15,23,42,0.10)",
    "--border-strong": "rgba(15,23,42,0.16)",

    "--input-bg": "rgba(255,255,255,0.78)",
    "--input-border": "rgba(15,23,42,0.12)",

    "--shadow-sm": "0 2px 8px rgba(15,23,42,0.05)",
    "--shadow-md": "0 10px 30px rgba(15,23,42,0.08)",
    "--shadow-lg": "0 18px 50px rgba(15,23,42,0.12)",

    "--accent": accent,
    "--accent-2": accent2,
    "--accent-soft": hexToRgba(accent, 0.14),
    "--accent-foreground": accentFg,
    "--ring": hexToRgba(accent, 0.45),

    "--fx1": c1,
    "--fx2": c2,
    "--fx3": c3,

    "--sidebar-bg": `linear-gradient(
      180deg,
      ${hexToRgba(mixHex("#ffffff", c1, 0.24), 0.70)} 0%,
      ${hexToRgba(mixHex("#ffffff", c2, 0.14), 0.52)} 55%,
      ${hexToRgba(mixHex("#f8fafc", c3, 0.10), 0.56)} 100%
    )`,
    "--sidebar-border": "rgba(15,23,42,0.10)",
    "--sidebar-logo": "#0f172a",
    "--sidebar-logo-muted": "#64748b",

    "--nav-item-hover": "rgba(15,23,42,0.05)",
    "--nav-item-active": "rgba(255,255,255,0.76)",
    "--nav-item-active-border": hexToRgba(accent, 0.24),
    "--nav-item-active-glow": `0 10px 24px ${hexToRgba(accent, 0.10)}`,

    "--nav-text": "#334155",
    "--nav-text-hover": "#0f172a",
    "--nav-text-active": "#0f172a",

    "--nav-icon": "#94a3b8",
    "--nav-icon-hover": accent2,
    "--nav-icon-active": accent,
    "--nav-rail": `linear-gradient(180deg, ${accent}, ${accent2})`,

    "--chat-1": darken(c1, 0.32),
    "--chat-2": c2,
    "--chat-3": c3,
    "--chat-ink": bestForegroundFor(c2),
    "--chat-out-1": accent,
    "--chat-out-2": accent2,
    "--chat-out-fg": bestForegroundFor(accent),
    "--chat-in-bg": "rgba(15,23,42,0.06)",
    "--chat-in-fg": "#0f172a",
    "--chat-meta": "#64748b",
  };
}

function applyCompleteTheme(themeKey) {
  if (typeof document === "undefined") return;

  const root = document.documentElement;
  const isDark = root.classList.contains("dark");
  const colors = PAL_MAP[themeKey] || PAL_MAP.titan;
  const theme = buildSystemTheme(colors, isDark ? "dark" : "light");

  Object.entries(theme).forEach(([token, value]) => {
    root.style.setProperty(token, value);
  });

  root.setAttribute("data-fx", themeKey);
}

function ensureAmbientLayer() {
  if (typeof document === "undefined") return;
  let el = document.getElementById("fx-ambient");
  if (!el) {
    el = document.createElement("div");
    el.id = "fx-ambient";
    document.body.prepend(el);
  }
}

function triggerFxPulse() {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.classList.remove("fx-pulse");
  void root.offsetWidth;
  root.classList.add("fx-pulse");
  window.setTimeout(() => root.classList.remove("fx-pulse"), 420);
}

function buttonStyle() {
  return {
    border: "1px solid var(--border)",
    background: "color-mix(in srgb, var(--card-solid) 88%, transparent)",
    color: "var(--text)",
    boxShadow: "var(--shadow-sm)",
    backdropFilter: "blur(12px) saturate(130%)",
    WebkitBackdropFilter: "blur(12px) saturate(130%)",
  };
}

function buttonHoverStyle() {
  return {
    border: "1px solid var(--border-strong)",
    background: "color-mix(in srgb, var(--panel) 76%, transparent)",
    color: "var(--text)",
  };
}

function panelStyle() {
  return {
    border: "1px solid var(--border)",
    background: "color-mix(in srgb, var(--card) 96%, transparent)",
    color: "var(--text)",
    boxShadow: "var(--shadow-lg)",
    backdropFilter: "blur(18px) saturate(140%)",
    WebkitBackdropFilter: "blur(18px) saturate(140%)",
  };
}

function PaletteIcon(props) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M12 22A10 10 0 1 1 22 12a3 3 0 0 1-3 3h-1a2 2 0 0 0 0 4h.5" />
      <circle cx="7.5" cy="10.5" r="1" />
      <circle cx="12" cy="7.2" r="1" />
      <circle cx="16.5" cy="10.5" r="1" />
    </svg>
  );
}

export default function ThemeFxPicker({ palettes = PALETTES, onChange }) {
  const [open, setOpen] = React.useState(false);
  const [fx, setFx] = React.useState("titan");
  const ref = React.useRef(null);

  const applyTheme = React.useCallback(
    (next) => {
      applyCompleteTheme(next);

      try {
        localStorage.setItem("fx", next);
      } catch {
        // ignore
      }

      triggerFxPulse();

      const colors = PAL_MAP[next] || PAL_MAP.titan;
      onChange?.(next, colors);
    },
    [onChange]
  );

  React.useEffect(() => {
    ensureAmbientLayer();

    const saved =
      (typeof localStorage !== "undefined" && localStorage.getItem("fx")) ||
      "titan";

    setFx(saved);
    applyTheme(saved);
  }, [applyTheme]);

  React.useEffect(() => {
    if (typeof document === "undefined") return;

    const root = document.documentElement;
    const observer = new MutationObserver(() => {
      const saved =
        (typeof localStorage !== "undefined" && localStorage.getItem("fx")) ||
        fx ||
        "titan";
      applyCompleteTheme(saved);
    });

    observer.observe(root, {
      attributes: true,
      attributeFilter: ["class"],
    });

    return () => observer.disconnect();
  }, [fx]);

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
    applyTheme(key);
    setOpen(false);
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-2 rounded-[16px] px-3 py-2 text-sm transition-all duration-150"
        aria-haspopup="menu"
        aria-expanded={open}
        title="Cambiar paleta de colores"
        style={buttonStyle()}
        onMouseEnter={(e) =>
          Object.assign(e.currentTarget.style, buttonHoverStyle())
        }
        onMouseLeave={(e) =>
          Object.assign(e.currentTarget.style, buttonStyle())
        }
      >
        <PaletteIcon style={{ color: "var(--accent)" }} />
        <span className="hidden sm:inline font-medium">Paleta</span>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-[120] mt-2 w-[22rem] rounded-[22px] p-3"
          style={panelStyle()}
        >
          <div
            className="mb-3 text-xs font-semibold uppercase tracking-[0.08em]"
            style={{ color: "var(--text-muted)" }}
          >
            Paletas visuales
          </div>

          <div className="grid grid-cols-5 gap-2">
            {palettes.map(({ key, colors, name }) => {
              const gradient = `linear-gradient(135deg, ${colors[0]}, ${colors[1]} 60%, ${colors[2]})`;
              const active = fx === key;

              return (
                <button
                  key={key}
                  type="button"
                  className="relative h-12 rounded-[16px] transition-all duration-150"
                  style={{
                    background: gradient,
                    border: active
                      ? "2px solid color-mix(in srgb, var(--text) 88%, transparent)"
                      : "1px solid rgba(255,255,255,0.14)",
                    boxShadow: active
                      ? `0 0 0 2px ${hexToRgba(
                          (PAL_MAP[key] || PAL_MAP.titan)[1],
                          0.26
                        )}, var(--shadow-sm)`
                      : "var(--shadow-sm)",
                  }}
                  aria-label={name}
                  aria-pressed={active}
                  title={name}
                  onClick={() => choose(key)}
                />
              );
            })}
          </div>

          <div className="mt-3 max-h-56 overflow-y-auto pr-1 space-y-1">
            {palettes.map((p) => {
              const active = fx === p.key;
              return (
                <button
                  key={`label-${p.key}`}
                  type="button"
                  className="flex w-full items-center gap-2 rounded-[14px] px-2.5 py-2 text-left transition-all duration-150"
                  onClick={() => choose(p.key)}
                  style={{
                    background: active
                      ? "color-mix(in srgb, var(--panel) 72%, transparent)"
                      : "transparent",
                    border: active
                      ? "1px solid var(--border-strong)"
                      : "1px solid transparent",
                    color: "var(--text)",
                  }}
                >
                  <span
                    className="inline-block h-3.5 w-3.5 rounded-full"
                    style={{
                      background: `linear-gradient(135deg, ${p.colors[0]}, ${p.colors[1]} 60%, ${p.colors[2]})`,
                    }}
                  />
                  <span className="text-sm">{p.name}</span>
                  {active && (
                    <span
                      className="ml-auto text-[11px]"
                      style={{ color: "var(--text-muted)" }}
                    >
                      Actual
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <div
            className="mt-3 flex items-center justify-between border-t pt-3"
            style={{ borderColor: "var(--border)" }}
          >
            <button
              type="button"
              className="rounded-[12px] px-2.5 py-1.5 text-xs transition-all duration-150"
              style={buttonStyle()}
              onClick={() => choose("titan")}
            >
              Predeterminado
            </button>

            <button
              type="button"
              className="rounded-[12px] px-2.5 py-1.5 text-xs transition-all duration-150"
              style={{
                color: "var(--text-muted)",
                background: "transparent",
                border: "1px solid transparent",
              }}
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