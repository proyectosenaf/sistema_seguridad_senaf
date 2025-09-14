// client/src/pages/Rondas/Rondas.jsx
import React from "react";
import { Loader2, RefreshCw, Play, CheckCircle2, MapPin, XCircle, Target } from "lucide-react";
import { api } from "../../lib/api.js"; // <-- cambia a "@/lib/api" si tienes alias

/* ========== helpers ========== */
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const StatusChip = ({ s }) => {
  const map = {
    pendiente: "bg-neutral-200 text-neutral-800 dark:bg-neutral-800 dark:text-neutral-200",
    hecho: "bg-emerald-200 text-emerald-900 dark:bg-emerald-700/40 dark:text-emerald-300",
    tarde: "bg-amber-200 text-amber-900 dark:bg-amber-700/40 dark:text-amber-300",
    fuera_geocerca: "bg-rose-200 text-rose-900 dark:bg-rose-700/40 dark:text-rose-300",
    omitido: "bg-neutral-300 text-neutral-900 dark:bg-neutral-700/50 dark:text-neutral-200",
  };
  return <span className={`px-2 py-1 rounded-lg text-xs font-medium ${map[s] ?? map.pendiente}`}>{s}</span>;
};

const fmt = (d) => d ? new Date(d).toLocaleString() : "—";

/* ========== API adapter ==========
   Si tu backend usa otros nombres, AJÚSTALO SOLO AQUÍ
===================================*/
const RondasAPI = {
  async activa(guardiaId) {
    const { data } = await api.get("/rondas/activa", { params: { guardiaId } });
    // normaliza
    if (!data?.ronda) return { ronda: null, puntos: [] };
    return {
      ronda: {
        id: data.ronda.id_ronda ?? data.ronda._id ?? data.ronda.id,
        fecha: data.ronda.fecha,
        inicio: data.ronda.hora_inicio ?? data.ronda.horaInicio,
        fin: data.ronda.hora_fin ?? data.ronda.horaFin,
        resultado: data.ronda.resultado ?? null,
        observaciones: data.ronda.observaciones ?? null,
      },
      puntos: (data.puntos ?? []).map(p => ({
        idRondaPunto: p.id_ronda_punto ?? p._id ?? p.id,
        idPunto: p.id_punto ?? p.puntoId,
        nombre: p.nombre,
        orden: p.orden,
        lat: p.lat, lng: p.lng,
        estado: p.estado ?? "pendiente",
        hechoEn: p.hecho_en ?? p.hechoEn ?? null,
      })),
    };
  },

  async plantillas() {
    const { data } = await api.get("/plantillas");
    // normaliza
    return (data ?? []).map(pl => ({
      id: pl._id ?? pl.id,
      nombre: pl.nombre,
      puntos: (pl.puntos ?? []).map(pt => ({
        id: pt._id ?? pt.id,
        nombre: pt.nombre,
        orden: pt.orden,
        lat: pt.lat, lng: pt.lng,
        radio_m: pt.radio_m ?? 40,
      })),
    }));
  },

  async iniciar(idPlantilla, guardiaId) {
    const { data } = await api.post("/rondas", { id_plantilla: idPlantilla, guardiaId });
    return {
      rondaId: data?.ronda?.id_ronda ?? data?.ronda?._id ?? data?.ronda?.id,
      puntos: (data?.puntos ?? []).map(p => ({
        idRondaPunto: p.id_ronda_punto ?? p._id ?? p.id,
        idPunto: p.id_punto ?? p.puntoId,
        nombre: p.nombre, orden: p.orden, estado: p.estado ?? "pendiente",
        lat: p.lat, lng: p.lng
      })),
    };
  },

  async marcar(rondaId, idPunto, coords) {
    const payload = { id_punto: idPunto };
    if (coords) { payload.lat = coords.latitude; payload.lng = coords.longitude; }
    const { data } = await api.post(`/rondas/${rondaId}/marcar`, payload);
    return data?.estado ?? "hecho";
  },

  async cerrar(rondaId, observaciones) {
    const { data } = await api.patch(`/rondas/${rondaId}/cerrar`, { observaciones });
    return { resultado: data?.resultado ?? null };
  },
};

