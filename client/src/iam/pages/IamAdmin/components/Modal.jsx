import React from "react";

function sxCard(extra = {}) {
  return {
    background: "color-mix(in srgb, var(--card) 94%, transparent)",
    border: "1px solid var(--border)",
    boxShadow: "var(--shadow-md)",
    backdropFilter: "blur(12px) saturate(130%)",
    WebkitBackdropFilter: "blur(12px) saturate(130%)",
    ...extra,
  };
}

function sxGhostBtn(extra = {}) {
  return {
    background: "color-mix(in srgb, var(--card-solid) 88%, transparent)",
    color: "var(--text)",
    border: "1px solid var(--border)",
    boxShadow: "var(--shadow-sm)",
    ...extra,
  };
}

export default function Modal({ open, title, onClose, children, footer }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80]">
      <div
        className="absolute inset-0"
        style={{
          background: "rgba(2, 6, 23, 0.50)",
          backdropFilter: "blur(4px)",
          WebkitBackdropFilter: "blur(4px)",
        }}
        onClick={onClose}
      />

      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div
          className="w-full max-w-xl rounded-[24px] overflow-hidden"
          style={sxCard()}
        >
          <div
            className="px-4 pt-4 pb-2 flex items-center justify-between"
            style={{ borderBottom: "1px solid var(--border)" }}
          >
            <h3
              className="text-lg font-semibold"
              style={{ color: "var(--text)" }}
            >
              {title}
            </h3>

            <button
              onClick={onClose}
              className="p-2 rounded-md"
              style={sxGhostBtn()}
              aria-label="Cerrar"
              type="button"
            >
              ✕
            </button>
          </div>

          <div className="px-4 pb-4 pt-4" style={{ color: "var(--text)" }}>
            {children}
          </div>

          {footer && (
            <div
              className="px-4 pb-4"
              style={{ borderTop: "1px solid var(--border)" }}
            >
              {footer}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}