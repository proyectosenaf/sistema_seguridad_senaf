import React, { useEffect, useState } from "react";
import { rondasqrApi as api } from "../api/rondasqrApi.js";
// ✅ desde src/modules/rondasqr/admin → src/iam/api/iamApi.js
import iamApi from "../../../iam/api/iamApi.js";

function today() {
  return new Date().toISOString().slice(0, 10);
}

export default function AssignmentsPage() {
  const [date, setDate] = useState(today());
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  const [sites, setSites] = useState([]);
  const [siteId, setSiteId] = useState("");
  const [rounds, setRounds] = useState([]);
  const [roundId, setRoundId] = useState("");

  // Guardias (IAM)
  const [guards, setGuards] = useState([]);      // [{_id, name, email, opId, active}]
  const [guardId, setGuardId] = useState("");    // opId seleccionado

  // Horarios
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");

  /* ─────────────── Cargar Sitios ─────────────── */
  useEffect(() => {
    api.listSites().then((d) => setSites(d.items || [])).catch(console.error);
  }, []);

  /* ─────────────── Cargar Rondas ─────────────── */
  useEffect(() => {
    if (!siteId) {
      setRounds([]);
      setRoundId("");
      return;
    }
    api.listRounds(siteId).then((d) => setRounds(d.items || [])).catch(console.error);
  }, [siteId]);

  /* ─────────────── Cargar Guardias (IAM) ─────────────── */
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        let items = [];
        if (typeof iamApi.listGuards === "function") {
          // q="" y activeOnly=true para traer sólo guardias activos
          const r = await iamApi.listGuards("", true);
          items = r.items || [];
        } else {
          // Fallback: listar usuarios y normalizar a “guardias”
          const r = await iamApi.listUsers("");
          const NS = "https://senaf.local/roles";
          items = (r.items || []).filter((u) => {
            const roles = [
              ...(Array.isArray(u.roles) ? u.roles : []),
              ...(Array.isArray(u[NS]) ? u[NS] : []),
            ].map((x) => String(x).toLowerCase());
            return roles.includes("guardia") || roles.includes("guard") || roles.includes("rondasqr.guard");
          }).map((u) => ({
            _id: u._id,
            name: u.name,
            email: u.email,
            opId: u.opId || u.sub || u.legacyId || String(u._id),
            active: u.active !== false,
          }));
        }
        // Asegurar shape final
        const normalized = (items || []).map((u) => ({
          _id: u._id,
          name: u.name,
          email: u.email,
          opId: u.opId || u.sub || u.legacyId || String(u._id),
          active: u.active !== false,
        }));
        if (mounted) setGuards(normalized);
      } catch (e) {
        console.error("[Assignments] listGuards error:", e);
        if (mounted) setGuards([]);
      }
    })();
    return () => { mounted = false; };
  }, []);

  /* ─────────────── Listado del Día ─────────────── */
  async function refresh() {
    setLoading(true);
    try {
      const d = await api.listAssignments(date);
      setItems(d.items || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { refresh(); }, [date]);

  /* ─────────────── Crear Asignación ─────────────── */
  async function onCreate() {
    if (!date || !roundId || !guardId) {
      alert("Completa fecha, ronda y guardia.");
      return;
    }
    try {
      await api.createAssignment({ date, roundId, guardId, startTime, endTime });
      await refresh();
    } catch (e) {
      console.error(e);
      const msg = e?.payload?.error || e?.message || "No se pudo crear la asignación";
      alert(msg);
    }
  }

  /* ─────────────── Eliminar ─────────────── */
  async function onDelete(id) {
    try {
      await api.deleteAssignment(id);
      await refresh();
    } catch (e) {
      console.error(e);
    }
  }

  function renderGuardCell(a) {
    if (a.guardName) return a.guardName;
    if (a.guardEmail) return a.guardEmail;
    return a.guardId || "—";
  }

  return (
    <div className="p-4">
      <h1 className="text-2xl font-semibold mb-4">Asignaciones de Rondas</h1>

      {/* Filtros / Creación */}
      <div
        className="grid gap-3"
        style={{ gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))" }}
      >
        <div>
          <label className="text-sm mb-1 block">Fecha</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full px-3 py-2 rounded-md bg-[#1f2937] text-white border border-[#374151]"
          />
        </div>

        <div>
          <label className="text-sm mb-1 block">Sitio</label>
          <select
            value={siteId}
            onChange={(e) => setSiteId(e.target.value)}
            className="w-full px-3 py-2 rounded-md bg-[#1f2937] text-white border border-[#374151]"
          >
            <option value="">-- Selecciona --</option>
            {sites.map((s) => (
              <option key={s._id} value={s._id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-sm mb-1 block">Ronda</label>
          <select
            value={roundId}
            onChange={(e) => setRoundId(e.target.value)}
            disabled={!siteId}
            className="w-full px-3 py-2 rounded-md bg-[#1f2937] text-white border border-[#374151] disabled:opacity-50"
          >
            <option value="">-- Selecciona --</option>
            {rounds.map((r) => (
              <option key={r._id} value={r._id}>
                {r.name}
              </option>
            ))}
          </select>
        </div>

        {/* ⬇️ Select de guardias (IAM) */}
        <div>
          <label className="text-sm mb-1 block">Guardia</label>
          <select
            value={guardId}
            onChange={(e) => setGuardId(e.target.value)}
            className="w-full px-3 py-2 rounded-md bg-[#1f2937] text-white border border-[#374151]"
          >
            <option value="">-- Selecciona --</option>
            {guards.map((g) => (
              <option key={g._id} value={g.opId}>
                {g.name || "(Sin nombre)"}{g.email ? ` — ${g.email}` : ""}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-sm mb-1 block">Inicio</label>
          <input
            type="time"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            className="w-full px-3 py-2 rounded-md bg-[#1f2937] text-white border border-[#374151]"
          />
        </div>

        <div>
          <label className="text-sm mb-1 block">Fin</label>
          <input
            type="time"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
            className="w-full px-3 py-2 rounded-md bg-[#1f2937] text-white border border-[#374151]"
          />
        </div>
      </div>

      <div className="flex gap-2 mt-3">
        <button
          onClick={onCreate}
          className="px-4 py-2 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 transition"
        >
          Crear asignación
        </button>
        <button
          onClick={refresh}
          className="px-4 py-2 rounded-xl bg-zinc-700 text-white hover:bg-zinc-600 transition"
        >
          Actualizar
        </button>
      </div>

      {/* Tabla de asignaciones */}
      <h2 className="text-lg font-semibold mt-6 mb-2">Listado ({date})</h2>

      {loading ? (
        <div className="text-zinc-400">Cargando…</div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[#374151]">
          <table className="min-w-full text-sm">
            <thead className="bg-[#0b1220] text-zinc-300">
              <tr>
                <th className="text-left p-3">Guardia</th>
                <th className="text-left p-3">Sitio</th>
                <th className="text-left p-3">Ronda</th>
                <th className="text-left p-3">Plan</th>
                <th className="text-left p-3">Puntos</th>
                <th className="text-left p-3">Inicio</th>
                <th className="text-left p-3">Fin</th>
                <th className="text-left p-3">Estado</th>
                <th className="text-left p-3">Creado</th>
                <th className="text-left p-3">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {(items || []).map((a) => (
                <tr key={a._id} className="border-t border-[#374151]">
                  <td className="p-3">{renderGuardCell(a)}</td>
                  <td className="p-3">{a.siteName || "-"}</td>
                  <td className="p-3">{a.roundName || a.roundId?.name || "-"}</td>
                  <td className="p-3">{a.planName || "—"}</td>
                  <td className="p-3 text-center">{a.pointsCount || 0}</td>
                  <td className="p-3">{a.startTime || "-"}</td>
                  <td className="p-3">{a.endTime || "-"}</td>
                  <td className="p-3 capitalize">{a.status}</td>
                  <td className="p-3">
                    {a.createdAt ? new Date(a.createdAt).toLocaleString() : "-"}
                  </td>
                  <td className="p-3">
                    <button
                      onClick={() => onDelete(a._id)}
                      className="px-3 py-1 rounded-lg bg-rose-600 text-white hover:bg-rose-700 transition"
                    >
                      Eliminar
                    </button>
                  </td>
                </tr>
              ))}
              {(!items || items.length === 0) && (
                <tr>
                  <td colSpan={10} className="p-4 text-zinc-400 text-center">
                    Sin asignaciones.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
