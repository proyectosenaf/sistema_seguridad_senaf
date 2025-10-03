import React from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "/src/lib/api.js";
import RondasAPI from "/src/lib/rondasApi.js";
import { Plus, Pencil, Trash2, QrCode, Search, RefreshCw, Clipboard } from "lucide-react";

function Badge({ children }) {
  return (
    <span className="text-[11px] px-2 py-0.5 rounded-full bg-neutral-800/30">
      {children}
    </span>
  );
}

export default function RoutesList() {
  const nav = useNavigate();
  const [q, setQ] = React.useState("");
  const [debouncedQ, setDebouncedQ] = React.useState("");
  const [items, setItems] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [err, setErr] = React.useState("");

  // debounce de la búsqueda
  React.useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q.trim()), 350);
    return () => clearTimeout(t);
  }, [q]);

  const load = React.useCallback(async () => {
    setLoading(true);
    setErr("");
    try {
      const { data } = await api.get("/api/routes", { params: { q: debouncedQ } });
      setItems(Array.isArray(data) ? data : []);
    } catch (e) {
      const msg = e?.response?.data?.error || e.message;
      setErr(msg);
      // si caducó el token o no autorizado, vuelve a login
      if (e?.response?.status === 401) {
        nav("/login");
      }
    } finally {
      setLoading(false);
    }
  }, [debouncedQ, nav]);

  React.useEffect(() => { load(); }, [load]);

  async function del(id) {
    if (!confirm("¿Eliminar esta ruta? Esta acción no se puede deshacer.")) return;
    setErr("");
    try {
      await api.delete(`/api/routes/${id}`);
      await load();
    } catch (e) {
      setErr(e?.response?.data?.error || e.message);
    }
  }

  function qrUrl(routeId, code, fmt = "svg") {
    return RondasAPI.getCheckpointQRUrl(routeId, code, { fmt, label: true });
  }

  async function copy(text) {
    try {
      await navigator.clipboard.writeText(text);
    } catch {}
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div className="text-2xl font-semibold">Rutas de Rondas</div>
        <div className="flex items-center gap-2">
          <button
            onClick={load}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800"
            title="Refrescar"
          >
            <RefreshCw className="w-4 h-4" />
            <span className="hidden sm:inline">Refrescar</span>
          </button>
          <Link
            to="/rutas-admin/nueva"
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700"
          >
            <Plus className="w-4 h-4" /> Nueva ruta
          </Link>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-md">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && load()}
            placeholder="Buscar por nombre o código…"
            className="w-full pl-9 pr-3 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white/80 dark:bg-neutral-900/60"
          />
          <Search className="w-4 h-4 opacity-60 absolute left-3 top-1/2 -translate-y-1/2" />
        </div>
        <button
          onClick={load}
          className="px-3 py-2 rounded-lg border dark:border-neutral-700"
        >
          Buscar
        </button>
      </div>

      {err && (
        <div className="p-3 rounded-lg bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-100">
          {err}
        </div>
      )}

      <div className="rounded-2xl border dark:border-neutral-800 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-black/5 dark:bg-white/5">
            <tr className="text-left">
              <th className="p-3">Ruta</th>
              <th className="p-3">Código</th>
              <th className="p-3">Checkpoints</th>
              <th className="p-3">SLA</th>
              <th className="p-3 w-[1%]">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td className="p-4 opacity-60" colSpan={5}>Cargando…</td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td className="p-6 opacity-60" colSpan={5}>
                  No hay rutas. Crea una con “Nueva ruta”.
                </td>
              </tr>
            ) : (
              items.map((r) => (
                <tr key={r._id} className="border-t dark:border-neutral-800 align-top">
                  <td className="p-3">
                    <div className="font-medium">{r?.name || "—"}</div>
                    <div className="text-xs opacity-70">
                      Site: {r?.siteId || "—"} · {r?.active ? <Badge>Activa</Badge> : <Badge>Inactiva</Badge>}
                    </div>
                  </td>
                  <td className="p-3">{r?.code || "—"}</td>
                  <td className="p-3">
                    {Array.isArray(r?.checkpoints) && r.checkpoints.length ? (
                      <div className="flex flex-wrap gap-2">
                        {r.checkpoints.map((cp) => (
                          <div
                            key={`${r._id}-${cp.code}`}
                            className="px-2 py-1 rounded border dark:border-neutral-700"
                          >
                            <div className="font-mono text-[12px] flex items-center gap-1">
                              {cp.code}
                              <button
                                onClick={() => copy(cp.code)}
                                className="opacity-60 hover:opacity-100"
                                title="Copiar código"
                              >
                                <Clipboard className="w-3 h-3" />
                              </button>
                            </div>
                            <div className="text-[11px] opacity-70">{cp.name}</div>
                            <a
                              href={qrUrl(r._id, cp.code, "svg")}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 mt-1 text-[11px] underline opacity-80 hover:opacity-100"
                              title="Ver QR"
                            >
                              <QrCode className="w-3 h-3" /> QR
                            </a>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <span className="opacity-60">—</span>
                    )}
                  </td>
                  <td className="p-3">
                    <div className="text-[12px]">
                      late: <b>{r?.sla?.lateThresholdSeconds ?? 180}</b>s ·{" "}
                      missing: <b>{r?.sla?.missingThresholdSeconds ?? 600}</b>s
                    </div>
                  </td>
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => nav(`/rutas-admin/${r._id}`)}
                        className="px-2 py-1 rounded border dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                        title="Editar"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => del(r._id)}
                        className="px-2 py-1 rounded bg-rose-600 text-white hover:bg-rose-700"
                        title="Eliminar"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