/* ========== componente principal ========== */
export default function Rondas() {
  const GUARDIA_ID = "1"; // TODO: remplazar con el id real de la sesión
  const [loading, setLoading] = React.useState(true);
  const [err, setErr] = React.useState("");

  const [plantillas, setPlantillas] = React.useState([]);
  const [selPlantilla, setSelPlantilla] = React.useState("");

  const [ronda, setRonda] = React.useState(null);
  const [puntos, setPuntos] = React.useState([]);

  const completados = puntos.filter(p => ["hecho","tarde"].includes(p.estado)).length;

  async function loadAll() {
    setLoading(true);
    setErr("");
    try {
      const [act, pls] = await Promise.all([
        RondasAPI.activa(GUARDIA_ID),
        RondasAPI.plantillas(),
      ]);
      setRonda(act.ronda);
      setPuntos(act.puntos);
      setPlantillas(pls);
      if (!selPlantilla && pls[0]) setSelPlantilla(pls[0].id);
    } catch (e) {
      setErr(e?.response?.data?.error || e.message || "Error al cargar");
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => { loadAll(); }, []);

  async function iniciar() {
    if (!selPlantilla) return;
    setLoading(true);
    setErr("");
    try {
      const { rondaId, puntos } = await RondasAPI.iniciar(selPlantilla, GUARDIA_ID);
      setRonda({ id: rondaId, fecha: new Date(), inicio: new Date() });
      setPuntos(puntos);
    } catch (e) {
      setErr(e?.response?.data?.error || e.message);
    } finally {
      setLoading(false);
    }
  }

  async function marcar(p) {
    try {
      const getPos = () =>
        new Promise((resolve) => {
          if (!navigator.geolocation) return resolve(null);
          navigator.geolocation.getCurrentPosition(
            (pos) => resolve(pos.coords),
            () => resolve(null),
            { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
          );
        });

      const coords = await getPos();
      const estado = await RondasAPI.marcar(ronda.id, p.idPunto, coords || undefined);

      setPuntos(old =>
        old.map(x => x.idPunto === p.idPunto ? { ...x, estado, hechoEn: new Date() } : x)
      );
    } catch (e) {
      setErr(e?.response?.data?.error || e.message);
    }
  }

  async function cerrar() {
    if (!ronda?.id) return;
    setLoading(true);
    setErr("");
    try {
      await RondasAPI.cerrar(ronda.id, "");
      await sleep(300);
      // tras cerrar, recargamos todo
      setRonda(null);
      setPuntos([]);
      await loadAll();
    } catch (e) {
      setErr(e?.response?.data?.error || e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* toolbar */}
      <div className="flex items-center gap-3">
        <button
          onClick={loadAll}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800"
          title="Actualizar"
        >
          <RefreshCw className="w-4 h-4" />
          Actualizar
        </button>
        {loading && <Loader2 className="w-4 h-4 animate-spin opacity-70" />}
        <div className="text-sm opacity-70 ml-auto">
          {ronda ? <>Ronda activa desde <b>{fmt(ronda.inicio)}</b> · {completados}/{puntos.length} puntos</> : "Sin ronda activa"}
        </div>
      </div>

      {err && (
        <div className="px-4 py-3 rounded-xl border border-rose-300/60 bg-rose-50/80 text-rose-700 dark:border-rose-700/40 dark:bg-rose-900/40 dark:text-rose-200">
          {err}
        </div>
      )}

      {/* cuando no hay ronda */}
      {!ronda && !loading && (
        <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white/70 dark:bg-neutral-950/60 backdrop-blur p-5">
          <div className="text-lg font-semibold mb-3">Iniciar ronda</div>
          <div className="flex flex-col sm:flex-row gap-3 items-center">
            <select
              value={selPlantilla}
              onChange={e => setSelPlantilla(e.target.value)}
              className="w-full sm:w-80 px-3 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white/80 dark:bg-neutral-900/60"
            >
              {plantillas.map(pl => (
                <option key={pl.id} value={pl.id}>
                  {pl.nombre} · {pl.puntos?.length ?? 0} puntos
                </option>
              ))}
            </select>
            <button
              onClick={iniciar}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 text-white hover:bg-blue-700"
            >
              <Play className="w-4 h-4" />
              Iniciar
            </button>
          </div>
        </div>
      )}

      {/* ronda activa */}
      {ronda && (
        <>
          <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white/70 dark:bg-neutral-950/60 backdrop-blur p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="font-semibold text-lg">Puntos de control</div>
              <button
                onClick={cerrar}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700"
              >
                <CheckCircle2 className="w-4 h-4" />
                Cerrar ronda
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left opacity-70">
                  <tr className="border-b border-neutral-200 dark:border-neutral-800">
                    <th className="py-2 pr-3">#</th>
                    <th className="py-2 pr-3">Punto</th>
                    <th className="py-2 pr-3">Estado</th>
                    <th className="py-2 pr-3">Marcado</th>
                    <th className="py-2 pr-3">Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {puntos.sort((a,b)=>a.orden-b.orden).map((p) => (
                    <tr key={p.idRondaPunto} className="border-b border-neutral-200/70 dark:border-neutral-800/70">
                      <td className="py-2 pr-3">{p.orden}</td>
                      <td className="py-2 pr-3">{p.nombre}</td>
                      <td className="py-2 pr-3"><StatusChip s={p.estado} /></td>
                      <td className="py-2 pr-3 opacity-70">{fmt(p.hechoEn)}</td>
                      <td className="py-2 pr-3">
                        <div className="flex items-center gap-2">
                          <button
                            disabled={["hecho","tarde"].includes(p.estado)}
                            onClick={() => marcar(p)}
                            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-50 disabled:pointer-events-none"
                          >
                            <Target className="w-4 h-4" />
                            Marcar
                          </button>
                          <button
                            onClick={() => window.dispatchEvent(new CustomEvent("map:focus", { detail:{ lat:p.lat, lng:p.lng } }))}
                            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                          >
                            <MapPin className="w-4 h-4" />
                            Ver mapa
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {puntos.length === 0 && (
                    <tr>
                      <td colSpan="5" className="py-6 text-center opacity-70">
                        Sin puntos en esta ronda.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* tarjeta rápida de estado */}
          <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white/70 dark:bg-neutral-950/60 backdrop-blur p-5">
            <div className="flex flex-wrap gap-4 text-sm">
              <div><span className="opacity-60">Inicio:</span> <b>{fmt(ronda.inicio)}</b></div>
              <div><span className="opacity-60">Completados:</span> <b>{completados}/{puntos.length}</b></div>
              <div><span className="opacity-60">Resultado:</span> <b>{ronda.resultado ?? "—"}</b></div>
            </div>
          </div>
        </>
      )}

      {/* placeholder cuando todo carga */}
      {loading && (
        <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white/60 dark:bg-neutral-950/60 p-6 flex items-center gap-3">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span>Cargando…</span>
        </div>
      )}

      {/* tarjeta cuando no haya nada aún */}
      {!ronda && !loading && plantillas.length === 0 && (
        <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white/70 dark:bg-neutral-950/60 p-6">
          <div className="flex items-center gap-2 text-amber-600 dark:text-amber-300">
            <XCircle className="w-5 h-5" />
            No hay plantillas disponibles todavía.
          </div>
        </div>
      )}
    </div>
  );
}
