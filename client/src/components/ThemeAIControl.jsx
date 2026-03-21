import React from "react";
import { useSmartTheme, MOODS } from "../lib/useSmartTheme";

const Brain = (props) => (
  <svg
    viewBox="0 0 24 24"
    width="16"
    height="16"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    {...props}
  >
    <path d="M8 8a3 3 0 1 1 0-6 3 3 0 0 1 0 6Zm8 0a3 3 0 1 1 0-6 3 3 0 0 1 0 6Z" />
    <path d="M3 13a5 5 0 0 0 5 5h8a5 5 0 0 0 5-5c0-2.5-2-5-5-5H8c-3 0-5 2.5-5 5Z" />
  </svg>
);

function controlStyle() {
  return {
    border: "1px solid var(--border)",
    background: "color-mix(in srgb, var(--accent) 92%, transparent)",
    color: "var(--accent-foreground)",
    boxShadow: "var(--shadow-sm)",
  };
}

function hoverStyle() {
  return {
    filter: "brightness(1.06)",
  };
}

export default function ThemeAIControl() {
  const { mood, setMood } = useSmartTheme("auto");

  const next = React.useCallback(() => {
    const i = MOODS.indexOf(mood);
    setMood(MOODS[(i + 1) % MOODS.length]);
  }, [mood, setMood]);

  return (
    <button
      type="button"
      onClick={next}
      title={`Paleta IA: ${mood}`}
      className="inline-flex items-center gap-2 rounded-[16px] px-3 py-2 text-xs font-medium transition-all duration-150"
      style={controlStyle()}
      onMouseEnter={(e) => Object.assign(e.currentTarget.style, hoverStyle())}
      onMouseLeave={(e) => {
        e.currentTarget.style.filter = "";
      }}
    >
      <Brain />
      <span>{mood}</span>
    </button>
  );
}