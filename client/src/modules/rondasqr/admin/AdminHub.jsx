import React, { useEffect, useState } from "react";
import { rondasqrApi as api } from "../api/rondasqrApi.js";
import AssignmentsPage from "./AssignmentsPage.jsx";

/* ---------- UI helpers (clases) ---------- */
const card =
  "rounded-2xl p-4 sm:p-5 bg-white shadow border border-slate-200 " +
  "dark:bg-white/5 dark:border-white/10 dark:shadow-none dark:backdrop-blur";
const inputBase =
  "w-full h-11 px-3 rounded-xl border bg-white text-slate-900 " +
  "placeholder-slate-400 border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-300 " +
  "dark:bg-black/30 dark:text-white dark:placeholder-white/50 dark:border-white/10 dark:focus:ring-cyan-400";
const selectBase = inputBase;
const btn =
  "inline-flex items-center justify-center h-11 px-4 rounded-xl font-semibold text-white " +
  "bg-gradient-to-r from-emerald-500 to-cyan-500 hover:brightness-105 active:brightness-95 " +
  "disabled:opacity-60 disabled:cursor-not-allowed";
const btnDanger =
  "inline-flex items-center justify-center h-9 px-3 rounded-lg text-white bg-rose-600 hover:bg-rose-500";
const btnSmall =
  "inline-flex items-center justify-center h-9 px-3 rounded-lg font-semibold text-white " +
  "bg-blue-600 hover:bg-blue-500";

