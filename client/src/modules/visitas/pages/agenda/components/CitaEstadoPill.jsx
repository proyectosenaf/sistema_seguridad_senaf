import React from "react";
import {
  normalizeCitaEstado,
  prettyCitaEstado,
} from "../../../utils/helpers.js";

export default function CitaEstadoPill({ estado }) {
  const normalized = normalizeCitaEstado(estado);
  const val = prettyCitaEstado(normalized);

  let style = {
    background: "color-mix(in srgb, #f59e0b 12%, transparent)",
    color: "#fde68a",
    border: "1px solid color-mix(in srgb, #f59e0b 36%, transparent)",
  };

  switch (normalized) {
    case "Programada":
      style = {
        background: "color-mix(in srgb, #f59e0b 12%, transparent)",
        color: "#fde68a",
        border: "1px solid color-mix(in srgb, #f59e0b 36%, transparent)",
      };
      break;

    case "En revisión":
      style = {
        background: "color-mix(in srgb, #3b82f6 12%, transparent)",
        color: "#93c5fd",
        border: "1px solid color-mix(in srgb, #3b82f6 36%, transparent)",
      };
      break;

    case "Autorizada":
      style = {
        background: "color-mix(in srgb, #22c55e 12%, transparent)",
        color: "#86efac",
        border: "1px solid color-mix(in srgb, #22c55e 36%, transparent)",
      };
      break;

    case "Dentro":
      style = {
        background: "color-mix(in srgb, #16a34a 14%, transparent)",
        color: "#86efac",
        border: "1px solid color-mix(in srgb, #16a34a 36%, transparent)",
      };
      break;

    case "Denegada":
      style = {
        background: "color-mix(in srgb, #ef4444 12%, transparent)",
        color: "#fca5a5",
        border: "1px solid color-mix(in srgb, #ef4444 36%, transparent)",
      };
      break;

    case "Cancelada":
    case "Finalizada":
      style = {
        background: "color-mix(in srgb, #64748b 18%, transparent)",
        color: "#cbd5e1",
        border: "1px solid color-mix(in srgb, #64748b 36%, transparent)",
      };
      break;

    default:
      break;
  }

  return (
    <span
      className="px-2 py-1 rounded-full text-xs font-semibold inline-flex items-center justify-center"
      style={style}
    >
      {val}
    </span>
  );
}