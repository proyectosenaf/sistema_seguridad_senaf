// client/src/modules/rondasqr/admin/PointsTab.jsx
import React, { useEffect, useState } from "react";
import { rondasqrApi } from "../api/rondasqrApi";

function Select({ value, onChange, children, className = "" }) {
  return (
    <select
      value={value || ""}
      onChange={(e) => onChange?.(e.target.value || null)}
      className={
        "px-3 py-2 rounded-lg bg-black/40 border border-white/10 text-sm text-white w-full focus:outline-none focus:ring-2 focus:ring-emerald-400 " +
        className
      }
    >
      {children}
    </select>
  );
}

export default function PointsTab() {
  const [sites, setSites] = useState([]);
  const [rounds, setRounds] = useState([]);
  const [points, setPoints] = useState([]);

  const [siteId, setSiteId] = useState(null);
  const [roundId, setRoundId] = useState(null);

  const [name, setName] = useState("");
  const [qr, setQr] = useState("");
  const [order, setOrder] = useState(0);

  const [loading, setLoading] = useState(false);
  const [repoOpen, setRepoOpen] = useState(false);
  const [repoItems, setRepoItems] = useState([]);

  /* ---------------- Cargar sitios al inicio ---------------- */
  useEffect(() => {
    (async () => {
      try {
        const res = await rondasqrApi.listSites();
        const items = res?.items || [];
        setSites(items);
        if (items.length && !siteId) {
          setSiteId(String(items[0].id || items[0]._id));
        }
      } catch (e) {
        console.error("[PointsTab] listSites error", e);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ------------- Cuando cambia sitio → cargar rondas --------- */
  useEffect(() => {
    if (!siteId) return;
    (async () => {
      try {
        const res = await rondasqrApi.listRounds(siteId);
        const items = res?.items || [];
        setRounds(items);
        if (items.length && !roundId) {
          setRoundId(String(items[0].id || items[0]._id));
        }
      } catch (e) {
        console.error("[PointsTab] listRounds error", e);
      }
    })();
  }, [siteId, roundId]);

  /* ------------- Cuando cambia sitio/ronda → puntos ---------- */
  useEffect(() => {
    if (!siteId || !roundId) {
      setPoints([]);
      return;
    }
    loadPoints(siteId, roundId);
  }, [siteId, roundId]);

  async function loadPoints(sid = siteId, rid = roundId) {
    if (!sid || !rid) return;
    try {
      setLoading(true);
      const res = await rondasqrApi.listPoints({ siteId: sid, roundId: rid });
      const items = res?.items || [];
      setPoints(items);
      setOrder(items.length); // siguiente correlativo
    } catch (e) {
      console.error("[PointsTab] listPoints error", e);
    } finally {
      setLoading(false);
    }
  }

  /* -------------------- Crear punto -------------------- */
  async function handleAddPoint() {
    if (!siteId || !roundId || !name.trim()) {
      alert("Completa sitio, ronda y nombre del punto.");
      return;
    }
    try {
      setLoading(true);
      await rondasqrApi.createPoint({
        siteId,
        roundId,
        name: name.trim(),
        qr: qr.trim() || undefined, // si lo dejas vacío, el backend puede autogenerar
        order: Number(order) ?? undefined,
      });
      setName("");
      setQr("");
      await loadPoints();
    } catch (e) {
      console.error("[PointsTab] createPoint error", e);
      alert(e?.message || "No se pudo crear el punto");
    } finally {
      setLoading(false);
    }
  }

  /* -------------------- Eliminar punto -------------------- */
  async function handleDeletePoint(p) {
    if (!window.confirm(`¿Eliminar el punto "${p.name}"?`)) return;
    try {
      setLoading(true);
      await rondasqrApi.deletePoint(p.id || p._id);
      await loadPoints();
    } catch (e) {
      console.error("[PointsTab] deletePoint error", e);
      alert(e?.message || "No se pudo eliminar el punto");
    } finally {
      setLoading(false);
    }
  }

  /* -------------------- Rotar QR de un punto -------------------- */
  async function handleRotateQr(p) {
    try {
      setLoading(true);
      await rondasqrApi.rotatePointQr(p.id || p._id);
      await loadPoints();
    } catch (e) {
      console.error("[PointsTab] rotatePointQr error", e);
      alert(e?.message || "No se pudo rotar el QR");
    } finally {
      setLoading(false);
    }
  }

  /* -------------------- Repositorio de QRs -------------------- */
  async function openRepo() {
    if (!siteId && !roundId) {
      alert("Selecciona al menos un sitio o una ronda.");
      return;
    }
    try {
      setLoading(true);
      const res = await rondasqrApi.listQrRepo({ siteId, roundId });
      setRepoItems(res?.items || []);
      setRepoOpen(true);
    } catch (e) {
      console.error("[PointsTab] listQrRepo error", e);
      alert(e?.message || "No se pudo cargar el repositorio de QRs");
    } finally {
      setLoading(false);
    }
  }

  /* -------------------- Render -------------------- */
  return (
    <div className="space-y-6">
      {/* Fila de filtros y formulario de alta */}
      <div className="flex flex-wrap gap-3 items-end">
        <div className="w-full sm:w-1/4">
          <label className="block text-xs text-white/60 mb-1">Sitio</label>
          <Select value={siteId || ""} onChange={setSiteId}>
            {sites.length === 0 && <option value="">Sin sitios</option>}
            {sites.map((s) => (
              <option key={s.id || s._id} value={s.id || s._id}>
                {s.name}
              </option>
            ))}
          </Select>
        </div>

        <div className="w-full sm:w-1/4">
          <label className="block text-xs text-white/60 mb-1">Ronda</label>
          <Select value={roundId || ""} onChange={setRoundId}>
            {rounds.length === 0 && <option value="">Sin rondas</option>}
            {rounds.map((r) => (
              <option key={r.id || r._id} value={r.id || r._id}>
                {r.name}
              </option>
            ))}
          </Select>
        </div>

        <div className="w-full sm:flex-1">
          <label className="block text-xs text-white/60 mb-1">
            Nombre punto
          </label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-3 py-2 rounded-lg bg-black/40 border border-white/10 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-400"
            placeholder="Ej. Portón principal"
          />
        </div>

        <div className="w-32">
          <label className="block text-xs text-white/60 mb-1">QR (opcional)</label>
          <input
            value={qr}
            onChange={(e) => setQr(e.target.value)}
            className="w-full px-3 py-2 rounded-lg bg-black/40 border border-white/10 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-400"
            placeholder="auto"
          />
        </div>

        <div className="w-20">
          <label className="block text-xs text-white/60 mb-1">Orden</label>
          <input
            type="number"
            value={order}
            onChange={(e) => setOrder(e.target.value)}
            className="w-full px-3 py-2 rounded-lg bg-black/40 border border-white/10 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-400"
          />
        </div>

        <button
          onClick={handleAddPoint}
          className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-sm font-semibold text-black shadow"
        >
          Agregar
        </button>

        <button
          onClick={openRepo}
          className="ml-auto px-4 py-2 rounded-lg bg-sky-500 hover:bg-sky-400 text-sm font-semibold text-black shadow"
        >
          Repositorio de códigos QR
        </button>
      </div>

      {/* Tabla de puntos */}
      <div className="rounded-xl bg-black/40 border border-white/10 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2 border-b border-white/10">
          <div className="font-semibold text-white">Puntos</div>
          {loading && (
            <div className="text-xs text-white/70 animate-pulse">
              Cargando…
            </div>
          )}
        </div>

        <div className="min-w-full overflow-x-auto">
          <table className="min-w-full text-sm text-left text-white/90">
            <thead className="bg-white/5 uppercase text-xs">
              <tr>
                <th className="px-3 py-2 w-16">Orden</th>
                <th className="px-3 py-2">Punto</th>
                <th className="px-3 py-2">QR</th>
                <th className="px-3 py-2 w-64">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {points.length === 0 && (
                <tr>
                  <td
                    colSpan={4}
                    className="px-4 py-4 text-center text-white/50 text-sm"
                  >
                    No hay puntos configurados para esta ronda.
                  </td>
                </tr>
              )}

              {points.map((p) => {
                const id = p.id || p._id;
                const qrUrl = p.qr
                  ? rondasqrApi.pointQrPngUrl(id)
                  : null;
                return (
                  <tr
                    key={id}
                    className="border-t border-white/5 hover:bg-white/5"
                  >
                    <td className="px-3 py-2 align-top">{p.order}</td>
                    <td className="px-3 py-2 align-top">
                      <div className="font-medium">{p.name}</div>
                      {p.notes && (
                        <div className="text-xs text-white/60">
                          {p.notes}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2 align-top">
                      {p.qr ? (
                        <div className="flex items-center gap-3">
                          {qrUrl && (
                            <img
                              src={qrUrl}
                              alt={p.name}
                              className="w-16 h-16 object-contain bg-white rounded"
                            />
                          )}
                          <div className="text-xs break-all max-w-[200px]">
                            {p.qr}
                          </div>
                        </div>
                      ) : (
                        <span className="text-xs text-white/50">
                          Sin QR (se generará al rotar)
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 align-top">
                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() => handleRotateQr(p)}
                          className="px-2 py-1 rounded-md bg-amber-400 hover:bg-amber-300 text-xs font-semibold text-black"
                        >
                          Rotar QR
                        </button>
                        {p.qr && (
                          <a
                            href={rondasqrApi.pointQrPdfUrl(id)}
                            target="_blank"
                            rel="noreferrer"
                            className="px-2 py-1 rounded-md bg-sky-400 hover:bg-sky-300 text-xs font-semibold text-black"
                          >
                            PDF
                          </a>
                        )}
                        <button
                          onClick={() => handleDeletePoint(p)}
                          className="px-2 py-1 rounded-md bg-rose-500 hover:bg-rose-400 text-xs font-semibold text-white"
                        >
                          Eliminar
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal simple de repositorio de QRs */}
      {repoOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70">
          <div className="bg-zinc-900 rounded-2xl border border-white/10 max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
              <div className="font-semibold text-white">
                Repositorio de códigos QR
              </div>
              <button
                onClick={() => setRepoOpen(false)}
                className="text-sm text-white/70 hover:text-white"
              >
                ✕ Cerrar
              </button>
            </div>

            <div className="p-4 overflow-auto">
              {repoItems.length === 0 && (
                <div className="text-sm text-white/60">
                  No hay puntos con QR para los filtros seleccionados.
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {repoItems.map((item) => {
                  const id = item.id || item._id;
                  const qrUrl = item.qr
                    ? rondasqrApi.pointQrPngUrl(id)
                    : null;
                  return (
                    <div
                      key={id}
                      className="rounded-xl bg-black/40 border border-white/10 p-3 flex flex-col items-center gap-2"
                    >
                      <div className="text-xs text-white/70 text-center">
                        <div className="font-semibold">
                          {item.siteName} – {item.roundName}
                        </div>
                        <div>{item.name}</div>
                      </div>
                      {qrUrl ? (
                        <img
                          src={qrUrl}
                          alt={item.name}
                          className="w-40 h-40 object-contain bg-white rounded"
                        />
                      ) : (
                        <span className="text-xs text-white/50">
                          Sin QR
                        </span>
                      )}
                      {item.qr && (
                        <div className="text-[10px] text-white/60 break-all text-center">
                          {item.qr}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="px-4 py-3 border-t border-white/10 text-xs text-white/60">
              Puedes imprimir esta vista desde el navegador (Ctrl+P).
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
