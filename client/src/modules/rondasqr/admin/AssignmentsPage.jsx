// client/src/modules/rondasqr/admin/AssignmentsPage.jsx
import React, { useEffect, useState, useCallback } from "react";
import { rondasqrApi as api } from "../api/rondasqrApi.js";
import iamApi from "../../../iam/api/iamApi.js";

function today() {
  return new Date().toISOString().slice(0, 10);
}

function normalizeUsersResponse(res) {
  if (Array.isArray(res)) return res;
  if (Array.isArray(res?.items)) return res.items;
  if (Array.isArray(res?.users)) return res.users;
  if (Array.isArray(res?.data)) return res.data;
  return [];
}

function normalizeGuardUser(u) {
  return {
    _id: u?._id ? String(u._id) : u?.id ? String(u.id) : "",
    name: String(u?.name || u?.fullName || u?.nombre || "").trim(),
    email: String(u?.email || "").trim(),
    active: u?.active !== false,
  };
}

export default function AssignmentsPage() {
  const [date, setDate] = useState(today());
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  const [sites, setSites] = useState([]);
  const [siteId, setSiteId] = useState("");
  const [rounds, setRounds] = useState([]);
  const [roundId, setRoundId] = useState("");

  // Guardias: deben venir ya resueltos por backend
  const [guards, setGuards] = useState([]);
  const [guardId, setGuardId] = useState("");

  // Horarios
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");

  function isHHMM(str) {
    return /^([01]\d|2[0-3]):[0-5]\d$/.test(str);
  }

  const loadSites = useCallback(async () => {
    try {
      const d = await api.listSites();
      setSites(d?.items || []);
    } catch (e) {
      console.error("[Assignments] listSites error:", e?.message || e);
      setSites([]);
    }
  }, []);

  const loadRounds = useCallback(async (nextSiteId) => {
    if (!nextSiteId) {
      setRounds([]);
      setRoundId("");
      return;
    }

    try {
      const d = await api.listRounds(nextSiteId);
      setRounds(d?.items || []);
    } catch (e) {
      console.error("[Assignments] listRounds error:", e?.message || e);
      setRounds([]);
    }
  }, []);

  const loadGuards = useCallback(async () => {
    try {
      let users = [];

      // ✅ fuente oficial: backend/IAM decide quién es guardia
      if (typeof iamApi.listGuards === "function") {
        const r = await iamApi.listGuards();
        users = normalizeUsersResponse(r);
      } else {
        // fallback sin inferir roles en frontend
        const r = await iamApi.listUsers({ q: "", onlyActive: 1, limit: 2000, skip: 0 });
        users = normalizeUsersResponse(r);
      }

      const normalized = (users || [])
        .map(normalizeGuardUser)
        .filter((u) => !!u._id)
        .filter((u) => u.active);

      setGuards(normalized);
    } catch (e) {
      console.error("[Assignments] loadGuards error:", e?.message || e);
      setGuards([]);
    }
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const d = await api.listAssignments(date);
      setItems(d?.items || []);
    } catch (e) {
      console.error("[Assignments] listAssignments error:", e?.message || e);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => {
    loadSites();
  }, [loadSites]);

  useEffect(() => {
    loadRounds(siteId);
  }, [siteId, loadRounds]);

  useEffect(() => {
    loadGuards();
  }, [loadGuards]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function onCreate() {
    if (!date || !roundId || !guardId) {
      alert("Completa fecha, ronda y guardia.");
      return;
    }

    if (startTime && !isHHMM(startTime)) {
      alert("Hora de inicio inválida (usa HH:mm)");
      return;
    }

    if (endTime && !isHHMM(endTime)) {
      alert("Hora de fin inválida (usa HH:mm)");
      return;
    }

    try {
      await api.createAssignment({
        date,
        roundId,
        guardId,
        startTime: startTime || "",
        endTime: endTime || "",
      });

      setRoundId("");
      setGuardId("");
      setStartTime("");
      setEndTime("");

      await refresh();
    } catch (e) {
      console.error("[Assignments] createAssignment error:", e?.message || e);
      const msg =
        e?.payload?.message ||
        e?.payload?.error ||
        e?.message ||
        "No se pudo crear la asignación";
      alert(msg);
    }
  }

  async function onDelete(id) {
    try {
      await api.deleteAssignment(id);
    } catch (e) {
      console.error("[Assignments] deleteAssignment error:", e?.message || e);
      alert(e?.payload?.message || e?.message || "No se pudo eliminar la asignación.");
    } finally {
      await refresh();
    }
  }

  function renderGuardCell(a) {
    const guardRawId =
      typeof a?.guardId === "string"
        ? a.guardId
        : a?.guardId?._id
        ? String(a.guardId._id)
        : "";

    const g = guards.find((x) => x._id === guardRawId);

    if (g) {
      return `${g.name || "(Sin nombre)"}${g.email ? ` — ${g.email}` : ""}`;
    }

    if (a?.guardName || a?.guardEmail) {
      return `${a.guardName || "(Sin nombre)"}${a.guardEmail ? ` — ${a.guardEmail}` : ""}`;
    }

    return guardRawId || "—";
  }

  const controlClass =
    "w-full px-3 py-1.5 rounded-md border bg-white text-slate-900 border-slate-200 " +
    "dark:bg-[#1f2937] dark:text-white dark:border-[#374151] focus:outline-none focus:ring-2 focus:ring-cyan-500/70";

  return (
    <div className="p-4">
      <h1 className="text-2xl font-semibold mb-4">Asignaciones de Rondas</h1>

      <div className="grid gap-3 md:grid-cols-12">
        <div className="md:col-span-2">
          <label className="text-sm mb-1 block">Fecha</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className={controlClass}
          />
        </div>

        <div className="md:col-span-2">
          <label className="text-sm mb-1 block">Sitio</label>
          <select
            value={siteId}
            onChange={(e) => setSiteId(e.target.value)}
            className={controlClass}
          >
            <option value="">-- Selecciona --</option>
            {sites.map((s) => (
              <option key={s._id} value={s._id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

        <div className="md:col-span-2">
          <label className="text-sm mb-1 block">Ronda</label>
          <select
            value={roundId}
            onChange={(e) => setRoundId(e.target.value)}
            disabled={!siteId}
            className={controlClass + " disabled:opacity-50"}
          >
            <option value="">-- Selecciona --</option>
            {rounds.map((r) => (
              <option key={r._id} value={r._id}>
                {r.name}
              </option>
            ))}
          </select>
        </div>

        <div className="md:col-span-2">
          <label className="text-sm mb-1 block">Guardia</label>
          <select
            value={guardId}
            onChange={(e) => setGuardId(e.target.value)}
            className={controlClass}
          >
            <option value="">-- Selecciona --</option>
            {guards.map((g) => (
              <option key={g._id} value={g._id}>
                {g.name || "(Sin nombre)"} {g.email ? `— ${g.email}` : ""}
              </option>
            ))}
          </select>
        </div>

        <div className="md:col-span-2">
          <label className="text-sm mb-1 block">Inicio</label>
          <input
            type="time"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            className={controlClass}
          />
        </div>

        <div className="md:col-span-2">
          <label className="text-sm mb-1 block">Fin</label>
          <input
            type="time"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
            className={controlClass}
          />
        </div>
      </div>

      <div className="mt-6 mb-2 flex items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">Listado ({date})</h2>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onCreate}
            className="px-4 py-2 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 transition"
          >
            Crear asignación
          </button>
          <button
            type="button"
            onClick={refresh}
            className="px-4 py-2 rounded-xl bg-cyan-500 text-white hover:bg-cyan-400 transition"
          >
            Actualizar
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-slate-500 dark:text-zinc-400">Cargando…</div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-[#374151]">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-100 text-slate-700 dark:bg-[#0b1220] dark:text-zinc-300">
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
                <tr
                  key={a._id}
                  className="border-t border-slate-200 dark:border-[#374151]"
                >
                  <td className="p-3">{renderGuardCell(a)}</td>
                  <td className="p-3">{a.siteName || "-"}</td>
                  <td className="p-3">{a.roundName || a.roundId?.name || "-"}</td>
                  <td className="p-3">{a.planName || "—"}</td>
                  <td className="p-3 text-center">{a.pointsCount || 0}</td>
                  <td className="p-3">{a.startTime || "-"}</td>
                  <td className="p-3">{a.endTime || "-"}</td>
                  <td className="p-3 capitalize">{a.status || "-"}</td>
                  <td className="p-3">
                    {a.createdAt ? new Date(a.createdAt).toLocaleString() : "-"}
                  </td>
                  <td className="p-3">
                    <button
                      type="button"
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
                  <td
                    colSpan={10}
                    className="p-4 text-slate-500 dark:text-zinc-400 text-center"
                  >
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