// client/src/modules/rondasqr/admin/PointsTab.jsx
import React, { useEffect, useState, useCallback, useMemo } from "react";
import { rondasqrApi } from "../api/rondasqrApi.js";

function toId(v) {
  if (!v) return "";
  if (typeof v === "string") return v.trim();
  if (typeof v === "object") return String(v.id || v._id || "").trim();
  return "";
}

function asItems(res) {
  if (!res) return [];
  if (Array.isArray(res)) return res;
  if (Array.isArray(res.items)) return res.items;
  return [];
}

function pointQrValue(p) {
  return String(p?.qr || p?.qrNo || p?.code || "").trim();
}

function Select({ value, onChange, children, className = "", disabled = false }) {
  return (
    <select
      value={value || ""}
      onChange={(e) => onChange?.(e.target.value || "")}
      disabled={disabled}
      className={
        "px-3 py-2 rounded-lg bg-black/40 border border-white/10 text-sm text-white w-full " +
        "focus:outline-none focus:ring-2 focus:ring-emerald-400 disabled:opacity-60 disabled:cursor-not-allowed " +
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

  const [siteId, setSiteId] = useState("");
  const [roundId, setRoundId] = useState("");

  const [name, setName] = useState("");
  const [qr, setQr] = useState("");
  const [order, setOrder] = useState("");

  const [loading, setLoading] = useState(false);
  const [repoOpen, setRepoOpen] = useState(false);
  const [repoItems, setRepoItems] = useState([]);

  const selectedSite = useMemo(
    () => sites.find((s) => toId(s) === siteId) || null,
    [sites, siteId]
  );

  const selectedRound = useMemo(
    () => rounds.find((r) => toId(r) === roundId) || null,
    [rounds, roundId]
  );

  const loadPoints = useCallback(async (sid, rid) => {
    const safeSiteId = toId(sid);
    const safeRoundId = toId(rid);

    if (!safeSiteId || !safeRoundId) {
      setPoints([]);
      setOrder("");
      return;
    }

    try {
      setLoading(true);
      const res = await rondasqrApi.listPoints({
        siteId: safeSiteId,
        roundId: safeRoundId,
      });

      const items = asItems(res).sort((a, b) => {
        const ao = Number(a?.order ?? 0);
        const bo = Number(b?.order ?? 0);
        return ao - bo;
      });

      setPoints(items);
      setOrder(String(items.length));
    } catch (e) {
      console.error("[PointsTab] listPoints error", e);
      setPoints([]);
      setOrder("");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadSites = useCallback(async () => {
    try {
      setLoading(true);
      const res = await rondasqrApi.listSites();
      const items = asItems(res);
      setSites(items);

      if (!items.length) {
        setSiteId("");
        setRoundId("");
        setRounds([]);
        setPoints([]);
        return;
      }

      setSiteId((prev) => {
        const exists = items.some((s) => toId(s) === prev);
        return exists ? prev : toId(items[0]);
      });
    } catch (e) {
      console.error("[PointsTab] listSites error", e);
      setSites([]);
      setSiteId("");
      setRoundId("");
      setRounds([]);
      setPoints([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadRounds = useCallback(async (sid) => {
    const safeSiteId = toId(sid);

    if (!safeSiteId) {
      setRounds([]);
      setRoundId("");
      setPoints([]);
      return;
    }

    try {
      setLoading(true);
      const res = await rondasqrApi.listRounds(safeSiteId);
      const items = asItems(res);
      setRounds(items);

      if (!items.length) {
        setRoundId("");
        setPoints([]);
        setOrder("");
        return;
      }

      setRoundId((prev) => {
        const exists = items.some((r) => toId(r) === prev);
        return exists ? prev : toId(items[0]);
      });
    } catch (e) {
      console.error("[PointsTab] listRounds error", e);
      setRounds([]);
      setRoundId("");
      setPoints([]);
      setOrder("");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSites();
  }, [loadSites]);

  useEffect(() => {
    loadRounds(siteId);
  }, [siteId, loadRounds]);

  useEffect(() => {
    loadPoints(siteId, roundId);
  }, [siteId, roundId, loadPoints]);

  async function handleAddPoint() {
    const safeSiteId = toId(siteId);
    const safeRoundId = toId(roundId);
    const safeName = String(name || "").trim();
    const safeQr = String(qr || "").trim();

    if (!safeSiteId || !safeRoundId || !safeName) {
      alert("Completa sitio, ronda y nombre del punto.");
      return;
    }

    const payload = {
      siteId: safeSiteId,
      roundId: safeRoundId,
      name: safeName,
    };

    if (safeQr) payload.qr = safeQr;

    const parsedOrder = Number(order);
    if (order !== "" && Number.isFinite(parsedOrder) && parsedOrder >= 0) {
      payload.order = Math.floor(parsedOrder);
    }

    try {
      setLoading(true);
      await rondasqrApi.createPoint(payload);

      setName("");
      setQr("");
      await loadPoints(safeSiteId, safeRoundId);
    } catch (e) {
      console.error("[PointsTab] createPoint error", e);
      alert(e?.payload?.message || e?.message || "No se pudo crear el punto");
    } finally {
      setLoading(false);
    }
  }

  async function handleDeletePoint(p) {
    const id = toId(p);
    if (!id) return;

    if (!window.confirm(`¿Eliminar el punto "${p.name}"?`)) return;

    try {
      setLoading(true);
      await rondasqrApi.deletePoint(id);
      await loadPoints(siteId, roundId);
    } catch (e) {
      console.error("[PointsTab] deletePoint error", e);
      alert(e?.payload?.message || e?.message || "No se pudo eliminar el punto");
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteQr(p) {
    const id = toId(p);
    const qrValue = pointQrValue(p);

    if (!id) {
      alert("No se encontró el identificador del punto.");
      return;
    }

    if (!qrValue) {
      alert("Este punto no tiene QR para eliminar.");
      return;
    }

    if (!window.confirm(`¿Eliminar solo el QR del punto "${p.name}"?`)) return;

    try {
      setLoading(true);
      await rondasqrApi.deletePointQr(id);
      await loadPoints(siteId, roundId);

      if (repoOpen) {
        const res = await rondasqrApi.listQrRepo({ siteId, roundId });
        setRepoItems(asItems(res));
      }
    } catch (e) {
      console.error("[PointsTab] deletePointQr error", e);
      alert(e?.payload?.message || e?.message || "No se pudo eliminar el QR");
    } finally {
      setLoading(false);
    }
  }

  async function handleRotateQr(p) {
    const id = toId(p);
    if (!id) return;

    try {
      setLoading(true);
      await rondasqrApi.rotatePointQr(id);
      await loadPoints(siteId, roundId);

      if (repoOpen) {
        const res = await rondasqrApi.listQrRepo({ siteId, roundId });
        setRepoItems(asItems(res));
      }
    } catch (e) {
      console.error("[PointsTab] rotatePointQr error", e);
      alert(e?.payload?.message || e?.message || "No se pudo rotar el QR");
    } finally {
      setLoading(false);
    }
  }

  async function openRepo() {
    if (!siteId || !roundId) {
      alert("Selecciona sitio y ronda.");
      return;
    }

    try {
      setLoading(true);

      if (typeof rondasqrApi.listQrRepo === "function") {
        const res = await rondasqrApi.listQrRepo({ siteId, roundId });
        setRepoItems(asItems(res));
        setRepoOpen(true);
        return;
      }

      setRepoItems(points.filter((p) => !!pointQrValue(p)));
      setRepoOpen(true);
    } catch (e) {
      console.error("[PointsTab] listQrRepo error", e);
      alert(e?.payload?.message || e?.message || "No se pudo cargar el repositorio de QRs");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-3 items-end">
        <div className="w-full sm:w-1/4">
          <label className="block text-xs text-white/60 mb-1">Sitio</label>
          <Select
            value={siteId}
            onChange={(v) => {
              setSiteId(v);
              setRoundId("");
              setPoints([]);
              setOrder("");
            }}
          >
            {sites.length === 0 && <option value="">Sin ciudades</option>}
            {sites.map((s) => (
              <option key={toId(s)} value={toId(s)}>
                {s.name}
              </option>
            ))}
          </Select>
        </div>

        <div className="w-full sm:w-1/4">
          <label className="block text-xs text-white/60 mb-1">Ronda</label>
          <Select value={roundId} onChange={setRoundId} disabled={!siteId}>
            {rounds.length === 0 && <option value="">Sin rondas</option>}
            {rounds.map((r) => (
              <option key={toId(r)} value={toId(r)}>
                {r.name}
              </option>
            ))}
          </Select>
        </div>

        <div className="w-full sm:flex-1">
          <label className="block text-xs text-white/60 mb-1">Nombre punto</label>
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
            min="0"
            value={order}
            onChange={(e) => setOrder(e.target.value)}
            className="w-full px-3 py-2 rounded-lg bg-black/40 border border-white/10 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-400"
            placeholder="auto"
          />
        </div>

        <button
          type="button"
          onClick={handleAddPoint}
          disabled={!siteId || !roundId || !name.trim() || loading}
          className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-sm font-semibold text-black shadow disabled:opacity-60 disabled:cursor-not-allowed"
        >
          Agregar
        </button>

        <button
          type="button"
          onClick={openRepo}
          disabled={!siteId || !roundId}
          className="ml-auto px-4 py-2 rounded-lg bg-sky-500 hover:bg-sky-400 text-sm font-semibold text-black shadow disabled:opacity-60 disabled:cursor-not-allowed"
        >
          Repositorio de códigos QR
        </button>
      </div>

      <div className="text-xs text-white/60">
        <span className="font-semibold">Sitio:</span> {selectedSite?.name || "—"} ·{" "}
        <span className="font-semibold">Ronda:</span> {selectedRound?.name || "—"} ·{" "}
        <span className="font-semibold">Puntos:</span> {points.length}
      </div>

      <div className="rounded-xl bg-black/40 border border-white/10 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2 border-b border-white/10">
          <div className="font-semibold text-white">Puntos</div>
          {loading && <div className="text-xs text-white/70 animate-pulse">Cargando…</div>}
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
                  <td colSpan={4} className="px-4 py-4 text-center text-white/50 text-sm">
                    No hay puntos configurados para esta ronda.
                  </td>
                </tr>
              )}

              {points.map((p) => {
                const id = toId(p);
                const qrValue = pointQrValue(p);
                const qrUrl =
                  qrValue && typeof rondasqrApi.pointQrPngUrl === "function"
                    ? rondasqrApi.pointQrPngUrl(id)
                    : null;

                return (
                  <tr key={id} className="border-t border-white/5 hover:bg-white/5">
                    <td className="px-3 py-2 align-top">{p.order ?? "—"}</td>

                    <td className="px-3 py-2 align-top">
                      <div className="font-medium">{p.name}</div>
                      {p.notes && <div className="text-xs text-white/60">{p.notes}</div>}
                    </td>

                    <td className="px-3 py-2 align-top">
                      {qrValue ? (
                        <div className="flex items-center gap-3">
                          {qrUrl && (
                            <img
                              src={qrUrl}
                              alt={p.name}
                              className="w-16 h-16 object-contain bg-white rounded"
                            />
                          )}
                          <div className="text-xs break-all max-w-[220px]">{qrValue}</div>
                        </div>
                      ) : (
                        <span className="text-xs text-white/50">Sin QR</span>
                      )}
                    </td>

                    <td className="px-3 py-2 align-top">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => handleRotateQr(p)}
                          className="px-2 py-1 rounded-md bg-amber-400 hover:bg-amber-300 text-xs font-semibold text-black"
                        >
                          Rotar QR
                        </button>

                        {qrValue && typeof rondasqrApi.pointQrPdfUrl === "function" && (
                          <a
                            href={rondasqrApi.pointQrPdfUrl(id)}
                            target="_blank"
                            rel="noreferrer"
                            className="px-2 py-1 rounded-md bg-sky-400 hover:bg-sky-300 text-xs font-semibold text-black"
                          >
                            PDF
                          </a>
                        )}

                        {qrValue && (
                          <button
                            type="button"
                            onClick={() => handleDeleteQr(p)}
                            className="px-2 py-1 rounded-md bg-rose-600 hover:bg-rose-500 text-xs font-semibold text-white"
                          >
                            Eliminar QR
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => handleDeletePoint(p)}
                          className="px-2 py-1 rounded-md bg-rose-500 hover:bg-rose-400 text-xs font-semibold text-white"
                        >
                          Eliminar punto
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

      {repoOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70">
          <div className="bg-zinc-900 rounded-2xl border border-white/10 max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
              <div className="font-semibold text-white">Repositorio de códigos QR</div>
              <button
                type="button"
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
                  const id = toId(item);
                  const qrValue = pointQrValue(item);
                  const qrUrl =
                    qrValue && typeof rondasqrApi.pointQrPngUrl === "function"
                      ? rondasqrApi.pointQrPngUrl(id)
                      : null;

                  return (
                    <div
                      key={id}
                      className="rounded-xl bg-black/40 border border-white/10 p-3 flex flex-col items-center gap-2"
                    >
                      <div className="text-xs text-white/70 text-center">
                        <div className="font-semibold">
                          {item.siteName || selectedSite?.name || "—"} – {item.roundName || selectedRound?.name || "—"}
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
                        <span className="text-xs text-white/50">Sin QR</span>
                      )}

                      {qrValue && (
                        <div className="text-[10px] text-white/60 break-all text-center">
                          {qrValue}
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