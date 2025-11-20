// client/src/modules/rondasqr/admin/QrRepoPage.jsx
import React, { useEffect, useState } from "react";
import { rondasqrApi as api } from "../api/rondasqrApi.js";

/* ----- estilos básicos reutilizados ----- */
const card =
  "rounded-2xl p-4 sm:p-5 bg-white shadow border border-slate-200 " +
  "dark:bg-white/5 dark:border-white/10 dark:shadow-none dark:backdrop-blur";

const inputBase =
  "w-full h-11 px-3 rounded-xl border bg-white text-slate-900 " +
  "placeholder-slate-400 border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-300 " +
  "dark:bg-black/30 dark:text-white dark:placeholder-white/50 dark:border-white/10 dark:focus:ring-cyan-400";

const selectBase = inputBase;

const btn =
  "inline-flex items-center justify-center h-10 px-4 rounded-xl font-semibold text-white " +
  "bg-gradient-to-r from-emerald-500 to-cyan-500 hover:brightness-105 active:brightness-95 " +
  "disabled:opacity-60 disabled:cursor-not-allowed";

const btnGhost =
  "inline-flex items-center justify-center h-9 px-3 rounded-lg text-xs font-semibold " +
  "border border-slate-300 text-slate-700 bg-white hover:bg-slate-50 " +
  "dark:border-white/20 dark:text-white dark:bg-white/5 dark:hover:bg-white/10";

const btnDangerSmall =
  "inline-flex items-center justify-center h-9 px-3 rounded-lg text-xs font-semibold " +
  "bg-rose-600 text-white hover:bg-rose-500";

/**
 * QrRepoPage
 * Página de repositorio de códigos QR por sitio / ronda.
 * Usa rondasqrApi.listQrRepo(), pointQrPngUrl(), pointQrPdfUrl(), rotatePointQr().
 */
