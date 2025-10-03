// client/src/pages/RutasAdmin/Assignments.jsx
import React from "react";
import RondasAPI from "/src/lib/rondasApi.js";

const dowNames = ["Dom","Lun","Mar","Mié","Jue","Vie","Sáb"];

export default function Assignments() {
  const [routes, setRoutes] = React.useState([]);
  const [items, setItems]   = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [err, setErr] = React.useState("");

  const [form, setForm] = React.useState({
    routeId: "",
    guardExternalId: "",
    frequencyMinutes: 120,     // ⚠️ ahora plano
    daysOfWeek: [1,2,3,4,5],   // ⚠️ ahora plano
    startTime: "00:00",        // ⚠️ ahora plano
    endTime: "23:59",          // ⚠️ ahora plano
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC", // ⚠️ ahora plano
    active: true,
  });

  const loadAll = React.useCallback(async () => {
    setLoading(true); setErr("");
    try {
      const [rs, asg] = await Promise.all([
        RondasAPI.getRoutes(),
        RondasAPI.listAssignments(),
      ]);
      setRoutes(Array.isArray(rs) ? rs : []);
      setItems(Array.isArray(asg) ? asg : []);
    } catch (e) {
      setErr(e?.response?.data?.error || e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => { loadAll(); }, [loadAll]);

  const toggleDow = (d) => {
    setForm(f => {
      const has = f.daysOfWeek.includes(d);
      const days = has ? f.daysOfWeek.filter(x=>x!==d) : [...f.daysOfWeek, d];
      return { ...f, daysOfWeek: days.sort((a,b)=>a-b) };
    });
  };

  const submit = async (e) => {
    e.preventDefault();
    setErr("");
    if (!form.routeId || !form.guardExternalId) {
      setErr("Selecciona ruta e indica el ID externo del guardia.");
      return;
    }
    try {
      await RondasAPI.createAssignment({
        routeId: form.routeId,
        guardExternalId: form.guardExternalId,
        active: !!form.active,
        daysOfWeek: form.daysOfWeek,
        startTime: form.startTime,
        endTime: form.endTime,
        frequencyMinutes: Number(form.frequencyMinutes) || 60,
        timezone: form.timezone,
      });
      setForm(prev => ({ ...prev, guardExternalId: "" }));
      await loadAll();
    } catch (e) {
      setErr(e?.response?.data?.error || e.message);
    }
  };

  const del = async (id) => {
    if (!confirm("¿Eliminar asignación?")) return;
    setErr("");
    try {
      await RondasAPI.deleteAssignment(id);
      await loadAll();
    } catch (e) {
      setErr(e?.response?.data?.error || e.message);
    }
  };

  const toggleActive = async (id, current) => {
    setErr("");
    try {
      await RondasAPI.updateAssignment(id, { active: !current });
      setItems(prev => prev.map(a => a._id === id ? { ...a, active: !current } : a));
    } catch (e) {
      setErr(e?.response?.data?.error || e.message);
    }
  };

  const qrLink = (routeId, code, fmt="svg") =>
    RondasAPI.getCheckpointQRUrl(routeId, code, { fmt, label: true });

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="text-2xl font-semibold">Asignaciones de Rondas</div>

      {err && <div className="p-3 rounded bg-rose-100 text-rose-900 dark:bg-rose-900/30 dark:text-rose-100">{err}</div>}

      <div className="grid md:grid-cols-2 gap-4">
        {/* ---- Formulario ---- */}
        <div className="p-4 rounded-xl border dark:border-neutral-800">
          <div className="font-medium mb-3">Nueva asignación</div>
          <form onSubmit={submit} className="space-y-3">
            <div>
              <div className="text-sm opacity-70 mb-1">Ruta</div>
              <select
                className="w-full border rounded p-2"
                value={form.routeId}
                onChange={(e)=>setForm(f=>({...f, routeId: e.target.value}))}
              >
                <option value="">Selecciona ruta…</option>
                {routes.map(r => <option key={r._id} value={r._id}>{r.name}</option>)}
              </select>
            </div>

            <div>
              <div className="text-sm opacity-70 mb-1">ID externo del guardia</div>
              <input
                className="w-full border rounded p-2"
                value={form.guardExternalId}
                onChange={(e)=>setForm(f=>({...f, guardExternalId: e.target.value}))}
                placeholder="externalId/email/sub"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="text-sm opacity-70 mb-1">Frecuencia (min)</div>
                <input
                  type="number" min="1"
                  className="w-full border rounded p-2"
                  value={form.frequencyMinutes}
                  onChange={(e)=>setForm(f=>({...f, frequencyMinutes: e.target.value}))}
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  id="active" type="checkbox" className="w-4 h-4"
                  checked={!!form.active}
                  onChange={(e)=>setForm(f=>({...f, active: e.target.checked}))}
                />
                <label htmlFor="active" className="text-sm">Activa</label>
              </div>
            </div>

            <div>
              <div className="text-sm opacity-70 mb-1">Días de la semana</div>
              <div className="flex flex-wrap gap-2">
                {dowNames.map((n, i)=>(
                  <label
                    key={i}
                    className={`px-2 py-1 rounded border cursor-pointer select-none ${
                      form.daysOfWeek.includes(i)
                        ? "bg-emerald-600 text-white border-emerald-700"
                        : "border-neutral-300 dark:border-neutral-700"
                    }`}
                  >
                    <input
                      type="checkbox"
                      className="hidden"
                      checked={form.daysOfWeek.includes(i)}
                      onChange={()=>toggleDow(i)}
                    />
                    {n}
                  </label>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="text-sm opacity-70 mb-1">Ventana inicio (HH:mm)</div>
                <input
                  className="w-full border rounded p-2"
                  value={form.startTime}
                  onChange={(e)=>setForm(f=>({...f, startTime: e.target.value}))}
                />
              </div>
              <div>
                <div className="text-sm opacity-70 mb-1">Ventana fin (HH:mm)</div>
                <input
                  className="w-full border rounded p-2"
                  value={form.endTime}
                  onChange={(e)=>setForm(f=>({...f, endTime: e.target.value}))}
                />
              </div>
            </div>

            <div>
              <div className="text-sm opacity-70 mb-1">Zona horaria</div>
              <input
                className="w-full border rounded p-2"
                value={form.timezone}
                onChange={(e)=>setForm(f=>({...f, timezone: e.target.value}))}
                placeholder="America/Tegucigalpa"
              />
            </div>

            <div className="text-right">
              <button className="rounded bg-emerald-600 text-white px-4 py-2 hover:bg-emerald-700">
                Crear asignación
              </button>
            </div>
          </form>
        </div>

        {/* ---- Listado ---- */}
        <div className="p-4 rounded-xl border dark:border-neutral-800">
          <div className="font-medium mb-3 flex items-center justify-between">
            <span>Asignaciones existentes</span>
            {loading && <span className="text-xs opacity-60">Cargando…</span>}
          </div>

          {items.length === 0 ? (
            <div className="opacity-60 text-sm">Sin asignaciones.</div>
          ) : (
            <div className="space-y-3">
              {items.map(a => (
                <div key={a._id} className="p-3 rounded-lg border dark:border-neutral-800">
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-medium">
                      {a.route?.name || "Ruta"} · Guardia: {a.guard?.externalId || a.guardExternalId}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs opacity-70">{a.active ? "Activa" : "Inactiva"}</span>
                      <button
                        onClick={()=>toggleActive(a._id, a.active)}
                        className="px-2 py-1 text-xs rounded border dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                        title={a.active ? "Desactivar" : "Activar"}
                      >
                        {a.active ? "Desactivar" : "Activar"}
                      </button>
                    </div>
                  </div>

                  <div className="text-xs opacity-80 mt-1">
                    Frecuencia: {a.frequencyMinutes ?? "?"} min · Días: {(a.daysOfWeek || []).map(d=>dowNames[d]).join(", ") || "—"} · Ventana: {a.startTime ?? "—"}–{a.endTime ?? "—"} · TZ: {a.timezone || "—"}
                  </div>

                  {/* QRs de la ruta */}
                  {Array.isArray(routes) && routes.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {(routes.find(r => r._id === a.routeId)?.checkpoints || []).map(cp => (
                        <a
                          key={cp.code}
                          href={qrLink(a.routeId, cp.code, "svg")}
                          target="_blank" rel="noreferrer"
                          className="text-xs px-2 py-1 rounded border hover:bg-neutral-100 dark:hover:bg-neutral-800"
                        >
                          QR: {cp.name || cp.code}
                        </a>
                      ))}
                    </div>
                  )}

                  <div className="mt-2 text-right">
                    <button
                      onClick={()=>del(a._id)}
                      className="px-3 py-1.5 rounded bg-rose-600 text-white hover:bg-rose-700"
                    >
                      Eliminar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
