// client/src/modules/rondasqr/admin/AdminHub.jsx
import React, { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { rondasqrApi as api } from "../api/rondasqrApi.js";
import AssignmentsPage from "./AssignmentsPage.jsx";

/* ========= FX tokens ========= */

const fxCard =
  "rounded-3xl border border-neutral-200/60 dark:border-white/10 " +
  "bg-white/55 dark:bg-neutral-950/35 backdrop-blur-2xl shadow-sm";

const fxSectionWrap = "space-y-3";
const fxDivider = "border-b border-neutral-200/60 dark:border-white/10";
const fxTextMuted = "text-neutral-600 dark:text-white/70";

const fxBtnPrimary =
  "inline-flex items-center justify-center h-11 px-5 rounded-2xl text-sm font-semibold " +
  "text-white bg-neutral-900/90 hover:bg-neutral-900 " +
  "dark:bg-white/90 dark:text-neutral-900 dark:hover:bg-white transition";

const fxBtnDanger =
  "inline-flex items-center justify-center h-11 px-4 rounded-2xl text-sm font-semibold text-white " +
  "bg-rose-600 hover:bg-rose-500 transition";

const fxBtnSmall =
  "inline-flex items-center justify-center h-9 px-3 rounded-xl text-xs font-semibold text-white " +
  "bg-blue-600 hover:bg-blue-500 disabled:opacity-60 disabled:cursor-not-allowed transition";

/* Tabs estilo panel */
function tabClass(active) {
  return [
    "px-4 py-2 rounded-2xl text-sm font-semibold border transition backdrop-blur-xl",
    active
      ? "bg-neutral-900/90 text-white border-neutral-900/50 dark:bg-white/90 dark:text-neutral-900 dark:border-white/20 shadow"
      : "bg-white/55 text-neutral-800 border-neutral-200/60 hover:bg-white/70 dark:bg-neutral-950/35 dark:text-white/85 dark:border-white/10 dark:hover:bg-neutral-900/45",
  ].join(" ");
}

const rowClass =
  "border-b border-neutral-200/60 dark:border-white/10 hover:bg-white/40 dark:hover:bg-white/5 transition";

/* ---------- Wrapper de sección ---------- */
function Section({ title, subtitle, actions, children }) {
  return (
    <div className={fxSectionWrap}>
      <div className="flex items-end justify-between gap-3">
        <div>
          <h3 className="text-2xl font-extrabold tracking-tight">{title}</h3>
          {subtitle ? <p className={"text-sm mt-1 " + fxTextMuted}>{subtitle}</p> : null}
        </div>
        {actions ? <div className="shrink-0">{actions}</div> : null}
      </div>

      <div className={fxCard}>{children}</div>
    </div>
  );
}

/* ---------- Tabla scrollable ---------- */
function Table({ cols, children }) {
  return (
    <div className="overflow-auto rounded-2xl">
      <table className="min-w-[720px] text-sm w-full">
        <thead className={fxTextMuted}>
          <tr className={fxDivider}>
            {cols.map((c) => (
              <th key={c} className="text-left py-3 px-4 font-extrabold tracking-tight">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-200/40 dark:divide-white/10">{children}</tbody>
      </table>
    </div>
  );
}

/* ---------- Controles consistentes (44px) ---------- */
const ctrlWrap = "min-w-0";
const ctrlClass =
  "input-fx w-full h-11 !rounded-2xl " +
  "bg-white/65 dark:bg-white/5 " +
  "border border-neutral-200/60 dark:border-white/10 " +
  "focus:outline-none focus:ring-2 focus:ring-cyan-400/40";

const numberClass =
  ctrlClass +
  " [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none";

/* -------------------- Root Hub -------------------- */

export default function AdminHub({ initialTab = "sites" }) {
  const [tab, setTab] = useState(initialTab);

  useEffect(() => {
    setTab(initialTab);
  }, [initialTab]);

  const tabs = [
    { k: "sites", label: "Sitios" },
    { k: "rounds", label: "Rondas" },
    { k: "point", label: "Puntos" },
    { k: "plans", label: "Planes" },
    { k: "assign", label: "Asignaciones" },
  ];

  return (
    <div className="space-y-4 layer-content">
      <div className="flex flex-wrap gap-2">
        {tabs.map((t) => (
          <button key={t.k} onClick={() => setTab(t.k)} className={tabClass(tab === t.k)}>
            {t.label.toUpperCase()}
          </button>
        ))}
      </div>

      {tab === "sites" && <SitesTab />}
      {tab === "rounds" && <RoundsTab />}
      {tab === "point" && <PointsTab />}
      {tab === "plans" && <PlansTab />}
      {tab === "assign" && <AssignmentsPage />}
    </div>
  );
}

/* -------------------- Sites -------------------- */
function SitesTab() {
  const [rows, setRows] = useState([]);
  const [name, setName] = useState("");

  const load = useCallback(async () => {
    const res = await api.listSites();
    setRows(res?.items || []);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function add() {
    if (!name.trim()) return;
    await api.createSite({ name: name.trim() });
    setName("");
    load();
  }

  async function del(id) {
    await api.deleteSite(id);
    load();
  }

  return (
    <Section
      title="Sitios"
      subtitle="Crea y elimina sitios. Luego podrás crear rondas y puntos por sitio."
      actions={
        <button onClick={load} className={fxBtnPrimary}>
          Actualizar
        </button>
      }
    >
      <div className="p-5 space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className={ctrlWrap + " flex-1"}>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nuevo sitio" className={ctrlClass} />
          </div>
          <button onClick={add} className={fxBtnPrimary + " sm:w-auto w-full"}>
            Agregar
          </button>
        </div>

        <div className="rounded-2xl overflow-hidden border border-neutral-200/50 dark:border-white/10">
          <Table cols={["Nombre", "Acciones"]}>
            {rows.map((r) => (
              <tr key={r._id} className={rowClass}>
                <td className="px-4 py-3">{r.name}</td>
                <td className="px-4 py-3">
                  <button onClick={() => del(r._id)} className={fxBtnDanger}>
                    Eliminar
                  </button>
                </td>
              </tr>
            ))}

            {!rows.length && (
              <tr>
                <td className={"px-4 py-4 " + fxTextMuted} colSpan={2}>
                  No hay sitios aún.
                </td>
              </tr>
            )}
          </Table>
        </div>
      </div>
    </Section>
  );
}

/* -------------------- Rounds -------------------- */
function RoundsTab() {
  const [sites, setSites] = useState([]);
  const [rows, setRows] = useState([]);
  const [siteId, setSiteId] = useState("");
  const [name, setName] = useState("");

  const loadSites = useCallback(async () => {
    const s = await api.listSites();
    setSites(s?.items || []);
  }, []);

  const loadRounds = useCallback(async () => {
    if (!siteId) return setRows([]);
    const r = await api.listRounds(siteId);
    setRows(r?.items || []);
  }, [siteId]);

  useEffect(() => {
    loadSites();
  }, [loadSites]);

  useEffect(() => {
    loadRounds();
  }, [loadRounds]);

  async function add() {
    if (!name.trim() || !siteId) return;
    await api.createRound({ siteId, name: name.trim() });
    setName("");
    loadRounds();
  }

  async function del(id) {
    await api.deleteRound(id);
    loadRounds();
  }

  return (
    <Section
      title="Rondas"
      subtitle="Selecciona un sitio y administra sus rondas."
      actions={
        <button onClick={loadRounds} className={fxBtnPrimary} disabled={!siteId}>
          Actualizar
        </button>
      }
    >
      <div className="p-5 space-y-4">
        <div className={ctrlWrap}>
          <select value={siteId} onChange={(e) => setSiteId(e.target.value)} className={ctrlClass}>
            <option value="">-- Sitio --</option>
            {sites.map((s) => (
              <option key={s._id} value={s._id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className={ctrlWrap + " flex-1"}>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nueva ronda" className={ctrlClass} />
          </div>
          <button onClick={add} className={fxBtnPrimary + " sm:w-auto w-full"} disabled={!siteId}>
            Agregar
          </button>
        </div>

        <div className="rounded-2xl overflow-hidden border border-neutral-200/50 dark:border-white/10">
          <Table cols={["Ronda", "Acciones"]}>
            {rows.map((r) => (
              <tr key={r._id} className={rowClass}>
                <td className="px-4 py-3">{r.name}</td>
                <td className="px-4 py-3">
                  <button onClick={() => del(r._id)} className={fxBtnDanger}>
                    Eliminar
                  </button>
                </td>
              </tr>
            ))}

            {!siteId && (
              <tr>
                <td className={"px-4 py-4 " + fxTextMuted} colSpan={2}>
                  Seleccione un sitio para ver las rondas.
                </td>
              </tr>
            )}
            {siteId && !rows.length && (
              <tr>
                <td className={"px-4 py-4 " + fxTextMuted} colSpan={2}>
                  No hay rondas aún para este sitio.
                </td>
              </tr>
            )}
          </Table>
        </div>
      </div>
    </Section>
  );
}

/* -------------------- Points -------------------- */
function PointsTab() {
  const [sites, setSites] = useState([]);
  const [rounds, setRounds] = useState([]);
  const [rows, setRows] = useState([]);

  const [siteId, setSiteId] = useState("");
  const [roundId, setRoundId] = useState("");
  const [name, setName] = useState("");
  const [order, setOrder] = useState(0);

  const reqSeq = useRef(0);

  const loadSites = useCallback(async () => {
    const res = await api.listSites();
    setSites(res?.items || []);
  }, []);

  useEffect(() => {
    loadSites();
  }, [loadSites]);

  const reloadRounds = useCallback(async (sid) => {
    const nextSiteId = sid ?? siteId;
    if (!nextSiteId) {
      setRounds([]);
      return;
    }
    const r = await api.listRounds(nextSiteId);
    setRounds(r?.items || []);
  }, [siteId]);

  const reloadPoints = useCallback(
    async (sid, rid) => {
      const nextSiteId = sid ?? siteId;
      const nextRoundId = rid ?? roundId;

      if (!nextSiteId) {
        setRows([]);
        return;
      }

      const mySeq = ++reqSeq.current;

      try {
        const p = await api.listPoints({
          siteId: nextSiteId,
          roundId: nextRoundId || undefined,
        });

        if (mySeq === reqSeq.current) setRows(p?.items || []);
      } catch (e) {
        console.error("[PointsTab] listPoints error:", e?.message || e);
        if (mySeq === reqSeq.current) setRows([]);
      }
    },
    [siteId, roundId]
  );

  useEffect(() => {
    (async () => {
      if (!siteId) {
        setRounds([]);
        setRows([]);
        setRoundId("");
        return;
      }
      setRoundId("");
      await reloadRounds(siteId);
      await reloadPoints(siteId, "");
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteId]);

  useEffect(() => {
    if (!siteId) return;
    reloadPoints(siteId, roundId);
  }, [siteId, roundId, reloadPoints]);

  async function add() {
    if (!siteId || !roundId || !name.trim()) return;
    try {
      await api.createPoint({
        siteId,
        roundId,
        name: name.trim(),
        order: Number(order) || 0,
      });
      setName("");
      setOrder(0);
      reloadPoints(siteId, roundId);
    } catch (e) {
      console.error("[PointsTab] createPoint error:", e?.message || e);
      alert(e?.payload?.message || "No se pudo crear el punto (HTTP 400).");
    }
  }

  async function del(id) {
    await api.deletePoint(id);
    reloadPoints(siteId, roundId);
  }

  async function rotateQr(id) {
    if (!window.confirm("¿Rotar el código QR de este punto?")) return;
    try {
      if (typeof api.rotatePointQr === "function") await api.rotatePointQr(id);
      else await api.updatePoint(id, { qr: undefined });
      await reloadPoints(siteId, roundId);
    } catch (e) {
      console.error("Error al rotar QR", e);
      alert("No se pudo rotar el QR de este punto.");
    }
  }

  function openQrRepo() {
    if (!siteId || !roundId) return alert("Seleccione un sitio y una ronda para ver el repositorio de QRs.");
    if (typeof api.qrRepoUrl !== "function") return alert("Falta implementar qrRepoUrl en rondasqrApi.");
    const url = api.qrRepoUrl({ siteId, roundId });
    if (url) window.open(url, "_blank", "noopener");
  }

  function pointQrPngUrl(id) {
    if (typeof api.pointQrPngUrl === "function") return api.pointQrPngUrl(id);
    return null;
  }

  return (
    <Section
      title="Puntos"
      subtitle="Selecciona sitio y ronda. Agrega puntos con orden y rota su QR cuando sea necesario."
      actions={
        <div className="flex gap-2">
          <button onClick={() => reloadPoints(siteId, roundId)} className={fxBtnPrimary} disabled={!siteId}>
            Actualizar
          </button>
          <button onClick={openQrRepo} className={fxBtnPrimary} disabled={!siteId || !roundId}>
            Repositorio de QRs
          </button>
        </div>
      }
    >
      <div className="p-5 space-y-4">
        <div className="grid gap-3 items-end grid-cols-1 md:grid-cols-2 xl:grid-cols-5">
          <div className={ctrlWrap}>
            <label className={"block text-xs mb-1 " + fxTextMuted}>Sitio</label>
            <select value={siteId} onChange={(e) => setSiteId(e.target.value)} className={ctrlClass}>
              <option value="">-- Sitio --</option>
              {sites.map((s) => (
                <option key={s._id} value={s._id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          <div className={ctrlWrap}>
            <label className={"block text-xs mb-1 " + fxTextMuted}>Ronda</label>
            <select value={roundId} onChange={(e) => setRoundId(e.target.value)} className={ctrlClass} disabled={!siteId}>
              <option value="">-- Ronda --</option>
              {rounds.map((r) => (
                <option key={r._id} value={r._id}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>

          <div className={ctrlWrap + " xl:col-span-2"}>
            <label className={"block text-xs mb-1 " + fxTextMuted}>Nombre del punto</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre punto" className={ctrlClass} disabled={!siteId || !roundId} />
          </div>

          <div className="flex gap-2 items-end">
            <div className="w-28">
              <label className={"block text-xs mb-1 " + fxTextMuted}>Orden</label>
              <input type="number" value={order} onChange={(e) => setOrder(e.target.value)} placeholder="0" className={numberClass} disabled={!siteId || !roundId} />
            </div>

            <button onClick={add} className={fxBtnPrimary + " shrink-0"} disabled={!siteId || !roundId || !name.trim()} title={!siteId || !roundId ? "Seleccione sitio y ronda" : "Agregar punto"}>
              Agregar
            </button>
          </div>
        </div>

        <div className="rounded-2xl overflow-hidden border border-neutral-200/50 dark:border-white/10">
          <Table cols={["Orden", "Punto", "QR", "Acciones"]}>
            {rows.map((r) => {
              const qrUrl = pointQrPngUrl(r._id);
              return (
                <tr key={r._id} className={rowClass}>
                  <td className="px-4 py-3 w-20">{r.order}</td>
                  <td className="px-4 py-3">{r.name}</td>

                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <code className="text-xs px-2 py-1 rounded-xl bg-white/40 dark:bg-white/10">{r.qr || "—"}</code>

                      {qrUrl && r.qr && (
                        <a
                          href={qrUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs px-3 py-2 h-9 inline-flex items-center rounded-xl
                                     bg-neutral-900/85 text-white hover:bg-neutral-900
                                     dark:bg-white/90 dark:text-neutral-900 dark:hover:bg-white"
                        >
                          Etiqueta
                        </a>
                      )}
                    </div>
                  </td>

                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2 justify-end">
                      <button onClick={() => rotateQr(r._id)} className={fxBtnSmall}>
                        Rotar QR
                      </button>
                      <button onClick={() => del(r._id)} className={fxBtnDanger}>
                        Eliminar
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}

            {!siteId && (
              <tr>
                <td className={"px-4 py-4 " + fxTextMuted} colSpan={4}>
                  Seleccione un sitio y una ronda para ver los puntos.
                </td>
              </tr>
            )}
            {siteId && !rows.length && (
              <tr>
                <td className={"px-4 py-4 " + fxTextMuted} colSpan={4}>
                  No hay puntos para los filtros seleccionados.
                </td>
              </tr>
            )}
          </Table>
        </div>
      </div>
    </Section>
  );
}

/* -------------------- Plans -------------------- */
function PlansTab() {
  const [sites, setSites] = useState([]);
  const [rounds, setRounds] = useState([]);
  const [points, setPoints] = useState([]);

  const [siteId, setSiteId] = useState("");
  const [roundId, setRoundId] = useState("");

  const shiftOptions = useMemo(
    () => [
      { value: "dia", label: "Diurno" },
      { value: "noche", label: "Nocturno" },
    ],
    []
  );
  const [shift, setShift] = useState("dia");

  const [planIds, setPlanIds] = useState([]);
  const [savedCount, setSavedCount] = useState(0);

  useEffect(() => {
    (async () => {
      const s = await api.listSites();
      setSites(s?.items || []);
    })();
  }, []);

  useEffect(() => {
    (async () => {
      if (!siteId) {
        setRounds([]);
        setRoundId("");
        setPoints([]);
        setPlanIds([]);
        setSavedCount(0);
        return;
      }
      const r = await api.listRounds(siteId);
      setRounds(r?.items || []);
    })();
  }, [siteId]);

  useEffect(() => {
    (async () => {
      if (!siteId) {
        setPoints([]);
        return;
      }
      try {
        const p = await api.listPoints({ siteId, roundId: roundId || undefined });
        setPoints(p?.items || []);
      } catch (e) {
        console.error("[PlansTab] listPoints error:", e?.message || e);
        setPoints([]);
      }
    })();
  }, [siteId, roundId]);

  const pickPlanItem = (res) =>
    res?.item ?? (Array.isArray(res?.items) ? res.items[0] : undefined) ?? null;

  useEffect(() => {
    (async () => {
      if (!siteId || !roundId) {
        setPlanIds([]);
        setSavedCount(0);
        return;
      }
      const res = await api.getPlan({ siteId, roundId, shift });
      const item = pickPlanItem(res);
      const ids = item?.pointIds?.length
        ? item.pointIds.map(String)
        : Array.isArray(item?.points)
        ? item.points.map((x) => String(x.pointId))
        : [];
      setPlanIds(ids);
      setSavedCount(ids.length);
    })();
  }, [siteId, roundId, shift]);

  function addPointToPlan(pointId) {
    setPlanIds((prev) => (prev.includes(pointId) ? prev : [...prev, pointId]));
  }
  function removePointFromPlan(pointId) {
    setPlanIds((prev) => prev.filter((id) => id !== pointId));
  }
  function moveUp(idx) {
    setPlanIds((prev) => {
      if (idx <= 0) return prev;
      const arr = [...prev];
      [arr[idx - 1], arr[idx]] = [arr[idx], arr[idx - 1]];
      return arr;
    });
  }
  function moveDown(idx) {
    setPlanIds((prev) => {
      if (idx >= prev.length - 1) return prev;
      const arr = [...prev];
      [arr[idx + 1], arr[idx]] = [arr[idx], arr[idx + 1]];
      return arr;
    });
  }

  async function savePlan() {
    if (!siteId || !roundId) return alert("Seleccione sitio y ronda.");
    if (!planIds.length) return alert("El plan no tiene puntos.");

    try {
      await api.createOrUpdatePlan({ siteId, roundId, shift, pointIds: planIds });
      setSavedCount(planIds.length);
      alert("Plan guardado.");
    } catch (e) {
      console.error("Error guardando plan", e);
      alert("No se pudo guardar el plan.");
    }
  }

  async function deletePlan() {
    if (!siteId || !roundId) return;
    try {
      await api.deletePlanByQuery({ siteId, roundId, shift });
      setPlanIds([]);
      setSavedCount(0);
      alert("Plan eliminado.");
    } catch (e) {
      console.error("Error eliminando plan", e);
      alert("No se pudo eliminar el plan.");
    }
  }

  return (
    <Section
      title="Planes"
      subtitle="Define el orden de puntos por sitio, ronda y turno."
      actions={
        <div className="flex gap-2">
          <button onClick={savePlan} className={fxBtnPrimary} disabled={!siteId || !roundId || !planIds.length}>
            Guardar plan
          </button>
          <button onClick={deletePlan} className={fxBtnDanger} disabled={!siteId || !roundId}>
            Eliminar plan
          </button>
        </div>
      }
    >
      <div className="p-5 space-y-4">
        <div className="grid gap-3 grid-cols-1 md:grid-cols-3">
          <div>
            <label className={"block text-xs mb-1 " + fxTextMuted}>Sitio</label>
            <select value={siteId} onChange={(e) => setSiteId(e.target.value)} className={ctrlClass}>
              <option value="">-- Sitio --</option>
              {sites.map((s) => (
                <option key={s._id} value={s._id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={"block text-xs mb-1 " + fxTextMuted}>Ronda</label>
            <select value={roundId} onChange={(e) => setRoundId(e.target.value)} className={ctrlClass} disabled={!siteId}>
              <option value="">-- Ronda --</option>
              {rounds.map((r) => (
                <option key={r._id} value={r._id}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={"block text-xs mb-1 " + fxTextMuted}>Turno</label>
            <select value={shift} onChange={(e) => setShift(e.target.value)} className={ctrlClass} disabled={!siteId || !roundId}>
              {shiftOptions.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="rounded-2xl overflow-hidden border border-neutral-200/50 dark:border-white/10">
            <div className={"px-4 py-3 " + fxDivider + " flex items-center justify-between"}>
              <h4 className="font-extrabold tracking-tight">Puntos disponibles</h4>
              <span className={"text-xs " + fxTextMuted}>{points.length} puntos</span>
            </div>

            <div className="max-h-[360px] overflow-auto">
              <table className="w-full text-sm">
                <tbody>
                  {points.map((p) => (
                    <tr key={p._id} className={rowClass}>
                      <td className="px-4 py-3 w-14 text-xs opacity-60">{typeof p.order === "number" ? p.order : "-"}</td>
                      <td className="px-4 py-3">{p.name}</td>
                      <td className="px-4 py-3 text-right">
                        <button onClick={() => addPointToPlan(p._id)} className={fxBtnSmall} disabled={planIds.includes(p._id)}>
                          Añadir
                        </button>
                      </td>
                    </tr>
                  ))}

                  {!points.length && (
                    <tr>
                      <td className={"px-4 py-4 text-sm " + fxTextMuted} colSpan={3}>
                        Seleccione un sitio y una ronda para ver los puntos.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-2xl overflow-hidden border border-neutral-200/50 dark:border-white/10">
            <div className={"px-4 py-3 " + fxDivider + " flex items-center justify-between"}>
              <h4 className="font-extrabold tracking-tight">Plan actual (orden)</h4>
              <span className={"text-xs " + fxTextMuted}>{planIds.length} en el orden</span>
            </div>

            <div className="max-h-[360px] overflow-auto">
              <table className="w-full text-sm">
                <tbody>
                  {planIds.map((id, idx) => {
                    const p = points.find((x) => x._id === id);
                    return (
                      <tr key={id} className={rowClass}>
                        <td className="px-4 py-3 w-14 text-xs opacity-60">{idx + 1}</td>
                        <td className="px-4 py-3">{p?.name || id}</td>
                        <td className="px-4 py-3 w-24 text-right space-x-1">
                          <button onClick={() => moveUp(idx)} className="inline-flex items-center justify-center w-8 h-8 rounded-xl bg-white/40 hover:bg-white/55 dark:bg-white/10 dark:hover:bg-white/15" title="Subir">
                            ↑
                          </button>
                          <button onClick={() => moveDown(idx)} className="inline-flex items-center justify-center w-8 h-8 rounded-xl bg-white/40 hover:bg-white/55 dark:bg-white/10 dark:hover:bg-white/15" title="Bajar">
                            ↓
                          </button>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button onClick={() => removePointFromPlan(id)} className="h-9 px-4 rounded-2xl text-sm font-semibold text-white bg-rose-600 hover:bg-rose-500">
                            Quitar
                          </button>
                        </td>
                      </tr>
                    );
                  })}

                  {!planIds.length && (
                    <tr>
                      <td className={"px-4 py-4 text-sm " + fxTextMuted} colSpan={4}>
                        No hay puntos en este plan. Añada desde la columna izquierda.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-neutral-200/50 dark:border-white/10 bg-white/45 dark:bg-white/5 px-4 py-3 text-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <span>
            Plan guardado: <strong>{savedCount}</strong> puntos.
          </span>
          <span className={"text-xs " + fxTextMuted}>
            Use “Guardar plan” para aplicar cambios / “Eliminar plan” para dejarlo vacío.
          </span>
        </div>
      </div>
    </Section>
  );
}