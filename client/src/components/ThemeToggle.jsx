import React from "react";
import { motion } from "framer-motion";

const Sun = (props) => (
  <svg
    viewBox="0 0 24 24"
    width="18"
    height="18"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    {...props}
  >
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4 12H2M22 12h-2M5 5l-1.4-1.4M20.4 20.4 19 19M5 19l-1.4 1.4M20.4 3.6 19 5" />
  </svg>
);

const Moon = (props) => (
  <svg
    viewBox="0 0 24 24"
    width="18"
    height="18"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    {...props}
  >
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
  </svg>
);

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

export default function ThemeToggle() {
  const prefersDark = React.useMemo(() => {
    if (typeof window === "undefined") return false;
    return (
      window.matchMedia?.("(prefers-color-scheme: dark)")?.matches ?? false
    );
  }, []);

  const [theme, setTheme] = React.useState(() => {
    if (typeof localStorage === "undefined") {
      return prefersDark ? "dark" : "light";
    }
    return localStorage.getItem("theme") || (prefersDark ? "dark" : "light");
  });

  React.useEffect(() => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    const isDark = theme === "dark";
    root.classList.toggle("dark", isDark);

    try {
      localStorage.setItem("theme", theme);
    } catch {
      // ignore
    }
  }, [theme]);

  return (
    <motion.button
      type="button"
      onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
      aria-label="Cambiar tema"
      title={theme === "dark" ? "Cambiar a claro" : "Cambiar a oscuro"}
      className="inline-flex items-center gap-2 rounded-[16px] px-3 py-2 text-sm transition-all duration-150"
      style={buttonStyle()}
      whileTap={{ scale: 0.96 }}
      whileHover={{ scale: 1.02 }}
      transition={{ type: "spring", stiffness: 260, damping: 22 }}
      onMouseEnter={(e) => Object.assign(e.currentTarget.style, buttonHoverStyle())}
      onMouseLeave={(e) => Object.assign(e.currentTarget.style, buttonStyle())}
    >
      <motion.span
        key={theme}
        initial={{ rotate: -90, opacity: 0, y: -2 }}
        animate={{ rotate: 0, opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 18 }}
        style={{
          color: theme === "dark" ? "var(--accent)" : "var(--accent-2)",
        }}
      >
        {theme === "dark" ? <Moon /> : <Sun />}
      </motion.span>

      <span className="hidden sm:inline" style={{ color: "var(--text)" }}>
        {theme === "dark" ? "Oscuro" : "Claro"}
      </span>
    </motion.button>
  );
}