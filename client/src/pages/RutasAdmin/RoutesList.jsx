// client/src/pages/RutasAdmin/RoutesList.jsx
import React from "react";
import { useAuth0 } from "@auth0/auth0-react";
import { routesApi } from "../../lib/apiRoutes";
import { Link, useNavigate } from "react-router-dom";

export default function RoutesList() {
  const { getAccessTokenSilently } = useAuth0();
  const api = React.useMemo(() => routesApi(getAccessTokenSilently), [getAccessTokenSilently]);
  const [state, setState] = React.useState({ items: [], total: 0, page: 1, q: "" });
  const nav = useNavigate();

  async function load(page=1) {
    const data = await api.list({ page, q: state.q });
    setState(s => ({ ...s, ...data, page }));
  }
  React.useEffect(() => { load(1); }, [state.q]);

  async function onDelete(id) {
    if (!confirm("¿Eliminar ruta?")) return;
    await api.remove(id);
    load(state.page);
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-2">
        <input className="input" placeholder="Buscar…" value={state.q} onChange={e=>setState(s=>({...s,q:e.target.value}))}/>
        <button className="btn" onClick={()=>nav("/rutas-admin/nueva")}>Nueva Ruta</button>
      </div>
      <div className="grid gap-2">
        {state.items.map(r => (
          <div key={r._id} className="p-3 rounded-xl border flex items-center justify-between">
            <div>
              <div className="font-semibold">{r.name}</div>
              <div className="text-xs opacity-70">{r.code} · {r.checkpoints?.length ?? 0} checkpoints</div>
            </div>
            <div className="flex gap-2">
              <button className="btn-secondary" onClick={()=>nav(`/rutas-admin/${r._id}`)}>Editar</button>
              <button className="btn-danger" onClick={()=>onDelete(r._id)}>Eliminar</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
