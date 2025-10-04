import React from "react";
export default function RondasPatrolHUD({ shift, checkpoints, onEnd }){
  return (
    <div className="p-4 rounded-2xl border border-neutral-800 bg-neutral-900/40">
      <div className="font-semibold">Turno #{String(shift?._id).slice(-6)}</div>
      <div className="text-sm text-neutral-400">Estado: {shift?.status}</div>
      <div className="mt-2 grid gap-1 text-sm">
        {checkpoints.map(cp=> <div key={cp._id}>• {cp.name}</div>)}
      </div>
      <button className="mt-3 px-3 py-2 rounded-xl border border-neutral-700 hover:border-neutral-500"
        onClick={onEnd}>
        Finalizar turno
      </button>
    </div>
  );
}
