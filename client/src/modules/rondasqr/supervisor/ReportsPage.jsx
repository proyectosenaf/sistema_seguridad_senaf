// client/src/modules/rondasqr/guard/ReportsPage.jsx
import React, { useEffect, useMemo, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { rondasqrApi } from "../api/rondasqrApi.js";

// ✅ Solo para mostrar nombre/email (NO para permisos)
import { useAuth } from "../../../pages/auth/AuthProvider.jsx";

function todayIso() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function isoToDateOrNull(v) {
  const s = String(v || "").trim();
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

function fmtDateTime(v) {
  if (!v) return "—";
  const d = isoToDateOrNull(v);
  if (!d) return String(v);
  return d.toLocaleString();
}

export default function ReportsPage() {
  const nav = useNavigate();

  // ✅ NO usar flags del frontend para autorizar (eso ya lo hace RouteAccess con /me)
  const { isLoading, user } = useAuth();

  const [from, setFrom] = useState(todayIso());
  const [to, setTo] = useState(todayIso());
  const [siteId, setSiteId] = useState("");
  const [guardQuery, setGuardQuery] = useState("");

  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState(null);
  const [rows, setRows] = useState([]);

  const [sites, setSites] = useState([]);

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        if (typeof rondasqrApi.listSites !== "function") return;
        const res = await rondasqrApi.listSites();
        if (!alive) return;
        setSites(res?.items || []);
      } catch (e) {
        console.error("[ReportsPage] listSites error:", e?.message || e);
        if (!alive) return;
        setSites([]);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  const canSearch = useMemo(() => {
    return !!from && !!to;
  }, [from, to]);

  const isRangeOk = useMemo(() => {
    const a = isoToDateOrNull(from);
    const b = isoToDateOrNull(to);
    if (!a || !b) return true;
    return a.getTime() <= b.getTime();
  }, [from, to]);

  const run = useCallback(async () => {
    if (!canSearch) return;
    if (!isRangeOk) {
      alert("Rango inválido: 'Desde' no puede ser mayor que 'Hasta'.");
      return;
    }

    setLoading(true);

    try {
      const payload = {
        from,
        to,
        siteId: siteId || undefined,
        guard: guardQuery?.trim() || undefined,
      };

      let sum = null;
      if (typeof rondasqrApi.reportsSummary === "function") {
        sum = await rondasqrApi.reportsSummary(payload);
      } else if (typeof rondasqrApi.summary === "function") {
        sum = await rondasqrApi.summary(payload);
      }
      setSummary(sum);

      let list = null;
      if (typeof rondasqrApi.listReports === "function") {
        list = await rondasqrApi.listReports(payload);
      } else if (typeof rondasqrApi.reports === "function") {
        list = await rondasqrApi.reports(payload);
      } else if (typeof rondasqrApi.listCheckins === "function") {
        list = await rondasqrApi.listCheckins(payload);
      }

      const items = list?.items || list || [];
      setRows(Array.isArray(items) ? items : []);
    } catch (e) {
      console.error("[ReportsPage] error:", e?.message || e);
      setSummary(null);
      setRows([]);
      alert(e?.payload?.message || e?.message || "No se pudieron cargar los reportes.");
    } finally {
      setLoading(false);
    }
  }, [canSearch, isRangeOk, from, to, siteId, guardQuery]);

  useEffect(() => {
    let alive = true;

    (async () => {
      if (!alive) return;
      await run();
    })();

    return () => {
      alive = false;
    };
  }, [run]);

  const pageClass = "space-y-6 layer-content";
  const headerClass =
    "fx-card rounded-2xl px-4 sm:px-6 py-3 flex items-center justify-between gap-4";
  const cardClass = "fx-card rounded-2xl p-4 sm:p-6";
  const headerFallback =
    "bg-white/70 border border-neutral-300/70 shadow-sm dark:bg-white/5 dark:border-white/15 dark:shadow-none dark:backdrop-blur";
  const cardFallback =
    "bg-white/70 border border-neutral-300/70 shadow-sm dark:bg-white/5 dark:border-white/15 dark:shadow-none dark:backdrop-blur";

  if (isLoading) {
    return (
      <div className={pageClass}>
        <section className={[cardClass, cardFallback].join(" ")}>
          <div className="text-sm opacity-70">Cargando sesión...</div>
        </section>
      </div>
    );
  }

  return (
    <div className={pageClass}>
      <div className={[headerClass, headerFallback].join(" ")}>
        <div>
          <h2 className="text-xl sm:text-2xl font-bold">Informes de Rondas</h2>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-white/70 mt-0.5">
            Usuario: {user?.name || user?.email || "—"}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => nav("/rondasqr")}
            className="px-4 py-2 rounded-xl font-semibold bg-black/5 hover:bg-black/10 dark:bg-white/10 dark:hover:bg-white/15"
            type="button"
          >
            Volver a rondas
          </button>
        </div>
      </div>

      <section className={[cardClass, cardFallback].join(" ")}>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          <div className="md:col-span-1">
            <label className="text-xs opacity-70">Desde</label>
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="mt-1 w-full rounded-xl px-3 py-2 bg-white/70 dark:bg-white/5 border border-black/10 dark:border-white/10"
            />
          </div>

          <div className="md:col-span-1">
            <label className="text-xs opacity-70">Hasta</label>
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="mt-1 w-full rounded-xl px-3 py-2 bg-white/70 dark:bg-white/5 border border-black/10 dark:border-white/10"
            />
          </div>

          <div className="md:col-span-1">
            <label className="text-xs opacity-70">Sitio</label>
            <select
              value={siteId}
              onChange={(e) => setSiteId(e.target.value)}
              className="mt-1 w-full rounded-xl px-3 py-2 bg-white/70 dark:bg-white/5 border border-black/10 dark:border-white/10"
            >
              <option value="">Todos</option>
              {sites.map((s) => (
                <option key={s._id || s.id} value={s._id || s.id}>
                  {s.name || s.nombre || s.code || "Sitio"}
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-2">
            <label className="text-xs opacity-70">Guardia (nombre o email)</label>
            <input
              value={guardQuery}
              onChange={(e) => setGuardQuery(e.target.value)}
              placeholder="ej: jose / guardia@..."
              className="mt-1 w-full rounded-xl px-3 py-2 bg-white/70 dark:bg-white/5 border border-black/10 dark:border-white/10"
            />
          </div>
        </div>

        {!isRangeOk && (
          <div className="mt-3 text-sm text-rose-600 dark:text-rose-300">
            Rango inválido: <b>Desde</b> no puede ser mayor que <b>Hasta</b>.
          </div>
        )}

        <div className="mt-4 flex items-center justify-end gap-2">
          <button
            disabled={loading || !canSearch || !isRangeOk}
            onClick={run}
            className={[
              "px-4 py-2 rounded-xl font-bold text-white",
              "bg-gradient-to-r from-indigo-500 to-cyan-500",
              loading || !canSearch || !isRangeOk
                ? "opacity-70 cursor-not-allowed"
                : "hover:brightness-105",
            ].join(" ")}
            type="button"
          >
            {loading ? "Cargando..." : "Buscar"}
          </button>
        </div>
      </section>

      <section className={[cardClass, cardFallback].join(" ")}>
        <h3 className="font-semibold text-lg mb-3">Resumen</h3>
        {!summary ? (
          <div className="text-sm opacity-70">Sin resumen (tu API no devolvió summary).</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <Kpi title="Rondas" value={summary?.rounds ?? summary?.rondas ?? "—"} />
            <Kpi title="Check-ins" value={summary?.checkins ?? "—"} />
            <Kpi title="Alertas" value={summary?.alerts ?? summary?.alertas ?? "—"} />
            <Kpi title="Incidentes" value={summary?.incidents ?? summary?.incidentes ?? "—"} />
          </div>
        )}
      </section>

      <section className={[cardClass, cardFallback].join(" ")}>
        <div className="flex items-center justify-between gap-3 mb-3">
          <h3 className="font-semibold text-lg">Detalle</h3>
          <div className="text-xs opacity-70">{rows?.length ? `${rows.length} registros` : ""}</div>
        </div>

        {!rows?.length ? (
          <div className="text-sm opacity-70">No hay datos para el filtro actual.</div>
        ) : (
          <div className="overflow-auto">
            <table className="min-w-full text-sm">
              <thead className="text-left opacity-80">
                <tr>
                  <th className="py-2 pr-4 whitespace-nowrap">Fecha</th>
                  <th className="py-2 pr-4 whitespace-nowrap">Guardia</th>
                  <th className="py-2 pr-4 whitespace-nowrap">Punto</th>
                  <th className="py-2 pr-4 whitespace-nowrap">Sitio</th>
                  <th className="py-2 pr-4 whitespace-nowrap">Estado</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, idx) => (
                  <tr
                    key={r._id || r.id || idx}
                    className="border-t border-black/10 dark:border-white/10"
                  >
                    <td className="py-2 pr-4 whitespace-nowrap">
                      {fmtDateTime(r.at || r.date || r.createdAt)}
                    </td>
                    <td className="py-2 pr-4">
                      {r.guardName || r.guard?.name || r.guardEmail || r.guard?.email || "—"}
                    </td>
                    <td className="py-2 pr-4">{r.pointName || r.point || r.qr || "—"}</td>
                    <td className="py-2 pr-4">{r.siteName || r.site?.name || r.site || "—"}</td>
                    <td className="py-2 pr-4">{r.status || r.state || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function Kpi({ title, value }) {
  return (
    <div className="rounded-2xl p-4 bg-black/5 dark:bg-white/10">
      <div className="text-xs opacity-70">{title}</div>
      <div className="text-2xl font-extrabold mt-1">{String(value)}</div>
    </div>
  );
}