// client/src/pages/RutasAdmin/CheckpointForm.jsx
import React from "react";
import { useAuth0 } from "@auth0/auth0-react";
import { routesApi } from "../../lib/apiRoutes";

export default function CheckpointForm({ routeId }) {
  const { getAccessTokenSilently } = useAuth0();
  const api = React.useMemo(() => routesApi(getAccessTokenSilently), [getAccessTokenSilently]);

  const [route, setRoute] = React.useState(null);
  const [cp, setCp] = React.useState({ code:"", name:"", order:0, allowedMethods:["qr"], expectedSecondsFromStart:0, graceSeconds:120 });

  async function load() {
    const r = await api.get(routeId);
    setRoute(r);
  }
  React.useEffect(()=>{ load(); }, [routeId]);

  async function saveCp() {
    if (!cp.code || !cp.name) return alert("Completa code y name");
    await api.upsertCheckpoint(routeId, cp);
    setCp({ code:"", name:"", order:0, allowedMethods:["qr"], expectedSecondsFromStart:0, graceSeconds:120 });
    load();
  }
  async function del(code) {
    if (!confirm("¿Eliminar checkpoint?")) return;
    await api.deleteCheckpoint(routeId, code);
    load();
  }

  return (
    <div className="grid gap-3">
      <div className="grid sm:grid-cols-2 gap-2">
        <input className="input" placeholder="Código" value={cp.code} onChange={e=>setCp(s=>({...s,code:e.target.value}))}/>
        <input className="input" placeholder="Nombre" value={cp.name} onChange={e=>setCp(s=>({...s,name:e.target.value}))}/>
        <input className="input" placeholder="Orden" type="number" value={cp.order} onChange={e=>setCp(s=>({...s,order:Number(e.target.value)}))}/>
        <input className="input" placeholder="Segundos esperados" type="number" value={cp.expectedSecondsFromStart} onChange={e=>setCp(s=>({...s,expectedSecondsFromStart:Number(e.target.value)}))}/>
        <input className="input" placeholder="Tolerancia (s)" type="number" value={cp.graceSeconds} onChange={e=>setCp(s=>({...s,graceSeconds:Number(e.target.value)}))}/>
      </div>
      <div className="flex gap-2">
        <button className="btn" onClick={saveCp}>Agregar / Actualizar</button>
      </div>

      <div className="grid gap-2">
        {route?.checkpoints?.map(c => (
          <div key={c.code} className="p-2 border rounded-xl flex items-center justify-between">
            <div>{c.order}. {c.name} <span className="opacity-60">({c.code})</span></div>
            <button className="btn-danger" onClick={()=>del(c.code)}>Eliminar</button>
          </div>
        ))}
      </div>
    </div>
  );
}
