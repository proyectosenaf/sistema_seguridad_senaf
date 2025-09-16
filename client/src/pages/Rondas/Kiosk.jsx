import React from "react";
import { RondasAPI } from "../../lib/rondasApi";

export default function Kiosk() {
  const [shiftId, setShiftId] = React.useState("");
  const [checkpointCode, setCheckpointCode] = React.useState("");
  const [nfcUid, setNfcUid] = React.useState("");
  const [deviceId, setDeviceId] = React.useState("PC-KIOSK-01");
  const [msg, setMsg] = React.useState("");

  const submit = async (method) => {
    try {
      await RondasAPI.check({ shiftId, checkpointCode, method, nfcUid, deviceId });
      setMsg("Marcaje registrado ✅");
      setCheckpointCode(""); setNfcUid("");
    } catch (e) {
      setMsg("Error: " + (e.response?.data?.error || e.message));
    }
  };

  return (
    <div className="p-6 max-w-xl mx-auto space-y-3">
      <h2 className="text-xl font-semibold">Kiosco de Marcaje</h2>
      <input value={shiftId} onChange={e=>setShiftId(e.target.value)} placeholder="Shift ID" className="w-full border rounded p-2"/>
      <input value={checkpointCode} onChange={e=>setCheckpointCode(e.target.value)} placeholder="Código de Checkpoint" className="w-full border rounded p-2"/>
      <input value={nfcUid} onChange={e=>setNfcUid(e.target.value)} placeholder="UID de tarjeta (NFC)" className="w-full border rounded p-2"/>
      <input value={deviceId} onChange={e=>setDeviceId(e.target.value)} placeholder="Device ID" className="w-full border rounded p-2"/>

      <div className="flex gap-2">
        <button onClick={()=>submit("card")} className="px-3 py-2 rounded bg-blue-600 text-white">Marcar con Tarjeta</button>
        <button onClick={()=>submit("fingerprint")} className="px-3 py-2 rounded bg-emerald-600 text-white">Marcar con Huella</button>
        <button onClick={()=>submit("manual")} className="px-3 py-2 rounded bg-neutral-600 text-white">Manual</button>
      </div>
      {msg && <div className="text-sm opacity-80">{msg}</div>}
    </div>
  );
}
