import React from "react";

export default function AuthBackground({ children }) {
  return (
    <div
      className="relative flex min-h-screen items-center justify-center overflow-hidden"
      style={{ background: "var(--bg)" }}
    >
      {/* Fondo mesh suave */}
      <div className="app-bg pointer-events-none" aria-hidden />

      {/* Logo centrado, visible y limpio */}
      <div
        className="absolute inset-0 bg-center bg-no-repeat"
        style={{
          backgroundImage: "url('/images/senaf-bg.png')",
          backgroundSize: "900px",
          opacity: 0.14,
          filter: "saturate(110%) contrast(102%)",
        }}
      />

      {/* Overlay suave para limpiar lectura */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(to bottom, color-mix(in srgb, var(--bg) 80%, transparent), color-mix(in srgb, var(--bg) 66%, transparent))",
        }}
      />

      {/* Capa central de enfoque */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at center, transparent 0%, color-mix(in srgb, var(--bg) 18%, transparent) 58%, color-mix(in srgb, var(--bg) 42%, transparent) 100%)",
        }}
      />

      {/* Contenido */}
      <div className="relative z-10 flex w-full justify-center px-4">
        {children}
      </div>
    </div>
  );
}