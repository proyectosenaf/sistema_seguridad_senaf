// client/src/modules/rondasqr/admin/AssignmentsPage.jsx
import React, { useEffect, useState, useCallback, useMemo } from "react";
import { rondasqrApi as api } from "../api/rondasqrApi.js";
import iamApi from "../../../iam/api/iamApi.js";

function today() {
  return new Date().toISOString().slice(0, 10);
}

function asArray(v) {
  if (Array.isArray(v)) return v;
  if (Array.isArray(v?.items)) return v.items;
  if (Array.isArray(v?.plans)) return v.plans;
  if (Array.isArray(v?.rounds)) return v.rounds;
  if (Array.isArray(v?.users)) return v.users;
  if (Array.isArray(v?.data)) return v.data;
  return [];
}

function normalizeUsersResponse(res) {
  return asArray(res);
}

function normalizeGuardUser(u) {
  return {
    _id: u?._id ? String(u._id) : u?.id ? String(u.id) : "",
    name: String(u?.name || u?.fullName || u?.nombre || "").trim(),
    email: String(u?.email || "").trim(),
    active: u?.active !== false,
  };
}

function toId(v) {
  if (!v) return "";
  if (typeof v === "string") return v;
  if (typeof v === "object") return String(v?._id || v?.id || "");
  return "";
}

function pickPlanName(p) {
  return String(
    p?.name ||
      p?.title ||
      p?.planName ||
      p?.nombre ||
      ""
  ).trim();
}

function pickSiteIdFromPlan(p) {
  return toId(p?.siteId || p?.site || p?.site_id);
}

function pickRoundIdFromPlan(p) {
  return toId(
    p?.roundId ||
      p?.round ||
      p?.round_id ||
      p?.rondaId ||
      p?.ronda
  );
}

function pickRoundNameFromPlan(p) {
  const raw = p?.round || p?.roundId || p?.ronda;
  if (typeof raw === "string") return "";
  return String(
    p?.roundName ||
      raw?.name ||
      raw?.title ||
      raw?.nombre ||
      ""
  ).trim();
}

function pickPointsCountFromPlan(p) {
  if (Number.isFinite(Number(p?.pointsCount))) return Number(p.pointsCount);
  if (Array.isArray(p?.points)) return p.points.length;
  if (Array.isArray(p?.pointIds)) return p.pointIds.length;
  if (Array.isArray(p?.stops)) return p.stops.length;
  return 0;
}

function normalizePlan(plan) {
  return {
    _id: toId(plan?._id || plan?.id),
    name: pickPlanName(plan),
    siteId: pickSiteIdFromPlan(plan),
    roundId: pickRoundIdFromPlan(plan),
    roundName: pickRoundNameFromPlan(plan),
    pointsCount: pickPointsCountFromPlan(plan),
    raw: plan,
  };
}

async function tryListPlans(siteId) {
  const attempts = [
    async () => {
      if (typeof api.listPlansBySite === "function") return await api.listPlansBySite(siteId);
      return null;
    },
    async () => {
      if (typeof api.listPlans === "function") return await api.listPlans(siteId);
      return null;
    },
    async () => {
      if (typeof api.listPlans === "function") return await api.listPlans({ siteId });
      return null;
    },
    async () => {
      if (typeof api.getPlans === "function") return await api.getPlans(siteId);
      return null;
    },
    async () => {
      if (typeof api.getPlans === "function") return await api.getPlans({ siteId });
      return null;
    },
  ];

  for (const run of attempts) {
    try {
      const res = await run();
      if (res) return res;
    } catch (_) {
      // seguimos probando variantes sin romper
    }
  }

  throw new Error("No existe un método compatible para listar planes.");
}