export default function QrRepoPage() {
  const [sites, setSites] = useState([]);
  const [rounds, setRounds] = useState([]);
  const [siteId, setSiteId] = useState("");
  const [roundId, setRoundId] = useState("");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // cargar sitios al montar
  useEffect(() => {
    (async () => {
      try {
        const res = await api.listSites();
        setSites(res?.items || []);
      } catch (e) {
        console.error("[QrRepoPage] listSites error", e);
        setErrorMsg("No se pudieron cargar los sitios.");
      }
    })();
  }, []);

  // cargar rondas cuando cambia siteId
  useEffect(() => {
    (async () => {
      if (!siteId) {
        setRounds([]);
        setRoundId("");
        return;
      }
      try {
        const res = await api.listRounds(siteId);
        setRounds(res?.items || []);
      } catch (e) {
        console.error("[QrRepoPage] listRounds error", e);
        setErrorMsg("No se pudieron cargar las rondas.");
      }
    })();
  }, [siteId]);

  // cargar repositorio cuando cambia siteId o roundId
  useEffect(() => {
    loadRepo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteId, roundId]);

  async function loadRepo() {
    setLoading(true);
    setErrorMsg("");
    try {
      const res = await api.listQrRepo({
        siteId: siteId || undefined,
        roundId: roundId || undefined,
      });
      setItems(res?.items || []);
    } catch (e) {
      console.error("[QrRepoPage] listQrRepo error", e);
      setErrorMsg("No se pudo cargar el repositorio de QRs.");
    } finally {
      setLoading(false);
    }
  }

  function openPng(p) {
    const url = api.pointQrPngUrl(p.id);
    if (url) window.open(url, "_blank", "noreferrer");
  }

  function openPdf(p) {
    const url = api.pointQrPdfUrl(p.id);
    if (url) window.open(url, "_blank", "noreferrer");
  }

  async function rotate(p) {
    if (!window.confirm(`¿Rotar el código QR del punto "${p.name}"?`)) return;
    try {
      await api.rotatePointQr(p.id);
      await loadRepo();
    } catch (e) {
      console.error("[QrRepoPage] rotatePointQr error", e);
      alert("No se pudo rotar el QR de este punto.");
    }
  }

  function goBack() {
    if (window.history.length > 1) window.history.back();
  }

  return (
    <div className="p-4 sm:p-6 space-y-4">
      {/* Encabezado */}
      <div className="flex items-center justify-between gap-3">
        <div className="space-y-1">
          <button
            type="button"
            onClick={goBack}
            className="inline-flex items-center text-sm text-slate-500 hover:text-slate-800 dark:text-white/60 dark:hover:text-white"
          >
            ← Volver
          </button>
          <h1 className="text-2xl font-semibold">Repositorio de códigos QR</h1>
          <p className="text-sm text-slate-500 dark:text-white/60">
            Consulta e imprime los códigos QR de los puntos de ronda. 
          </p>
        </div>
      </div>

      {/* Filtros y contenido */}
      <div className={card + " space-y-4"}>
        {/* Filtros */}
        <div className="grid gap-3 grid-cols-1 md:grid-cols-3">
          <div>
            <label className="block text-xs font-medium mb-1">Sitio</label>
            <select
              value={siteId}
              onChange={(e) => setSiteId(e.target.value)}
              className={selectBase}
            >
              <option value="">Todos los sitios</option>
              {sites.map((s) => (
                <option key={s._id} value={s._id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Ronda</label>
            <select
              value={roundId}
              onChange={(e) => setRoundId(e.target.value)}
              className={selectBase}
              disabled={!siteId}
            >
              <option value="">Todas las rondas</option>
              {rounds.map((r) => (
                <option key={r._id} value={r._id}>
                  {r.name}
                </option>
              ))}
            </select>
            {!siteId && (
              <p className="mt-1 text-[11px] text-slate-400">
                Primero selecciona un sitio para ver sus rondas.
              </p>
            )}
          </div>

          <div className="flex items-end gap-2">
            <button
              type="button"
              onClick={loadRepo}
              className={btn + " w-full md:w-auto"}
              disabled={loading}
            >
              {loading ? "Cargando..." : "Actualizar listado"}
            </button>
          </div>
        </div>

        {/* Mensaje de error */}
        {errorMsg && (
          <div className="text-sm text-rose-600 dark:text-rose-400">
            {errorMsg}
          </div>
        )}

        {/* Tabla */}
        <div className="overflow-auto">
          <table className="min-w-[900px] text-sm">
            <thead className="border-b border-slate-200 dark:border-white/10 text-slate-600 dark:text-white/80">
              <tr>
                <th className="text-left px-3 py-2">Sitio</th>
                <th className="text-left px-3 py-2">Ronda</th>
                <th className="text-left px-3 py-2">Orden</th>
                <th className="text-left px-3 py-2">Punto</th>
                <th className="text-left px-3 py-2">Código QR</th>
                <th className="text-left px-3 py-2">Estado</th>
                <th className="text-right px-3 py-2">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {items.map((p) => (
                <tr
                  key={p.id}
                  className="border-b border-slate-200/80 dark:border-white/10"
                >
                  <td className="px-3 py-2 text-xs">
                    <div className="font-medium">{p.siteName || "—"}</div>
                    {p.siteCode && (
                      <div className="text-[11px] text-slate-400">
                        {p.siteCode}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2 text-xs">
                    <div className="font-medium">{p.roundName || "—"}</div>
                    {p.roundCode && (
                      <div className="text-[11px] text-slate-400">
                        {p.roundCode}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2 w-16 text-center">
                    {typeof p.order === "number" ? p.order : "—"}
                  </td>
                  <td className="px-3 py-2">{p.name}</td>
                  <td className="px-3 py-2">
                    <code className="text-xs bg-slate-100 dark:bg-white/10 px-1.5 py-0.5 rounded">
                      {p.qr || "—"}
                    </code>
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={
                        "inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold " +
                        (p.active
                          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200"
                          : "bg-slate-100 text-slate-500 dark:bg-white/5 dark:text-white/60")
                      }
                    >
                      {p.active ? "Activo" : "Inactivo"}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right space-x-2">
                    <button
                      type="button"
                      onClick={() => openPng(p)}
                      className={btnGhost}
                    >
                      PNG
                    </button>
                    <button
                      type="button"
                      onClick={() => openPdf(p)}
                      className={btnGhost}
                    >
                      PDF
                    </button>
                    <button
                      type="button"
                      onClick={() => rotate(p)}
                      className={btnDangerSmall}
                    >
                      Rotar QR
                    </button>
                  </td>
                </tr>
              ))}
              {!items.length && !loading && (
                <tr>
                  <td
                    colSpan={7}
                    className="px-3 py-6 text-center text-sm text-slate-500 dark:text-white/60"
                  >
                    No hay puntos con QR para los filtros seleccionados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pie */}
        <div className="text-xs text-slate-500 dark:text-white/60">
          Mostrando <strong>{items.length}</strong> puntos.
        </div>
      </div>
    </div>
  );
}
