import React from "react";
export default function RondasCheckpointCard({ cp, onOpenQR }){
  return (
    <div className="p-3 rounded-xl border border-neutral-800 bg-neutral-900/40 flex items-center justify-between">
      <div>
        <div className="font-medium">{cp.name} <span className="text-xs text-neutral-400">({cp.code})</span></div>
        <div className="text-xs text-neutral-500">Orden: {cp.order}</div>
      </div>
      <button className="px-3 py-1.5 text-sm rounded-lg border border-neutral-700 hover:border-neutral-500"
        onClick={()=>onOpenQR(cp)}>
        Ver QR
      </button>
    </div>
  );
}
