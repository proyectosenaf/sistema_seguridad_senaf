import React from "react";
export default function RondasZoneCard({ zone, onStart }){
  return (
    <div className="p-4 rounded-2xl border border-neutral-800 bg-neutral-900/40">
      <div className="font-semibold">{zone.name}</div>
      <div className="text-sm text-neutral-400">{zone.code}</div>
      <button className="mt-3 px-3 py-2 rounded-xl border border-neutral-700 hover:border-neutral-500"
        onClick={()=>onStart(zone)}>
        Iniciar ronda
      </button>
    </div>
  );
}
