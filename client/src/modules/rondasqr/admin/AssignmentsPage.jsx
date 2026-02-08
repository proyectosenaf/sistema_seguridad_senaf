// client/src/modules/rondasqr/admin/AssignmentsPage.jsx
import React, { useEffect, useState } from "react";
import { rondasqrApi as api } from "../api/rondasqrApi.js";
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
  const [guards, setGuards] = useState([]); // [{_id, name, email, sub, opId, active}]
  const [guardId, setGuardId] = useState(""); // ✅ aquí vamos a guardar EL SUB (auth0|...)

  // Horarios
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");

  function isHHMM(str) {
    return /^([01]\d|2[0-3]):[0-5]\d$/.test(str);
  }

  /* ─────────────── Cargar sitios ─────────────── */
  useEffect(() => {
    api
      .listSites()
      .then((d) => setSites(d?.items || []))
      .catch(console.error);
  }, []);

  /* ─────────────── Cargar rondas ─────────────── */
  useEffect(() => {
    if (!siteId) {
      setRounds([]);
      setRoundId("");
      return;
    }
    api
      .listRounds(siteId)
      .then((d) => setRounds(d?.items || []))
      .catch(console.error);
  }, [siteId]);

  /* ─────────────── Cargar guardias ─────────────── */
  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        let users = [];

        // Si tienes endpoint directo de guardias úsalo:
        if (typeof iamApi.listGuards === "function") {
          const r = await iamApi.listGuards("", true);
          users = r?.items || [];
        } else {
          const r = await iamApi.listUsers("");
          users = r?.items || [];
        }

        // Normaliza y filtra por rol guardia (si listGuards no existe)
        const NS = "https://senaf.local/roles";
        const normalized = (users || [])
          .filter((u) => {
            // si listGuards existe, probablemente ya vienen filtrados
            if (typeof iamApi.listGuards === "function") return u?.active !== false;

            const roles = [
              ...(Array.isArray(u?.roles) ? u.roles : []),
              ...(Array.isArray(u?.[NS]) ? u[NS] : []),
            ]
              .map((x) => String(x).toLowerCase().trim())
              .filter(Boolean);

            return (
              (u?.active !== false) &&
              (roles.includes("guardia") ||
                roles.includes("guard") ||
                roles.includes("rondasqr.guard"))
            );
          })
          .map((u) => {
            const sub = u?.sub ? String(u.sub) : "";
            return {
              _id: u?._id ? String(u._id) : "",
              name: u?.name || u?.fullName || "",
              email: u?.email || "",
              sub, // ✅ ESTE es el que debemos usar como guardId
              // opId: dejamos por compat, pero NO lo usaremos para asignar
              opId: sub || u?.opId || u?.legacyId || (u?._id ? String(u._id) : ""),
              active: u?.active !== false,
            };
          });

        if (mounted) setGuards(normalized);
      } catch (e) {
        console.error("[Assignments] listGuards error:", e);
        if (mounted) setGuards([]);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  /* ─────────────── Listado del día ─────────────── */
  async function refresh() {
    setLoading(true);
    try {
      const d = await api.listAssignments(date);
      setItems(d?.items || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  /* ─────────────── Crear asignación ─────────────── */
  async function onCreate() {
    if (!date || !roundId || !guardId) {
      alert("Completa fecha, ronda y guardia.");
      return;
    }
    if (startTime && !isHHMM(startTime)) return alert("Hora de inicio inválida (usa HH:mm)");
    if (endTime && !isHHMM(endTime)) return alert("Hora de fin inválida (usa HH:mm)");

    try {
      // ✅ guardId = Auth0 sub
      await api.createAssignment({
        date,
        roundId,
        guardId,
        startTime: startTime || "",
        endTime: endTime || "",
      });

      // limpiar
      setRoundId("");
      setGuardId("");
      setStartTime("");
      setEndTime("");

      await refresh();
    } catch (e) {
      console.error(e);
      const msg =
        e?.payload?.message ||
        e?.payload?.error ||
        e?.message ||
        "No se pudo crear la asignación";
      alert(msg);
    }
  }

  /* ─────────────── Eliminar ─────────────── */
  async function onDelete(id) {
    try {
      await api.deleteAssignment(id);
    } catch (e) {
      console.error(e);
    } finally {
      await refresh();
    }
  }

  /* ─────────────── Render guardia ─────────────── */
  function renderGuardCell(a) {
    // ✅ Primero intentamos match por sub
    const g =
      guards.find((x) => x.sub && x.sub === a.guardId) ||
      // fallback: match por opId (por si hay datos viejos)
      guards.find((x) => x.opId && x.opId === a.guardId) ||
      // fallback: match por _id
      guards.find((x) => x._id && x._id === a.guardId);

    return g
      ? `${g.name || "(Sin nombre)"}${g.email ? ` — ${g.email}` : ""}`
      : a.guardId || "—";
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
              // ✅ value = sub
              <option key={g._id || g.sub} value={g.sub || ""} disabled={!g.sub}>
                {g.name || "(Sin nombre)"} {g.email ? `— ${g.email}` : ""}{" "}
                {!g.sub ? "— (SIN SUB)" : ""}
              </option>
            ))}
          </select>
          <div className="text-xs opacity-60 mt-1">
            * La asignación se guarda por <b>sub</b> (Auth0). Si un usuario sale “SIN SUB”, ese usuario no podrá recibir rondas.
          </div>
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
            onClick={onCreate}
            className="px-4 py-2 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 transition"
          >
            Crear asignación
          </button>
          <button
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