export default function AdminHub({ initialTab = "sites" }) {
  const [tab, setTab] = useState(initialTab);

  // Si el prop cambia desde un padre, sincroniza el estado local
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
    <div className="space-y-4 p-4 sm:p-6">
      {/* Tabs */}
      <div className="flex flex-wrap gap-2">
        {tabs.map((t) => (
          <button
            key={t.k}
            onClick={() => setTab(t.k)}
            className={
              "px-3 py-2 rounded-xl text-sm font-semibold border " +
              (tab === t.k
                ? "bg-blue-600 text-white border-blue-600"
                : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50 dark:bg-white/5 dark:border-white/10 dark:text-white")
            }
          >
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

/* ---------- Wrapper de sección ---------- */
function Section({ title, children }) {
  return (
    <div className={card + " space-y-4"}>
      <h3 className="text-xl font-semibold">{title}</h3>
      {children}
    </div>
  );
}

/* ---------- Tabla scrollable ---------- */
function Table({ cols, children }) {
  return (
    <div className="overflow-auto">
      <table className="min-w-[720px] text-sm">
        <thead className="text-slate-600 dark:text-white/80">
          <tr className="border-b border-slate-200 dark:border-white/10">
            {cols.map((c) => (
              <th key={c} className="text-left py-2 px-3">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

/* -------------------- Sites -------------------- */
function SitesTab() {
  const [rows, setRows] = useState([]);
  const [name, setName] = useState("");

  async function load() {
    const res = await api.listSites();
    setRows(res?.items || []);
  }
  useEffect(() => {
    load();
  }, []);

  async function add() {
    if (!name.trim()) return;
    await api.createSite({ name });
    setName("");
    load();
  }
  async function del(id) {
    await api.deleteSite(id);
    load();
  }

  return (
    <Section title="Sitios">
      <div className="grid gap-3 grid-cols-1 sm:grid-cols-[1fr,auto] items-end">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nuevo sitio"
          className={inputBase}
        />
        <button onClick={add} className={btn + " shrink-0"}>
          Agregar
        </button>
      </div>

      <Table cols={["Nombre", "Acciones"]}>
        {rows.map((r) => (
          <tr
            key={r._id}
            className="border-b border-slate-200 dark:border-white/10"
          >
            <td className="px-3 py-2">{r.name}</td>
            <td className="px-3 py-2">
              <button onClick={() => del(r._id)} className={btnDanger}>
                Eliminar
              </button>
            </td>
          </tr>
        ))}
      </Table>
    </Section>
  );
}

/* -------------------- Rounds -------------------- */
function RoundsTab() {
  const [sites, setSites] = useState([]);
  const [rows, setRows] = useState([]);
  const [siteId, setSiteId] = useState("");
  const [name, setName] = useState("");

  async function loadSites() {
    const s = await api.listSites();
    setSites(s?.items || []);
  }
  async function loadRounds() {
    if (!siteId) return setRows([]);
    const r = await api.listRounds(siteId);
    setRows(r?.items || []);
  }
  useEffect(() => {
    loadSites();
  }, []);
  useEffect(() => {
    loadRounds();
  }, [siteId]);

  async function add() {
    if (!name.trim() || !siteId) return;
    await api.createRound({ siteId, name });
    setName("");
    loadRounds();
  }
  async function del(id) {
    await api.deleteRound(id);
    loadRounds();
  }

  return (
    <Section title="Rondas">
      {/* Barra responsiva */}
      <div className="grid gap-3 items-end grid-cols-1 sm:grid-cols-2 lg:grid-cols-[1fr,1fr,auto]">
        <div className="min-w-0">
          <select
            value={siteId}
            onChange={(e) => setSiteId(e.target.value)}
            className={selectBase}
          >
            <option value="">-- Sitio --</option>
            {sites.map((s) => (
              <option key={s._id} value={s._id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

        <div className="min-w-0">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nueva ronda"
            className={inputBase}
          />
        </div>

        <div className="flex sm:justify-end">
          <button onClick={add} className={btn + " shrink-0"}>
            Agregar
          </button>
        </div>
      </div>

      <Table cols={["Ronda", "Acciones"]}>
        {rows.map((r) => (
          <tr
            key={r._id}
            className="border-b border-slate-200 dark:border-white/10"
          >
            <td className="px-3 py-2">{r.name}</td>
            <td className="px-3 py-2">
              <button onClick={() => del(r._id)} className={btnDanger}>
                Eliminar
              </button>
            </td>
          </tr>
        ))}
      </Table>
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
  const [qr, setQr] = useState("");
  const [order, setOrder] = useState(0);

  useEffect(() => {
    (async () => {
      const res = await api.listSites();
      setSites(res?.items || []);
    })();
  }, []);

  useEffect(() => {
    (async () => {
      if (!siteId) {
        setRounds([]);
        setRows([]);
        return;
      }
      const r = await api.listRounds(siteId);
      setRounds(r?.items || []);
      const p = await api.listPoints({
        siteId,
        roundId: roundId || undefined,
      });
      setRows(p?.items || []);
    })();
  }, [siteId, roundId]);

  async function add() {
    if (!siteId || !roundId || !name.trim() || !qr.trim()) return;
    await api.createPoint({
      siteId,
      roundId,
      name,
      qr,
      order: Number(order) || 0,
    });
    setName("");
    setQr("");
    setOrder(0);
    const p = await api.listPoints({ siteId, roundId });
    setRows(p?.items || []);
  }
  async function del(id) {
    await api.deletePoint(id);
    const p = await api.listPoints({ siteId, roundId });
    setRows(p?.items || []);
  }

  return (
    <Section title="Puntos">
      <div className="grid gap-3 items-end grid-cols-1 sm:grid-cols-2 lg:grid-cols-5">
        <div className="min-w-0">
          <select
            value={siteId}
            onChange={(e) => setSiteId(e.target.value)}
            className={selectBase}
          >
            <option value="">-- Sitio --</option>
            {sites.map((s) => (
              <option key={s._id} value={s._id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

        <div className="min-w-0">
          <select
            value={roundId}
            onChange={(e) => setRoundId(e.target.value)}
            className={selectBase}
          >
            <option value="">-- Ronda --</option>
            {rounds.map((r) => (
              <option key={r._id} value={r._id}>
                {r.name}
              </option>
            ))}
          </select>
        </div>

        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nombre punto"
          className={inputBase}
        />
        <input
          value={qr}
          onChange={(e) => setQr(e.target.value)}
          placeholder="QR"
          className={inputBase}
        />

        <div className="flex gap-2">
          <input
            type="number"
            value={order}
            onChange={(e) => setOrder(e.target.value)}
            placeholder="Orden"
            className={inputBase + " w-28"}
          />
          <button onClick={add} className={btn + " shrink-0"}>
            Agregar
          </button>
        </div>
      </div>

      <Table cols={["Orden", "Punto", "QR", "Acciones"]}>
        {rows.map((r) => (
          <tr
            key={r._id}
            className="border-b border-slate-200 dark:border-white/10"
          >
            <td className="px-3 py-2">{r.order}</td>
            <td className="px-3 py-2">{r.name}</td>
            <td className="px-3 py-2">{r.qr}</td>
            <td className="px-3 py-2">
              <button onClick={() => del(r._id)} className={btnDanger}>
                Eliminar
              </button>
            </td>
          </tr>
        ))}
      </Table>
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

  const shifts = [
    { value: "dia", label: "Día" },
    { value: "noche", label: "Noche" },
  ];
  const [shift, setShift] = useState("noche");

  const [selected, setSelected] = useState([]);
  const [savedPlanCount, setSavedPlanCount] = useState(0);

  // 1) Cargar sitios al montar
  useEffect(() => {
    (async () => {
      const s = await api.listSites();
      setSites(s?.items || []);
    })();
  }, []);

  // 2) Cargar rondas cuando cambia el sitio
  useEffect(() => {
    (async () => {
      if (!siteId) {
        setRounds([]);
        setRoundId("");
        setPoints([]);
        setSelected([]);
        setSavedPlanCount(0);
        return;
      }
      const r = await api.listRounds(siteId);
      setRounds(r?.items || []);
    })();
  }, [siteId]);

  // 3) Cargar puntos cuando hay sitio y (opcionalmente) ronda
  useEffect(() => {
    (async () => {
      if (!siteId) {
        setPoints([]);
        return;
      }
      const p = await api.listPoints({ siteId, roundId: roundId || undefined });
      setPoints(p?.items || []);
    })();
  }, [siteId, roundId]);

  const pickPlanItem = (res) =>
    res?.item ??
    (Array.isArray(res?.items) ? res.items[0] : undefined) ??
    res?.plan ??
    null;

  // 4) Cargar plan guardado cuando cambia sitio/ronda/turno
  useEffect(() => {
    (async () => {
      if (!siteId || !roundId) {
        setSelected([]);
        setSavedPlanCount(0);
        return;
      }
      const res = await api.getPlan({ siteId, roundId, shift });
      const item = pickPlanItem(res);

      const ids = item?.pointIds?.length
        ? item.pointIds.map(String)
        : Array.isArray(item?.points)
        ? item.points.map((x) => String(x.pointId))
        : [];

      setSelected(ids);
      setSavedPlanCount(ids.length);
    })();
  }, [siteId, roundId, shift]);

  async function save() {
    if (!siteId || !roundId || !selected.length) return;
    try {
      await api.createOrUpdatePlan({
        siteId,
        roundId,
        shift,
        pointIds: selected,
      });

      const res2 = await api.getPlan({ siteId, roundId, shift });
      const item2 = pickPlanItem(res2);
      const ids2 =
        item2?.pointIds?.length
          ? item2.pointIds.map(String)
          : Array.isArray(item2?.points)
          ? item2.points.map((x) => String(x.pointId))
          : [];
      setSavedPlanCount(ids2.length);
    } catch (e) {
      console.error("Error guardando plan:", e?.status, e?.payload || e);
      alert(
        `No se pudo guardar el plan: ${
          e?.payload?.error || e?.message || "Error"
        }`
      );
    }
  }

  async function del() {
    if (!siteId || !roundId) return;
    try {
      await api.deletePlanByQuery({ siteId, roundId, shift });
      setSelected([]);
      setSavedPlanCount(0);
    } catch (e) {
      console.error("Error eliminando plan:", e?.status, e?.payload || e);
      alert(
        `No se pudo eliminar el plan: ${
          e?.payload?.error || e?.message || "Error"
        }`
      );
    }
  }

  return (
    <Section title="Planes">
      <div className="grid gap-3 items-end grid-cols-1 sm:grid-cols-2 lg:grid-cols-[1fr,1fr,1fr,auto,auto]">
        <div className="min-w-0">
          <label className="block text-sm mb-1">Sitio</label>
          <select
            value={siteId}
            onChange={(e) => setSiteId(e.target.value)}
            className={selectBase}
          >
            <option value="">-- Sitio --</option>
            {sites.map((s) => (
              <option key={s._id} value={s._id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

        <div className="min-w-0">
          <label className="block text-sm mb-1">Ronda</label>
          <select
            value={roundId}
            onChange={(e) => setRoundId(e.target.value)}
            className={selectBase}
          >
            <option value="">-- Ronda --</option>
            {rounds.map((r) => (
              <option key={r._id} value={r._id}>
                {r.name}
              </option>
            ))}
          </select>
        </div>

        <div className="min-w-0">
          <label className="block text-sm mb-1">Turno</label>
          <select
            value={shift}
            onChange={(e) => setShift(e.target.value)}
            className={selectBase}
          >
            {shifts.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex sm:justify-end gap-2">
          <button onClick={save} className={btn + " shrink-0"}>
            Guardar plan
          </button>
          <button onClick={del} className={btnDanger + " shrink-0"}>
            Eliminar plan
          </button>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-4 mt-3">
        <div>
          <h4 className="font-semibold mb-2">Puntos disponibles</h4>
          <ul className="space-y-1">
            {points.map((p) => (
              <li
                key={p._id}
                className="flex justify-between bg-white border border-slate-200 rounded-lg px-3 py-1.5
                           dark:bg-white/5 dark:border-white/10"
              >
                <span>
                  {p.order}. {p.name}
                </span>
                <button
                  className={btnSmall}
                  onClick={() =>
                    setSelected((s) => (s.includes(p._id) ? s : [...s, p._id]))
                  }
                >
                  Añadir
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h4 className="font-semibold mb-2">Plan (orden)</h4>
          <ol className="space-y-1 list-decimal list-inside">
            {selected.map((id) => {
              const p = points.find((x) => x._id === id);
              return (
                <li
                  key={id}
                  className="flex justify-between bg-white border border-slate-200 rounded-lg px-3 py-1.5
                             dark:bg-white/5 dark:border-white/10"
                >
                  <span>{p?.name || id}</span>
                  <button
                    className="h-9 px-3 rounded-lg text-white bg-rose-600 hover:bg-rose-500"
                    onClick={() =>
                      setSelected((s) => s.filter((x) => x !== id))
                    }
                  >
                    Quitar
                  </button>
                </li>
              );
            })}
          </ol>
        </div>
      </div>

      <Table cols={["Plan guardado", "Acciones"]}>
        <tr className="border-b border-slate-200 dark:border-white/10">
          <td className="px-3 py-2">{savedPlanCount} puntos</td>
          <td className="px-3 py-2">
            <span className="text-slate-500 dark:text-white/60">
              Use los botones “Guardar plan” o “Eliminar plan”.
            </span>
          </td>
        </tr>
      </Table>
    </Section>
  );
}