export default function AssignmentsPage() {
  const [date, setDate] = useState(today());
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  const [sites, setSites] = useState([]);
  const [siteId, setSiteId] = useState("");

  const [plans, setPlans] = useState([]);
  const [planId, setPlanId] = useState("");

  const [guards, setGuards] = useState([]);
  const [guardId, setGuardId] = useState("");

  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");

  function isHHMM(str) {
    return /^([01]\d|2[0-3]):[0-5]\d$/.test(str);
  }

  const selectedPlan = useMemo(
    () => plans.find((p) => String(p._id) === String(planId)) || null,
    [plans, planId]
  );

  const loadSites = useCallback(async () => {
    try {
      const d = await api.listSites();
      setSites(asArray(d));
    } catch (e) {
      console.error("[Assignments] listSites error:", e?.message || e);
      setSites([]);
    }
  }, []);

  const loadPlans = useCallback(async (nextSiteId) => {
    if (!nextSiteId) {
      setPlans([]);
      setPlanId("");
      return;
    }

    try {
      const d = await tryListPlans(nextSiteId);
      const normalized = asArray(d)
        .map(normalizePlan)
        .filter((p) => !!p._id)
        .filter((p) => !nextSiteId || String(p.siteId) === String(nextSiteId) || !p.siteId);

      setPlans(normalized);
      setPlanId("");
    } catch (e) {
      console.error("[Assignments] listPlans error:", e?.message || e);
      setPlans([]);
      setPlanId("");
    }
  }, []);

  const loadGuards = useCallback(async () => {
    try {
      let users = [];

      if (typeof iamApi.listGuards === "function") {
        const r = await iamApi.listGuards();
        users = normalizeUsersResponse(r);
      } else {
        const r = await iamApi.listUsers({
          q: "",
          onlyActive: 1,
          limit: 2000,
          skip: 0,
        });
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
      setItems(asArray(d));
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
    loadPlans(siteId);
  }, [siteId, loadPlans]);

  useEffect(() => {
    loadGuards();
  }, [loadGuards]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function onCreate() {
    if (!date || !siteId || !planId || !guardId) {
      alert("Completa fecha, sitio, plan y guardia.");
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

    const fallbackRoundId = selectedPlan?.roundId || "";

    const payload = {
      date,
      siteId,
      planId,
      guardId,
      startTime: startTime || "",
      endTime: endTime || "",
      // compatibilidad hacia atrás por si backend aún usa ronda
      roundId: fallbackRoundId || "",
    };

    try {
      await api.createAssignment(payload);

      setPlanId("");
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

  function renderRoundCell(a) {
    return (
      a?.roundName ||
      a?.roundId?.name ||
      a?.plan?.roundName ||
      a?.planId?.roundName ||
      "-"
    );
  }

  function renderPlanCell(a) {
    return (
      a?.planName ||
      a?.planId?.name ||
      a?.plan?.name ||
      "—"
    );
  }

  function renderPointsCell(a) {
    if (Number.isFinite(Number(a?.pointsCount))) return Number(a.pointsCount);
    if (Number.isFinite(Number(a?.planPointsCount))) return Number(a.planPointsCount);
    if (Array.isArray(a?.points)) return a.points.length;
    if (Array.isArray(a?.pointIds)) return a.pointIds.length;
    return 0;
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
          <label className="text-sm mb-1 block">Plan</label>
          <select
            value={planId}
            onChange={(e) => setPlanId(e.target.value)}
            disabled={!siteId}
            className={controlClass + " disabled:opacity-50"}
          >
            <option value="">-- Selecciona --</option>
            {plans.map((p) => (
              <option key={p._id} value={p._id}>
                {p.name}
                {p.roundName ? ` — ${p.roundName}` : ""}
                {Number.isFinite(Number(p.pointsCount)) ? ` (${p.pointsCount} pts)` : ""}
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

      {selectedPlan && (
        <div className="mt-3 text-sm text-slate-600 dark:text-zinc-300">
          <span className="font-medium">Plan seleccionado:</span> {selectedPlan.name}
          {selectedPlan.roundName ? (
            <>
              {" "}
              <span className="opacity-70">|</span> <span className="font-medium">Ronda:</span>{" "}
              {selectedPlan.roundName}
            </>
          ) : null}
          {" "}
          <span className="opacity-70">|</span> <span className="font-medium">Puntos:</span>{" "}
          {selectedPlan.pointsCount || 0}
        </div>
      )}

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
                  <td className="p-3">{a.siteName || a.siteId?.name || "-"}</td>
                  <td className="p-3">{renderRoundCell(a)}</td>
                  <td className="p-3">{renderPlanCell(a)}</td>
                  <td className="p-3 text-center">{renderPointsCell(a)}</td>
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