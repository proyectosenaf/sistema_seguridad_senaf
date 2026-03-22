import React from "react";
import { sxGhostBtn, sxPrimaryBtn } from "../styles.js";

export default function AgendaTabs({ tab, onAgendar, onCitas }) {
  return (
    <div className="flex items-center gap-2">
      <button
        onClick={onAgendar}
        className="px-3 py-2 rounded-lg text-sm transition"
        style={tab === "agendar" ? sxPrimaryBtn() : sxGhostBtn()}
      >
        Agendar
      </button>
      <button
        onClick={onCitas}
        className="px-3 py-2 rounded-lg text-sm transition"
        style={tab === "citas" ? sxPrimaryBtn() : sxGhostBtn()}
      >
        Citas
      </button>
    </div>
  );
}
