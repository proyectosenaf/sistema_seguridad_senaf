import React from "react";

export default function EmojiPickerLite({ emojis = [], onSelect }) {
  return (
    <div
      style={{
        position: "absolute",
        left: 12,
        bottom: 68,
        background: "var(--card, rgba(17,24,39,.96))",
        border: "1px solid var(--border, rgba(255,255,255,.08))",
        borderRadius: 14,
        padding: 10,
        display: "grid",
        gridTemplateColumns: "repeat(5, 1fr)",
        gap: 8,
        zIndex: 10000,
      }}
    >
      {emojis.map((emoji) => (
        <button
          key={emoji}
          type="button"
          onClick={() => onSelect?.(emoji)}
          style={{
            border: "none",
            background: "transparent",
            fontSize: 20,
            cursor: "pointer",
          }}
        >
          {emoji}
        </button>
      ))}
    </div>
  );
}
