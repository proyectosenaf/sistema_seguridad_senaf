// client/src/modules/rondasqr/admin/QrRepoPage.jsx
import React, { useEffect, useState, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
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
  "bg-rose-600 text-white hover:bg-rose-500 disabled:opacity-60 disabled:cursor-not-allowed";

function pointIdOf(p) {
  return p?.id || p?._id || null;
}

function qrValueOf(p) {
  return String(p?.qr || p?.qrNo || p?.code || "").trim();
}

/**
 * QrRepoPage
 * Página de repositorio de códigos QR por sitio / ronda.
 */
export default function QrRepoPage() {
  const navigate = useNavigate();

  const [sites, setSites] = useState([]);
  const [rounds, setRounds] = useState([]);
  const [siteId, setSiteId] = useState("");
  const [roundId, setRoundId] = useState("");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingSites, setLoadingSites] = useState(false);
  const [loadingRounds, setLoadingRounds] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const canPrint = useMemo(() => items.length > 0, [items.length]);

  const loadRepo = useCallback(async () => {
    setLoading(true);
    setErrorMsg("");

    try {
      const res = await api.listQrRepo({
        siteId: siteId || undefined,
        roundId: roundId || undefined,
      });

      const nextItems = Array.isArray(res?.items) ? res.items : [];
      setItems(nextItems);
    } catch (e) {
      console.error("[QrRepoPage] listQrRepo error", e);
      setItems([]);
      setErrorMsg("No se pudo cargar el repositorio de QRs.");
    } finally {
      setLoading(false);
    }
  }, [siteId, roundId]);

  /* cargar sitios al montar */
  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        setLoadingSites(true);
        setErrorMsg("");

        const res = await api.listSites();
        if (!mounted) return;

        setSites(Array.isArray(res?.items) ? res.items : []);
      } catch (e) {
        console.error("[QrRepoPage] listSites error", e);
        if (!mounted) return;
        setSites([]);
        setErrorMsg("No se pudieron cargar los sitios.");
      } finally {
        if (mounted) setLoadingSites(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  /* cargar rondas cuando cambia siteId */
  useEffect(() => {
    let mounted = true;

    (async () => {
      if (!siteId) {
        setRounds([]);
        setRoundId("");
        return;
      }

      try {
        setLoadingRounds(true);
        setErrorMsg("");

        const res = await api.listRounds(siteId);
        if (!mounted) return;

        const nextRounds = Array.isArray(res?.items) ? res.items : [];
        setRounds(nextRounds);

        const exists = nextRounds.some(
          (r) => String(r?._id || r?.id || "") === String(roundId || "")
        );

        if (!exists) setRoundId("");
      } catch (e) {
        console.error("[QrRepoPage] listRounds error", e);
        if (!mounted) return;

        setRounds([]);
        setRoundId("");
        setErrorMsg("No se pudieron cargar las rondas.");
      } finally {
        if (mounted) setLoadingRounds(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [siteId, roundId]);

  /* cargar repositorio cuando cambia sitio/ronda */
  useEffect(() => {
    loadRepo();
  }, [loadRepo]);

  function openPng(p) {
    const pointId = pointIdOf(p);
    if (!pointId) return;

    const url = api.pointQrPngUrl(pointId);
    if (url) window.open(url, "_blank", "noreferrer");
  }

  function openPdf(p) {
    const pointId = pointIdOf(p);
    if (!pointId) return;

    const url = api.pointQrPdfUrl(pointId);
    if (url) window.open(url, "_blank", "noreferrer");
  }

  function printRepo() {
    const url = api.qrRepoUrl({
      siteId: siteId || undefined,
      roundId: roundId || undefined,
    });

    if (url) window.open(url, "_blank", "noreferrer");
  }

  async function rotate(p) {
    const pointId = pointIdOf(p);
    if (!pointId) {
      alert("No se encontró el identificador del punto.");
      return;
    }

    if (!window.confirm(`¿Rotar el código QR del punto "${p?.name || "—"}"?`)) {
      return;
    }

    try {
      setErrorMsg("");
      await api.rotatePointQr(pointId);
      await loadRepo();
    } catch (e) {
      console.error("[QrRepoPage] rotatePointQr error", e);
      alert(
        e?.payload?.message ||
          e?.message ||
          "No se pudo rotar el QR de este punto."
      );
    }
  }

  async function removeQr(p) {
    const pointId = pointIdOf(p);
    const qrValue = qrValueOf(p);

    if (!pointId) {
      alert("No se encontró el identificador del punto.");
      return;
    }

    if (!qrValue) {
      alert("Este punto no tiene código QR para eliminar.");
      return;
    }

    const ok = window.confirm(
      `¿Eliminar el código QR del punto "${p?.name || "—"}"?\n\nEsta acción quitará el QR actual del punto.`
    );
    if (!ok) return;

    try {
      setErrorMsg("");
      await api.deletePointQr(pointId);
      await loadRepo();
    } catch (e) {
      console.error("[QrRepoPage] deletePointQr error", e);
      alert(
        e?.payload?.message ||
          e?.message ||
          "No se pudo eliminar el código QR de este punto."
      );
    }
  }

  function goBack() {
    navigate("/rondasqr/admin");
  }

  return (
    <div className="p-4 sm:p-6 space-y-4">
      {/* Encabezado */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
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
            Consulta, visualiza e imprime los códigos QR de los puntos de ronda.
          </p>
        </div>

        <div className="flex gap-2 flex-wrap">
          <button
            type="button"
            onClick={loadRepo}
            className={btnGhost}
            disabled={loading}
          >
            {loading ? "Actualizando..." : "Actualizar"}
          </button>

          <button
            type="button"
            onClick={printRepo}
            className={btn}
            disabled={!canPrint}
          >
            Imprimir repositorio
          </button>
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
              disabled={loadingSites}
            >
              <option value="">Todos los sitios</option>
              {sites.map((s) => (
                <option key={s._id || s.id} value={s._id || s.id}>
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
              disabled={!siteId || loadingRounds}
            >
              <option value="">Todas las rondas</option>
              {rounds.map((r) => (
                <option key={r._id || r.id} value={r._id || r.id}>
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
          <table className="min-w-[1200px] text-sm">
            <thead className="border-b border-slate-200 dark:border-white/10 text-slate-600 dark:text-white/80">
              <tr>
                <th className="text-left px-3 py-2">Vista</th>
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
              {items.map((p) => {
                const pointId = pointIdOf(p);
                const qrValue = qrValueOf(p);
                const pngUrl = pointId ? api.pointQrPngUrl(pointId) : "";

                return (
                  <tr
                    key={pointId || qrValue || p.name}
                    className="border-b border-slate-200/80 dark:border-white/10"
                  >
                    <td className="px-3 py-2">
                      {pngUrl && qrValue ? (
                        <img
                          src={pngUrl}
                          alt={p?.name || "QR"}
                          className="w-16 h-16 object-contain rounded-lg border border-slate-200 bg-white p-1 dark:border-white/10"
                          loading="lazy"
                        />
                      ) : (
                        <span className="text-xs text-slate-400 dark:text-white/40">
                          Sin vista
                        </span>
                      )}
                    </td>

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

                    <td className="px-3 py-2">
                      <div className="font-medium">{p.name || "—"}</div>
                      {p.notes && (
                        <div className="text-[11px] text-slate-400 dark:text-white/50 mt-0.5">
                          {p.notes}
                        </div>
                      )}
                    </td>

                    <td className="px-3 py-2">
                      <code className="text-xs bg-slate-100 dark:bg-white/10 px-1.5 py-0.5 rounded break-all">
                        {qrValue || "—"}
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

                    <td className="px-3 py-2 text-right">
                      <div className="flex items-center justify-end gap-2 flex-wrap">
                        <button
                          type="button"
                          onClick={() => openPng(p)}
                          className={btnGhost}
                          disabled={!pointId || !qrValue}
                        >
                          PNG
                        </button>

                        <button
                          type="button"
                          onClick={() => openPdf(p)}
                          className={btnGhost}
                          disabled={!pointId || !qrValue}
                        >
                          PDF
                        </button>

                        <button
                          type="button"
                          onClick={() => rotate(p)}
                          className={btnDangerSmall}
                          disabled={!pointId}
                        >
                          Rotar QR
                        </button>

                        <button
                          type="button"
                          onClick={() => removeQr(p)}
                          className={btnDangerSmall}
                          disabled={!pointId || !qrValue}
                        >
                          Eliminar QR
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {!items.length && !loading && (
                <tr>
                  <td
                    colSpan={8}
                    className="px-3 py-6 text-center text-sm text-slate-500 dark:text-white/60"
                  >
                    No hay puntos con QR para los filtros seleccionados.
                  </td>
                </tr>
              )}

              {loading && (
                <tr>
                  <td
                    colSpan={8}
                    className="px-3 py-6 text-center text-sm text-slate-500 dark:text-white/60"
                  >
                    Cargando repositorio...
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