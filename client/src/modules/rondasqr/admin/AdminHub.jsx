// client/src/modules/rondasqr/admin/AdminHub.jsx
import React, { useEffect, useState } from "react";
import { rondasqrApi as api } from "../api/rondasqrApi";

export default function AdminHub() {
  const [tab, setTab] = useState("sites");

  return (
    <div className="space-y-4 p-4">
      <div className="flex gap-2">
        {["sites", "rounds", "point", "plans"].map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3 py-1.5 rounded ${tab === t ? "bg-blue-600 text-white" : "bg-white/10"}`}
          >
            {t.toUpperCase()}
          </button>
        ))}
      </div>

      {tab === "sites" && <SitesTab />}
      {tab === "rounds" && <RoundsTab />}
      {tab === "point" && <PointsTab />}
      {tab === "plans" && <PlansTab />}
    </div>
  );
}

/* -------------------- Sites -------------------- */
function SitesTab() {
  const [rows, setRows] = useState([]);
  const [name, setName] = useState("");

  async function load() {
    const res = await api.listSites();
    setRows(res?.items || []); // ✅ corregido
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
    <Section title="Sites">
      <div className="flex gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nuevo sitio"
          className="px-3 py-2 rounded bg-black/30 border border-white/10"
        />
        <button onClick={add} className="px-3 py-2 rounded bg-green-600 text-white">
          Agregar
        </button>
      </div>

      <Table cols={["Nombre", "Acciones"]}>
        {rows.map((r) => (
          <tr key={r._id} className="border-b border-white/10">
            <td className="px-3 py-2">{r.name}</td>
            <td className="px-3 py-2">
              <button onClick={() => del(r._id)} className="px-2 py-1 rounded bg-red-600/80">
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
    setSites(s?.items || []); // ✅ corregido
  }

  async function loadRounds() {
    if (!siteId) {
      setRows([]);
      return;
    }
    const r = await api.listRounds(siteId);
    setRows(r?.items || []); // ✅ corregido
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
    <Section title="Rounds">
      <div className="flex gap-2 items-center">
        <select
          value={siteId}
          onChange={(e) => setSiteId(e.target.value)}
          className="px-3 py-2 rounded bg-black/30 border border-white/10"
        >
          <option value="">-- Sitio --</option>
          {sites.map((s) => (
            <option key={s._id} value={s._id}>
              {s.name}
            </option>
          ))}
        </select>

        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nueva ronda"
          className="px-3 py-2 rounded bg-black/30 border border-white/10"
        />
        <button onClick={add} className="px-3 py-2 rounded bg-green-600 text-white">
          Agregar
        </button>
      </div>

      <Table cols={["Ronda", "Acciones"]}>
        {rows.map((r) => (
          <tr key={r._id} className="border-b border-white/10">
            <td className="px-3 py-2">{r.name}</td>
            <td className="px-3 py-2">
              <button onClick={() => del(r._id)} className="px-2 py-1 rounded bg-red-600/80">
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
      setSites(res?.items || []); // ✅ corregido
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
      setRounds(r?.items || []); // ✅ corregido
      const p = await api.listPoints({ siteId, roundId: roundId || undefined });
      setRows(p?.items || []); // ✅ corregido
    })();
  }, [siteId, roundId]);

  async function add() {
    if (!siteId || !roundId || !name.trim() || !qr.trim()) return;
    await api.createPoint({ siteId, roundId, name, qr, order: Number(order) || 0 });
    setName("");
    setQr("");
    setOrder(0);
    const p = await api.listPoints({ siteId, roundId });
    setRows(p?.items || []); // ✅ corregido
  }

  async function del(id) {
    await api.deletePoint(id);
    const p = await api.listPoints({ siteId, roundId });
    setRows(p?.items || []); // ✅ corregido
  }

  return (
    <Section title="Points">
      <div className="grid sm:grid-cols-5 gap-2 items-center">
        <select
          value={siteId}
          onChange={(e) => setSiteId(e.target.value)}
          className="px-3 py-2 rounded bg-black/30 border border-white/10"
        >
          <option value="">-- Sitio --</option>
          {sites.map((s) => (
            <option key={s._id} value={s._id}>
              {s.name}
            </option>
          ))}
        </select>

        <select
          value={roundId}
          onChange={(e) => setRoundId(e.target.value)}
          className="px-3 py-2 rounded bg-black/30 border border-white/10"
        >
          <option value="">-- Ronda --</option>
          {rounds.map((r) => (
            <option key={r._id} value={r._id}>
              {r.name}
            </option>
          ))}
        </select>

        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nombre punto"
          className="px-3 py-2 rounded bg-black/30 border border-white/10"
        />
        <input
          value={qr}
          onChange={(e) => setQr(e.target.value)}
          placeholder="QR"
          className="px-3 py-2 rounded bg-black/30 border border-white/10"
        />

        <div className="flex gap-2">
          <input
            type="number"
            value={order}
            onChange={(e) => setOrder(e.target.value)}
            placeholder="Orden"
            className="px-3 py-2 rounded bg-black/30 border border-white/10 w-24"
          />
          <button onClick={add} className="px-3 py-2 rounded bg-green-600 text-white">
            Agregar
          </button>
        </div>
      </div>

      <Table cols={["Orden", "Punto", "QR", "Acciones"]}>
        {rows.map((r) => (
          <tr key={r._id} className="border-b border-white/10">
            <td className="px-3 py-2">{r.order}</td>
            <td className="px-3 py-2">{r.name}</td>
            <td className="px-3 py-2">{r.qr}</td>
            <td className="px-3 py-2">
              <button onClick={() => del(r._id)} className="px-2 py-1 rounded bg-red-600/80">
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
  const [rows, setRows] = useState([]);
  const [siteId, setSiteId] = useState("");
  const [roundId, setRoundId] = useState("");
  const [selected, setSelected] = useState([]); // array de pointId (en orden)

  useEffect(() => {
    (async () => {
      const s = await api.listSites();
      setSites(s?.items || []); // ✅ corregido
    })();
  }, []);

  useEffect(() => {
    (async () => {
      if (!siteId) {
        setRounds([]);
        setPoints([]);
        setRows([]);
        return;
      }
      const r = await api.listRounds(siteId);
      setRounds(r?.items || []); // ✅ corregido

      const p = await api.listPoints({ siteId, roundId: roundId || undefined });
      setPoints(p?.items || []); // ✅ corregido

      const plans = await api.listPlans({ siteId, roundId: roundId || undefined });
      setRows(plans?.items || []); // ✅ corregido
    })();
  }, [siteId, roundId]);

  async function save() {
    if (!siteId || !roundId || !selected.length) return;
    await api.createPlan({ siteId, roundId, pointIds: selected });
    const plans = await api.listPlans({ siteId, roundId });
    setRows(plans?.items || []); // ✅ corregido
  }

  async function del(id) {
    await api.deletePlan(id);
    const plans = await api.listPlans({ siteId, roundId });
    setRows(plans?.items || []); // ✅ corregido
  }

  return (
    <Section title="Plans">
      <div className="grid sm:grid-cols-3 gap-2 items-center">
        <select
          value={siteId}
          onChange={(e) => setSiteId(e.target.value)}
          className="px-3 py-2 rounded bg-black/30 border border-white/10"
        >
          <option value="">-- Sitio --</option>
          {sites.map((s) => (
            <option key={s._id} value={s._id}>
              {s.name}
            </option>
          ))}
        </select>

        <select
          value={roundId}
          onChange={(e) => setRoundId(e.target.value)}
          className="px-3 py-2 rounded bg-black/30 border border-white/10"
        >
          <option value="">-- Ronda --</option>
          {rounds.map((r) => (
            <option key={r._id} value={r._id}>
              {r.name}
            </option>
          ))}
        </select>

        <button onClick={save} className="px-3 py-2 rounded bg-green-600 text-white">
          Guardar plan
        </button>
      </div>

      <div className="grid sm:grid-cols-2 gap-3 mt-3">
        <div>
          <h4 className="font-semibold mb-2">Puntos disponibles</h4>
          <ul className="space-y-1">
            {points.map((p) => (
              <li key={p._id} className="flex justify-between bg-white/5 rounded px-3 py-1">
                <span>
                  {p.order}. {p.name}
                </span>
                <button
                  className="text-sm px-2 py-0.5 rounded bg-blue-600/80"
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
                <li key={id} className="flex justify-between bg-white/5 rounded px-3 py-1">
                  <span>{p?.name || id}</span>
                  <button
                    className="text-sm px-2 py-0.5 rounded bg-red-600/80"
                    onClick={() => setSelected((s) => s.filter((x) => x !== id))}
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
        {rows.map((r) => {
          const count =
            Array.isArray(r?.pointIds)
              ? r.pointIds.length
              : Array.isArray(r?.points)
              ? r.points.length
              : 0;
          return (
            <tr key={r._id} className="border-b border-white/10">
              <td className="px-3 py-2">{count} puntos</td>
              <td className="px-3 py-2">
                <button onClick={() => del(r._id)} className="px-2 py-1 rounded bg-red-600/80">
                  Eliminar
                </button>
              </td>
            </tr>
          );
        })}
      </Table>
    </Section>
  );
}

/* ---------- UI helpers ---------- */
function Section({ title, children }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur p-4 shadow-lg space-y-3">
      <h3 className="text-xl font-semibold">{title}</h3>
      {children}
    </div>
  );
}

function Table({ cols, children }) {
  return (
    <div className="overflow-auto">
      <table className="min-w-[720px] text-sm">
        <thead className="text-white/80">
          <tr className="border-b border-white/10">
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
