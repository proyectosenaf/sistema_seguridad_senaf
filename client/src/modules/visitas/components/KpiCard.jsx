import React from "react";
import { sxKpi } from "../styles/styles.js";

export default function KpiCard({ title, value, icon, tone }) {
  return (
    <div className="rounded-[20px] p-4 flex flex-col gap-1" style={sxKpi(tone)}>
      <div
        className="text-sm flex items-center gap-2"
        style={{ color: "var(--kpi-label)" }}
      >
        <span>{icon}</span>
        {title}
      </div>
      <div
        className="text-2xl font-semibold"
        style={{ color: "var(--kpi-value)" }}
      >
        {value}
      </div>
    </div>
  );
}