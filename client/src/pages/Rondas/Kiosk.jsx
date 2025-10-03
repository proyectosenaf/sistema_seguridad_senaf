import React from "react";
import { check as checkPoint, reportIncident, emergency, getMyAssignments } from "/src/lib/rondasApi.js";

export default function Kiosk() {
  const qs = new URLSearchParams(location.search);
  const [shiftId, setShiftId] = React.useState(qs.get("shift") || "");
  const [checkpointCode, setCheckpointCode] = React.useState("");
  const [method, setMethod] = React.useState("manual");
  const [deviceId, setDeviceId] = React.useState(localStorage.getItem("kiosk-device") || "WEB-KIOSK-01");
  const [msg, setMsg] = React.useState("");

  // Incidente
  const [incType, setIncType] = React.useState("anomalía");
  const [incDesc, setIncDesc] = React.useState("");

  // Mis asignaciones (info)
  const [myAssigns, setMyAssigns] = React.useState([]);

  React.useEffect(() => {
    localStorage.setItem("kiosk-device", deviceId);
  }, [deviceId]);

  React.useEffect(() => {
    (async () => {
      try {
        const data = await getMyAssignments();
        setMyAssigns(Array.isArray(data) ? data : []);
      } catch {}
    })();
  }, []);

  const submitCheck = async () => {
    const code = checkpointCode.trim();
    if (!shiftId || !code) {
      setMsg("Completa Shift ID y Código de checkpoint.");
      return;
    }
    try {
      await checkPoint({ shiftId, checkpointCode: code, method, methodMeta: { deviceId } });
      setMsg("✅ Marcaje registrado");
      setCheckpointCode("");
      setTimeout(() => setMsg(""), 1500);
    } catch (e) {
      setMsg("❌ " + (e?.response?.data?.error || e.message));
    }
  };

  const submitIncident = async () => {
    if (!shiftId) return setMsg("Asignar Shift ID primero");
    try {
      await reportIncident({ shiftId, type: incType, description: incDesc });
      setIncDesc("");
      setMsg("✅ Incidente enviado");
      setTimeout(() => setMsg(""), 1500);
    } catch (e) {
      setMsg("❌ " + (e?.response?.data?.error || e.message));
    }
  };

  const sendEmergency = async () => {
    if (!shiftId) return setMsg("Asignar Shift ID primero");
    try {
      await emergency({ shiftId, note: "Emergencia desde kiosco" });
      setMsg("🚨 Emergencia enviada");
      setTimeout(() => setMsg(""), 1500);
    } catch (e) {
      setMsg("❌ " + (e?.response?.data?.error || e.message));
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <h2 className="text-2xl font-semibold">Kiosco de Marcaje</h2>

      {/* Mis asignaciones (lectura) */}
      {myAssigns.length > 0 && (
        <div className="rounded-xl border dark:border-neutral-800 p-3">
          <div className="font-medium mb-2">Mis asignaciones de hoy</div>
          <ul className="text-sm space-y-1">
            {myAssigns.map(a => (
              <li key={a.id}>
                {a.route?.name || "Ruta"} · {a.window?.start}–{a.window?.end} ·{" "}
                {a.availableNow ? "Disponible ahora" : "Fuera de ventana"}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="rounded-xl border dark:border-neutral-800 p-4 space-y-3">
        <div className="font-medium">Marcaje</div>
        <input
          className="w-full border rounded p-3 bg-transparent"
          placeholder="Shift ID"
          value={shiftId}
          onChange={(e) => setShiftId(e.target.value)}
        />
        <div className="flex gap-2">
          <input
            className="flex-1 border rounded p-3 bg-transparent"
            placeholder="Código de Checkpoint"
            value={checkpointCode}
            onChange={(e) => setCheckpointCode(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submitCheck()}
            autoFocus
          />
          <select
            className="border rounded p-3 bg-transparent"
            value={method}
            onChange={(e) => setMethod(e.target.value)}
          >
            <option value="manual">Manual</option>
            <option value="card">Tarjeta</option>
            <option value="fingerprint">Huella</option>
          </select>
          <button onClick={submitCheck} className="px-4 py-3 rounded bg-emerald-600 text-white">Marcar</button>
        </div>
        <input
          className="w-full border rounded p-3 bg-transparent"
          placeholder="Device ID (opcional)"
          value={deviceId}
          onChange={(e) => setDeviceId(e.target.value)}
        />
      </div>

      <div className="rounded-xl border dark:border-neutral-800 p-4 space-y-3">
        <div className="font-medium">Incidente rápido</div>
        <div className="flex gap-2">
          <select className="border rounded p-3 bg-transparent" value={incType} onChange={(e)=>setIncType(e.target.value)}>
            <option value="anomalía">Anomalía</option>
            <option value="riesgo">Riesgo</option>
            <option value="daño">Daño</option>
          </select>
          <input
            className="flex-1 border rounded p-3 bg-transparent"
            placeholder="Descripción breve"
            value={incDesc}
            onChange={(e) => setIncDesc(e.target.value)}
          />
          <button onClick={submitIncident} className="px-4 py-3 rounded bg-blue-600 text-white">Enviar</button>
        </div>
      </div>

      <div className="rounded-xl border dark:border-neutral-800 p-4">
        <button onClick={sendEmergency} className="w-full px-4 py-3 rounded bg-rose-600 text-white">
          🚨 Botón de emergencia
        </button>
      </div>

      {msg && <div className="text-sm opacity-90">{msg}</div>}
    </div>
  );
}
