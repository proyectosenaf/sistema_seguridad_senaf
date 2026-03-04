import React from "react";

export default function AuthBackground({ children }) {
  return (
    <div className="min-h-screen relative overflow-hidden flex items-center justify-center bg-white">

      {/* Logo centrado, visible y limpio */}
      <div
        className="absolute inset-0 bg-center bg-no-repeat"
        style={{
          backgroundImage: "url('/images/senaf-bg.png')",
          backgroundSize: "900px",
          opacity: 500.50,
        }}
      />

      {/* Overlay muy suave solo para suavizar */}
      <div className="absolute inset-0 bg-white/60" />

      {/* Contenido */}
      <div className="relative z-10">
        {children}
      </div>

    </div>
  );
}