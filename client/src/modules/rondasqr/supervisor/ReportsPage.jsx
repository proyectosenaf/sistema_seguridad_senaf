// client/src/modules/rondasqr/supervisor/ReportsPage.jsx
import React, { useEffect, useMemo, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { rondasqrApi } from "../api/rondasqrApi.js";
import iamApi from "../../../iam/api/iamApi.js";
import { useAuth } from "../../../pages/auth/AuthProvider.jsx";

import ReportSummary from "./ReportSummary.jsx";
import DetailedMarks from "./DetailedMarks.jsx";
import MessagesTable from "./MessagesTable.jsx";
import OmissionsTable from "./OmissionsTable.jsx";
import MapView from "./MapView.jsx";
import Playback from "./Playback.jsx";
import LiveAlerts from "./LiveAlerts.jsx";

/* =========================
   Helpers
========================= */
function todayIso() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function addDaysIso(base, days) {
  const d = new Date(`${base}T00:00:00`);
  d.setDate(d.getDate() + days);
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

function asItems(v) {
  if (!v) return [];
  if (Array.isArray(v)) return v;
  if (Array.isArray(v.items)) return v.items;
  if (Array.isArray(v.rows)) return v.rows;
  if (Array.isArray(v.data)) return v.data;
  if (Array.isArray(v.users)) return v.users;
  return [];
}

function normalizeText(v) {
  return String(v || "").trim().toLowerCase();
}

function normalizeId(v) {
  if (!v) return "";
  if (typeof v === "string") return v.trim();
  if (typeof v === "object") return String(v._id || v.id || "").trim();
  return "";
}

function pickGuardId(r) {
  return normalizeId(r?.guardId || r?.guard || r?.officerId || r?.userId);
}

function pickGuardLabel(r) {
  return (
    r?.guardName ||
    r?.guard?.name ||
    r?.guardEmail ||
    r?.guard?.email ||
    r?.officer ||
    r?.officerName ||
    r?.officerEmail ||
    r?.userName ||
    r?.userEmail ||
    "—"
  );
}

function pickSiteLabel(r) {
  return r?.siteName || r?.site?.name || r?.site || "—";
}

function pickRoundLabel(r) {
  return r?.roundName || r?.round?.name || r?.round || "—";
}

function pickPointLabel(r) {
  return r?.pointName || r?.point?.name || r?.point || r?.qr || "—";
}

function pickStatusLabel(r) {
  return r?.status || r?.state || r?.eventType || r?.type || "—";
}

function buildStatsFromRows(rows = []) {
  if (!Array.isArray(rows) || !rows.length) return [];

  const groups = new Map();

  for (const r of rows) {
    const dayRaw = r?.date || r?.day || (r?.at ? String(r.at).slice(0, 10) : "");
    const key = [
      pickSiteLabel(r),
      pickRoundLabel(r),
      pickGuardLabel(r),
      dayRaw || "—",
    ].join("::");

    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(r);
  }

  return Array.from(groups.values()).map((arr) => {
    const sorted = [...arr].sort((a, b) => {
      const ta = new Date(a?.at || a?.date || a?.createdAt || 0).getTime();
      const tb = new Date(b?.at || b?.date || b?.createdAt || 0).getTime();
      return ta - tb;
    });

    const first = sorted[0];
    const last = sorted[sorted.length - 1];

    return {
      siteName: pickSiteLabel(first),
      roundName: pickRoundLabel(first),
      officer: pickGuardLabel(first),
      day: first?.date || first?.day || (first?.at ? String(first.at).slice(0, 10) : "—"),
      puntosRegistrados: sorted.length,
      pasos: sorted.reduce((acc, x) => acc + Number(x?.steps || 0), 0),
      primeraMarca: first?.at || first?.date || first?.createdAt || null,
      ultimaMarca: last?.at || last?.date || last?.createdAt || null,
      duracionText: buildDurationText(
        first?.at || first?.date || first?.createdAt,
        last?.at || last?.date || last?.createdAt
      ),
    };
  });
}

function buildDurationText(a, b) {
  const da = a ? new Date(a) : null;
  const db = b ? new Date(b) : null;
  if (!da || !db || Number.isNaN(da.getTime()) || Number.isNaN(db.getTime())) return "—";

  const secs = Math.max(0, Math.round((db - da) / 1000));
  const dd = Math.floor(secs / 86400);
  const hh = Math.floor((secs % 86400) / 3600);
  const mm = Math.floor((secs % 3600) / 60);
  const ss = secs % 60;

  return `Duración ${dd} días - ${String(hh).padStart(2, "0")} Horas - ${String(mm).padStart(
    2,
    "0"
  )} Minutos - ${String(ss).padStart(2, "0")} Segundos`;
}

function filterRowsClient(rows, filters) {
  const { siteId, roundId, guardId, typeFilter, statusFilter } = filters;

  return (rows || []).filter((r) => {
    const siteMatch = !siteId
      ? true
      : [r?.siteId, r?.site?._id, r?.site?.id, r?.site]
          .filter(Boolean)
          .map(String)
          .includes(String(siteId));

    const roundMatch = !roundId
      ? true
      : [r?.roundId, r?.round?._id, r?.round?.id, r?.round]
          .filter(Boolean)
          .map(String)
          .includes(String(roundId));

    const rowGuardId = pickGuardId(r);
    const guardMatch = !guardId ? true : rowGuardId === String(guardId);

    const typeText = normalizeText(r?.type || r?.eventType || r?.kind || "");
    const typeMatch = !typeFilter ? true : typeText === normalizeText(typeFilter);

    const statusText = normalizeText(r?.status || r?.state || "");
    const statusMatch = !statusFilter ? true : statusText === normalizeText(statusFilter);

    return siteMatch && roundMatch && guardMatch && typeMatch && statusMatch;
  });
}

/* =========================
   API wrappers compatibles
========================= */
async function fetchSummary(payload) {
  if (typeof rondasqrApi.getSummary === "function") {
    return await rondasqrApi.getSummary(payload);
  }
  if (typeof rondasqrApi.reportsSummary === "function") {
    return await rondasqrApi.reportsSummary(payload);
  }
  if (typeof rondasqrApi.summary === "function") {
    return await rondasqrApi.summary(payload);
  }
  return null;
}

async function fetchDetailed(payload) {
  if (typeof rondasqrApi.getDetailed === "function") {
    return await rondasqrApi.getDetailed(payload);
  }
  if (typeof rondasqrApi.listReports === "function") {
    return await rondasqrApi.listReports(payload);
  }
  if (typeof rondasqrApi.reports === "function") {
    return await rondasqrApi.reports(payload);
  }
  if (typeof rondasqrApi.listCheckins === "function") {
    return await rondasqrApi.listCheckins(payload);
  }
  return { items: [] };
}

/* =========================
   UI helpers
========================= */
function Kpi({ title, value }) {
  return (
    <div className="rounded-2xl p-4 bg-black/5 dark:bg-white/10">
      <div className="text-xs opacity-70">{title}</div>
      <div className="text-2xl font-extrabold mt-1">{String(value)}</div>
    </div>
  );
}

function ExportButtons({ onExport, disabled = false }) {
  const btnClass =
    "px-3 py-2 rounded-xl text-xs font-semibold bg-black/5 hover:bg-black/10 " +
    "dark:bg-white/10 dark:hover:bg-white/15 disabled:opacity-60 disabled:cursor-not-allowed";

  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        onClick={() => onExport("csv")}
        className={btnClass}
        disabled={disabled}
      >
        CSV
      </button>

      <button
        type="button"
        onClick={() => onExport("xlsx")}
        className={btnClass}
        disabled={disabled}
      >
        Excel
      </button>

      <button
        type="button"
        onClick={() => onExport("pdf")}
        className={btnClass}
        disabled={disabled}
      >
        PDF
      </button>
    </div>
  );
}

function SectionShell({
  title,
  subtitle = "",
  right = null,
  children,
  cardClass,
  cardFallback,
}) {
  return (
    <section className={[cardClass, cardFallback].join(" ")}>
      <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
        <div>
          <h3 className="font-semibold text-lg">{title}</h3>
          {subtitle ? <div className="text-xs opacity-70 mt-0.5">{subtitle}</div> : null}
        </div>
        {right}
      </div>
      {children}
    </section>
  );
}

/* =========================
   Component
========================= */
export default function ReportsPage() {
  const nav = useNavigate();
  const { isLoading, user } = useAuth();

  const [from, setFrom] = useState(todayIso());
  const [to, setTo] = useState(todayIso());

  const [sites, setSites] = useState([]);
  const [siteId, setSiteId] = useState("");

  const [rounds, setRounds] = useState([]);
  const [roundId, setRoundId] = useState("");

  const [guards, setGuards] = useState([]);
  const [guardId, setGuardId] = useState("");

  const [typeFilter, setTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const [loading, setLoading] = useState(false);
  const [lastSyncAt, setLastSyncAt] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(false);

  const [summary, setSummary] = useState(null);
  const [detailRows, setDetailRows] = useState([]);
  const [statsRows, setStatsRows] = useState([]);
  const [messageRows, setMessageRows] = useState([]);
  const [omissionRows, setOmissionRows] = useState([]);

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        if (typeof rondasqrApi.listSites !== "function") return;
        const res = await rondasqrApi.listSites();
        if (!alive) return;
        setSites(asItems(res));
      } catch (e) {
        console.error("[ReportsPage] listSites error:", e?.message || e);
        if (alive) setSites([]);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    let alive = true;

    (async () => {
      if (!siteId) {
        setRounds([]);
        setRoundId("");
        return;
      }

      try {
        if (typeof rondasqrApi.listRounds !== "function") return;
        const res = await rondasqrApi.listRounds(siteId);
        if (!alive) return;
        setRounds(asItems(res));
      } catch (e) {
        console.error("[ReportsPage] listRounds error:", e?.message || e);
        if (alive) setRounds([]);
      }
    })();

    return () => {
      alive = false;
    };
  }, [siteId]);

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        let users = [];

        if (typeof iamApi?.listGuards === "function") {
          const res = await iamApi.listGuards();
          users = asItems(res);
        } else if (typeof iamApi?.listUsers === "function") {
          const res = await iamApi.listUsers();
          users = asItems(res);
        }

        const normalized = (users || [])
          .filter((u) => u?.active !== false)
          .filter((u) => {
            if (typeof iamApi?.listGuards === "function") return true;

            const roles = (Array.isArray(u?.roles) ? u.roles : [])
              .map((x) => String(x).toLowerCase().trim())
              .filter(Boolean);

            return (
              roles.includes("guardia") ||
              roles.includes("guard") ||
              roles.includes("rondasqr.guard")
            );
          })
          .map((u) => ({
            _id: String(u?._id || u?.id || "").trim(),
            name: u?.name || u?.fullName || "(Sin nombre)",
            email: u?.email || "",
          }))
          .filter((u) => !!u._id)
          .sort((a, b) => String(a.name).localeCompare(String(b.name)));

        if (!alive) return;
        setGuards(normalized);
      } catch (e) {
        console.error("[ReportsPage] listGuards error:", e?.message || e);
        if (!alive) return;
        setGuards([]);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  const canSearch = useMemo(() => !!from && !!to, [from, to]);

  const isRangeOk = useMemo(() => {
    const a = isoToDateOrNull(from);
    const b = isoToDateOrNull(to);
    if (!a || !b) return true;
    return a.getTime() <= b.getTime();
  }, [from, to]);

  const selectedGuard = useMemo(
    () => guards.find((g) => g._id === guardId) || null,
    [guards, guardId]
  );

  const apiPayload = useMemo(
    () => ({
      from,
      to,
      siteId: siteId || undefined,
      roundId: roundId || undefined,
      guardId: guardId || undefined,
      guard: selectedGuard?.email || selectedGuard?.name || undefined,
      type: typeFilter || undefined,
      status: statusFilter || undefined,
    }),
    [from, to, siteId, roundId, guardId, selectedGuard, typeFilter, statusFilter]
  );

  const run = useCallback(async () => {
    if (!canSearch) return;
    if (!isRangeOk) {
      alert("Rango inválido: 'Desde' no puede ser mayor que 'Hasta'.");
      return;
    }

    setLoading(true);

    try {
      const [sumRes, detailRes] = await Promise.all([
        fetchSummary(apiPayload).catch((e) => {
          console.warn("[ReportsPage] summary error:", e?.message || e);
          return null;
        }),
        fetchDetailed(apiPayload).catch((e) => {
          console.warn("[ReportsPage] detailed error:", e?.message || e);
          return { items: [] };
        }),
      ]);

      const rawRows = asItems(detailRes);
      const filteredRows = filterRowsClient(rawRows, {
        siteId,
        roundId,
        guardId,
        typeFilter,
        statusFilter,
      });

      setSummary(sumRes);
      setDetailRows(filteredRows);

      const stats =
        asItems(sumRes?.stats).length > 0
          ? asItems(sumRes?.stats)
          : buildStatsFromRows(filteredRows);

      setStatsRows(stats);

      const messages =
        asItems(sumRes?.messages).length > 0
          ? asItems(sumRes?.messages)
          : filteredRows.filter((r) => {
              const t = normalizeText(r?.type || r?.eventType || "");
              return !!(
                r?.message ||
                r?.text ||
                ["panic", "fall", "inactivity", "immobility", "incident", "custom"].includes(t)
              );
            });

      setMessageRows(messages);

      const omissions =
        asItems(sumRes?.omissions).length > 0
          ? asItems(sumRes?.omissions)
          : asItems(detailRes?.omissions);

      setOmissionRows(omissions);
      setLastSyncAt(new Date().toISOString());
    } catch (e) {
      console.error("[ReportsPage] error:", e?.message || e);
      setSummary(null);
      setDetailRows([]);
      setStatsRows([]);
      setMessageRows([]);
      setOmissionRows([]);
      alert(e?.payload?.message || e?.message || "No se pudieron cargar los reportes.");
    } finally {
      setLoading(false);
    }
  }, [apiPayload, canSearch, guardId, isRangeOk, roundId, siteId, statusFilter, typeFilter]);

  useEffect(() => {
    run();
  }, [run]);

  useEffect(() => {
    if (!autoRefresh) return undefined;

    const timer = window.setInterval(() => {
      run();
    }, 30000);

    return () => window.clearInterval(timer);
  }, [autoRefresh, run]);

  function applyQuickRange(mode) {
    const today = todayIso();

    if (mode === "today") {
      setFrom(today);
      setTo(today);
      return;
    }

    if (mode === "7d") {
      setFrom(addDaysIso(today, -6));
      setTo(today);
      return;
    }

    if (mode === "30d") {
      setFrom(addDaysIso(today, -29));
      setTo(today);
    }
  }

  function resetFilters() {
    const today = todayIso();
    setFrom(today);
    setTo(today);
    setSiteId("");
    setRoundId("");
    setGuardId("");
    setTypeFilter("");
    setStatusFilter("");
  }

  function openExport(kind) {
    try {
      const q = { ...apiPayload };

      if (kind === "csv" && typeof rondasqrApi.csvUrl === "function") {
        window.open(rondasqrApi.csvUrl(q), "_blank", "noopener,noreferrer");
        return;
      }

      if (kind === "xlsx" && typeof rondasqrApi.xlsxUrl === "function") {
        window.open(rondasqrApi.xlsxUrl(q), "_blank", "noopener,noreferrer");
        return;
      }

      if (kind === "pdf" && typeof rondasqrApi.pdfUrl === "function") {
        window.open(rondasqrApi.pdfUrl(q), "_blank", "noopener,noreferrer");
        return;
      }

      alert(`Exportación ${kind.toUpperCase()} no disponible.`);
    } catch (e) {
      console.error("[ReportsPage] export error:", e?.message || e);
      alert("No se pudo abrir la exportación.");
    }
  }

  function openSectionExport(sectionKey, kind) {
    try {
      const q = {
        ...apiPayload,
        section: sectionKey,
      };

      if (kind === "csv" && typeof rondasqrApi.csvUrl === "function") {
        window.open(rondasqrApi.csvUrl(q), "_blank", "noopener,noreferrer");
        return;
      }

      if (kind === "xlsx" && typeof rondasqrApi.xlsxUrl === "function") {
        window.open(rondasqrApi.xlsxUrl(q), "_blank", "noopener,noreferrer");
        return;
      }

      if (kind === "pdf" && typeof rondasqrApi.pdfUrl === "function") {
        window.open(rondasqrApi.pdfUrl(q), "_blank", "noopener,noreferrer");
        return;
      }

      alert(`Exportación ${kind.toUpperCase()} no disponible para ${sectionKey}.`);
    } catch (e) {
      console.error("[ReportsPage] section export error:", e?.message || e);
      alert("No se pudo abrir la exportación de la sección.");
    }
  }

  const availableTypes = useMemo(() => {
    const set = new Set();
    for (const r of detailRows) {
      const t = String(r?.type || r?.eventType || "").trim();
      if (t) set.add(t);
    }
    return Array.from(set);
  }, [detailRows]);

  const availableStatuses = useMemo(() => {
    const set = new Set();
    for (const r of detailRows) {
      const s = String(r?.status || r?.state || "").trim();
      if (s) set.add(s);
    }
    return Array.from(set);
  }, [detailRows]);

  const pageClass = "space-y-6 layer-content";
  const headerClass =
    "fx-card rounded-2xl px-4 sm:px-6 py-3 flex items-center justify-between gap-4";
  const cardClass = "fx-card rounded-2xl p-4 sm:p-6";
  const inputClass =
    "mt-1 w-full rounded-xl px-3 py-2 bg-white/70 dark:bg-white/5 border border-black/10 dark:border-white/10";
  const btnClass =
    "px-4 py-2 rounded-xl font-semibold bg-black/5 hover:bg-black/10 dark:bg-white/10 dark:hover:bg-white/15";
  const primaryBtnClass =
    "px-4 py-2 rounded-xl font-bold text-white bg-gradient-to-r from-indigo-500 to-cyan-500 hover:brightness-105 disabled:opacity-70 disabled:cursor-not-allowed";
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
      <section className={[headerClass, headerFallback].join(" ")}>
        <div>
          <h2 className="text-xl sm:text-2xl font-bold">Informes de Rondas</h2>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-white/70 mt-0.5">
            Usuario: {user?.name || user?.email || "—"}
          </p>
          <p className="text-[11px] text-slate-500 dark:text-white/60 mt-1">
            Última sincronización: {lastSyncAt ? fmtDateTime(lastSyncAt) : "—"}
          </p>
        </div>

        <div className="flex flex-wrap gap-2 justify-end items-center">
          <label className="inline-flex items-center gap-2 text-xs px-3 py-2 rounded-xl bg-black/5 dark:bg-white/10">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
            />
            Auto-refresh
          </label>

          <button type="button" onClick={run} className={btnClass} disabled={loading}>
            {loading ? "Actualizando..." : "Actualizar"}
          </button>

          <button type="button" onClick={() => openExport("csv")} className={btnClass}>
            CSV
          </button>
          <button type="button" onClick={() => openExport("xlsx")} className={btnClass}>
            Excel
          </button>
          <button type="button" onClick={() => openExport("pdf")} className={btnClass}>
            PDF
          </button>
          <button type="button" onClick={() => window.print()} className={btnClass}>
            Imprimir
          </button>
          <button
            onClick={() => nav("/rondasqr")}
            className={btnClass}
            type="button"
          >
            Volver a rondas
          </button>
        </div>
      </section>

      <section className={[cardClass, cardFallback].join(" ")}>
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h3 className="font-semibold text-lg">Filtros</h3>

          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => applyQuickRange("today")} className={btnClass}>
              Hoy
            </button>
            <button type="button" onClick={() => applyQuickRange("7d")} className={btnClass}>
              7 días
            </button>
            <button type="button" onClick={() => applyQuickRange("30d")} className={btnClass}>
              30 días
            </button>
            <button type="button" onClick={resetFilters} className={btnClass}>
              Limpiar
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 gap-3">
          <div>
            <label className="text-xs opacity-70">Desde</label>
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className={inputClass}
            />
          </div>

          <div>
            <label className="text-xs opacity-70">Hasta</label>
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className={inputClass}
            />
          </div>

          <div>
            <label className="text-xs opacity-70">Sitio</label>
            <select
              value={siteId}
              onChange={(e) => setSiteId(e.target.value)}
              className={inputClass}
            >
              <option value="">Todos</option>
              {sites.map((s) => (
                <option key={s._id || s.id} value={s._id || s.id}>
                  {s.name || s.nombre || s.code || "Sitio"}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs opacity-70">Ronda</label>
            <select
              value={roundId}
              onChange={(e) => setRoundId(e.target.value)}
              className={inputClass}
              disabled={!siteId}
            >
              <option value="">Todas</option>
              {rounds.map((r) => (
                <option key={r._id || r.id} value={r._id || r.id}>
                  {r.name || r.nombre || "Ronda"}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs opacity-70">Tipo</label>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className={inputClass}
            >
              <option value="">Todos</option>
              {availableTypes.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
              <option value="panic">panic</option>
              <option value="fall">fall</option>
              <option value="inactivity">inactivity</option>
              <option value="immobility">immobility</option>
              <option value="incident">incident</option>
              <option value="custom">custom</option>
            </select>
          </div>

          <div>
            <label className="text-xs opacity-70">Estado</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className={inputClass}
            >
              <option value="">Todos</option>
              {availableStatuses.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[1fr_auto] gap-3 mt-3">
          <div>
            <label className="text-xs opacity-70">Guardia</label>
            <select
              value={guardId}
              onChange={(e) => setGuardId(e.target.value)}
              className={inputClass}
            >
              <option value="">Todos los guardias</option>
              {guards.map((g) => (
                <option key={g._id} value={g._id}>
                  {g.name} {g.email ? `— ${g.email}` : ""}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-end">
            <button
              disabled={loading || !canSearch || !isRangeOk}
              onClick={run}
              className={primaryBtnClass}
              type="button"
            >
              {loading ? "Cargando..." : "Buscar"}
            </button>
          </div>
        </div>

        {!isRangeOk && (
          <div className="mt-3 text-sm text-rose-600 dark:text-rose-300">
            Rango inválido: <b>Desde</b> no puede ser mayor que <b>Hasta</b>.
          </div>
        )}
      </section>

      <SectionShell
        title="Resumen ejecutivo"
        right={<ExportButtons onExport={(kind) => openSectionExport("summary", kind)} />}
        cardClass={cardClass}
        cardFallback={cardFallback}
      >
        {!summary ? (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <Kpi title="Rondas" value="—" />
            <Kpi title="Check-ins" value="—" />
            <Kpi title="Alertas" value="—" />
            <Kpi title="Incidentes" value="—" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <Kpi title="Rondas" value={summary?.rounds ?? summary?.rondas ?? statsRows.length ?? "—"} />
            <Kpi title="Check-ins" value={summary?.checkins ?? detailRows.length ?? "—"} />
            <Kpi title="Alertas" value={summary?.alerts ?? summary?.alertas ?? messageRows.length ?? "—"} />
            <Kpi title="Incidentes" value={summary?.incidents ?? summary?.incidentes ?? "—"} />
          </div>
        )}
      </SectionShell>

      <SectionShell
        title="Resumen de vista rápida"
        subtitle={statsRows?.length ? `${statsRows.length} agrupaciones` : "Sin datos de resumen"}
        right={<ExportButtons onExport={(kind) => openSectionExport("report-summary", kind)} />}
        cardClass={cardClass}
        cardFallback={cardFallback}
      >
        <ReportSummary stats={statsRows} />
      </SectionShell>

      <section className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <SectionShell
          title="Detalle general"
          subtitle={detailRows?.length ? `${detailRows.length} registros` : "Sin registros"}
          right={<ExportButtons onExport={(kind) => openSectionExport("general-detail", kind)} />}
          cardClass={cardClass}
          cardFallback={cardFallback}
        >
          {!detailRows?.length ? (
            <div className="text-sm opacity-70">No hay datos para el filtro actual.</div>
          ) : (
            <div className="overflow-auto">
              <table className="min-w-full text-sm">
                <thead className="text-left opacity-80">
                  <tr>
                    <th className="py-2 pr-4 whitespace-nowrap">Fecha</th>
                    <th className="py-2 pr-4 whitespace-nowrap">Guardia</th>
                    <th className="py-2 pr-4 whitespace-nowrap">Sitio</th>
                    <th className="py-2 pr-4 whitespace-nowrap">Ronda</th>
                    <th className="py-2 pr-4 whitespace-nowrap">Punto</th>
                    <th className="py-2 pr-4 whitespace-nowrap">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {detailRows.map((r, idx) => (
                    <tr
                      key={r._id || r.id || idx}
                      className="border-t border-black/10 dark:border-white/10"
                    >
                      <td className="py-2 pr-4 whitespace-nowrap">
                        {fmtDateTime(r.at || r.date || r.createdAt)}
                      </td>
                      <td className="py-2 pr-4">{pickGuardLabel(r)}</td>
                      <td className="py-2 pr-4">{pickSiteLabel(r)}</td>
                      <td className="py-2 pr-4">{pickRoundLabel(r)}</td>
                      <td className="py-2 pr-4">{pickPointLabel(r)}</td>
                      <td className="py-2 pr-4">{pickStatusLabel(r)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </SectionShell>

        <SectionShell
          title="Mapa / recorrido"
          subtitle={detailRows?.length ? "Seguimiento visual de la ronda" : "No hay ubicaciones para graficar"}
          right={<ExportButtons onExport={(kind) => openSectionExport("map-playback", kind)} />}
          cardClass={cardClass}
          cardFallback={cardFallback}
        >
          <MapView items={detailRows} />
          <div className="mt-4">
            <Playback items={detailRows} />
          </div>
        </SectionShell>
      </section>

      <SectionShell
        title="Despliegue detallado – Marcación por marcación"
        subtitle={detailRows?.length ? `${detailRows.length} marcas` : "No hay marcas en el rango"}
        right={<ExportButtons onExport={(kind) => openSectionExport("detailed-marks", kind)} />}
        cardClass={cardClass}
        cardFallback={cardFallback}
      >
        <DetailedMarks items={detailRows} />
      </SectionShell>

      <SectionShell
        title="Alarmas / Mensajes / Incidentes"
        subtitle={messageRows?.length ? `${messageRows.length} eventos` : "No hay mensajes"}
        right={<ExportButtons onExport={(kind) => openSectionExport("messages", kind)} />}
        cardClass={cardClass}
        cardFallback={cardFallback}
      >
        <MessagesTable items={messageRows} title="Alarmas / Mensajes / Incidentes" />
      </SectionShell>

      <SectionShell
        title="Omisiones"
        subtitle={omissionRows?.length ? `${omissionRows.length} omisiones` : "No hay omisiones para los filtros actuales"}
        right={<ExportButtons onExport={(kind) => openSectionExport("omissions", kind)} />}
        cardClass={cardClass}
        cardFallback={cardFallback}
      >
        <OmissionsTable items={omissionRows} />
      </SectionShell>

      <SectionShell
        title="Alertas en vivo"
        subtitle="Monitoreo en tiempo real"
        right={<ExportButtons onExport={(kind) => openSectionExport("live-alerts", kind)} />}
        cardClass={cardClass}
        cardFallback={cardFallback}
      >
        <LiveAlerts />
      </SectionShell>
    </div>
  );
}