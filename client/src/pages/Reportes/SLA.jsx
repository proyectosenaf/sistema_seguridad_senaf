// client/src/pages/Reportes/SLA.jsx
import React from "react";
import dayjs from "dayjs";
import { useAuth0 } from "@auth0/auth0-react";
import { reportsApi } from "../../lib/apiRoutes";

export default function SLA() {
  const { getAccessTokenSilently } = useAuth0();
  const api = React.useMemo(() => reportsApi(getAccessTokenSilently), [getAccessTokenSilently]);
  const [from, setFrom] = React.useState(dayjs().subtract(7,"day").format("YYYY-MM-DD"));
  const [to, setTo] = React.useState(dayjs().format("YYYY-MM-DD"));
  const [data, setData] = React.useState(null);

  async function load() {
    const d = await api.sla(`${from}T00:00:00Z`, `${to}T23:59:59Z`);
    setData(d);
  }
  React.useEffect(()=>{ load(); }, []);

  return (
    <div className="p-4 space-y-3">
      <div className="flex gap-2 items-end">
        <label className="grid text-xs">Desde<input type="date" className="input" value={from} onChange={e=>setFrom(e.target.value)} /></label>
        <label className="grid text-xs">Hasta<input type="date" className="input" value={to} onChange={e=>setTo(e.target.value)} /></label>
        <button className="btn" onClick={load}>Actualizar</button>
        {data && (
          <>
            <a className="btn-secondary" href={api.slaExcelUrl(`${from}T00:00:00Z`, `${to}T23:59:59Z`)} target="_blank">Excel</a>
            <a className="btn-secondary" href={api.slaPdfUrl(`${from}T00:00:00Z`, `${to}T23:59:59Z`)} target="_blank">PDF</a>
          </>
        )}
      </div>

      <div className="grid gap-2">
        {data?.items?.map(r => (
          <div key={r.routeId} className="p-3 rounded-xl border">
            <div className="font-semibold">{r.routeName}</div>
            <div className="text-sm opacity-70">OK: {r.ok} · Tarde: {r.late} · Inválido: {r.invalid} · Total: {r.total} · Score: {r.score}%</div>
          </div>
        ))}
      </div>
    </div>
  );
}
