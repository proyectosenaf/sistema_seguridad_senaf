import React, { useEffect, useMemo, useState, useCallback } from "react";
import { iamApi } from "../../api/iamApi.js";

import { saveAs } from "file-saver";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

/* =========================================================
   ETIQUETAS / HELPERS
========================================================= */

const DEFAULT_ACTION_LABEL = {
  create: "creación",
  update: "actualización",
  enable: "activación",
  disable: "desactivación",
  activate: "activación",
  deactivate: "desactivación",
  delete: "eliminación",
  remove: "eliminación",
  assign: "asignación",
  unassign: "desasignación",
  grant: "otorgamiento",
  revoke: "revocación",
  login: "inicio de sesión",
  logout: "cierre de sesión",
  reset_password: "reinicio de contraseña",
  change_password: "cambio de contraseña",
  verify_otp: "verificación OTP",
  resend_otp: "reenvío OTP",
  import: "importación",
  export: "exportación",
  read: "lectura",
  view: "visualización",
};

const DEFAULT_ENTITY_LABEL = {
  user: "Usuario",
  users: "Usuarios",
  role: "Rol",
  roles: "Roles",
  permission: "Permiso",
  permissions: "Permisos",
  audit: "Auditoría",
  session: "Sesión",
  policy: "Política",
  module: "Módulo",
};

const KEY_LABEL = {
  name: "Nombre",
  fullName: "Nombre",
  email: "Correo",
  active: "Activo",
  enabled: "Activo",
  roles: "Roles",
  perms: "Permisos",
  permissions: "Permisos",
  provider: "Proveedor",
  status: "Estado",
  entity: "Entidad",
  action: "Acción",
  actorEmail: "Actor",
  actorId: "Actor ID",
};

const INITIAL_VISIBLE_ROWS = 10;

function humanizeToken(v) {
  const s = String(v || "").trim();
  if (!s) return "—";

  if (DEFAULT_ACTION_LABEL[s]) return DEFAULT_ACTION_LABEL[s];
  if (DEFAULT_ENTITY_LABEL[s]) return DEFAULT_ENTITY_LABEL[s];

  return s
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^\w/, (m) => m.toUpperCase());
}

function sxCard(extra = {}) {
  return {
    background: "color-mix(in srgb, var(--card) 90%, transparent)",
    border: "1px solid var(--border)",
    boxShadow: "var(--shadow-md)",
    backdropFilter: "blur(12px) saturate(130%)",
    WebkitBackdropFilter: "blur(12px) saturate(130%)",
    ...extra,
  };
}

function sxInput(extra = {}) {
  return {
    background: "var(--input-bg)",
    color: "var(--text)",
    border: "1px solid var(--input-border)",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,.04)",
    ...extra,
  };
}

function sxGhostBtn(extra = {}) {
  return {
    background: "color-mix(in srgb, var(--card-solid) 88%, transparent)",
    color: "var(--text)",
    border: "1px solid var(--border)",
    boxShadow: "var(--shadow-sm)",
    ...extra,
  };
}

function sxSuccessBtn(extra = {}) {
  return {
    background: "linear-gradient(135deg, #16a34a, #22c55e)",
    color: "#fff",
    border: "1px solid transparent",
    boxShadow: "0 10px 20px color-mix(in srgb, #16a34a 22%, transparent)",
    ...extra,
  };
}

function sxDangerBtn(extra = {}) {
  return {
    background: "linear-gradient(135deg, #dc2626, #ef4444)",
    color: "#fff",
    border: "1px solid transparent",
    boxShadow: "0 10px 20px color-mix(in srgb, #dc2626 22%, transparent)",
    ...extra,
  };
}

function safeJsonStringify(value) {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function normalizeObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  return value;
}

function formatDateTime(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString();
}

function normalizeActor(x) {
  const candidate =
    x?.actorEmail ??
    x?.actor?.email ??
    x?.actor?.sub ??
    x?.actorId ??
    x?.userEmail ??
    x?.actor ??
    "";

  if (!candidate) return "";

  if (typeof candidate === "string") return candidate.trim();

  if (typeof candidate === "object") {
    return String(
      candidate.email ||
        candidate.sub ||
        candidate.id ||
        candidate._id ||
        candidate.name ||
        ""
    ).trim();
  }

  return String(candidate).trim();
}

/* =========================================================
   UI HELPERS
========================================================= */

function Truncate({ children, max = 220 }) {
  const [open, setOpen] = useState(false);
  const text = typeof children === "string" ? children : String(children ?? "");
  if (text.length <= max) return <>{text}</>;
  return (
    <span className="inline">
      {open ? text : text.slice(0, max) + "…"}{" "}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="text-[11px] hover:underline"
        style={{ color: "#60a5fa" }}
      >
        {open ? "ver menos" : "ver más"}
      </button>
    </span>
  );
}

function fmtValue(v) {
  if (v === null || v === undefined) return "—";

  if (typeof v === "boolean") {
    return (
      <span
        className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px]"
        style={
          v
            ? {
                background: "color-mix(in srgb, #22c55e 12%, transparent)",
                color: "#86efac",
                border: "1px solid color-mix(in srgb, #22c55e 36%, transparent)",
              }
            : {
                background: "color-mix(in srgb, #ef4444 12%, transparent)",
                color: "#fca5a5",
                border: "1px solid color-mix(in srgb, #ef4444 36%, transparent)",
              }
        }
      >
        {v ? "Sí" : "No"}
      </span>
    );
  }

  if (Array.isArray(v)) {
    if (v.length === 0) return "—";
    return (
      <div className="flex flex-wrap gap-1">
        {v.map((x, i) => (
          <span
            key={i}
            className="px-2 py-0.5 rounded-full text-[11px]"
            style={sxGhostBtn()}
          >
            {typeof x === "object" ? safeJsonStringify(x) : String(x)}
          </span>
        ))}
      </div>
    );
  }

  if (typeof v === "object") {
    const entries = Object.entries(v);
    if (entries.length === 0) return "—";

    return (
      <Truncate max={260}>
        {entries
          .map(([k, val]) => {
            const vv = typeof val === "object" ? safeJsonStringify(val) : String(val);
            return `${KEY_LABEL[k] || k}: ${vv}`;
          })
          .join(" · ")}
      </Truncate>
    );
  }

  return String(v);
}

function diffKeys(before = {}, after = {}) {
  const b = normalizeObject(before) || {};
  const a = normalizeObject(after) || {};
  const keys = new Set([...Object.keys(b), ...Object.keys(a)]);
  return [...keys];
}

function PrettyBox({ obj, compareWith, emphasizeChanges = false }) {
  if (
    obj === null ||
    obj === undefined ||
    (typeof obj === "object" && !Array.isArray(obj) && Object.keys(obj).length === 0)
  ) {
    return <span style={{ color: "var(--text-muted)" }}>—</span>;
  }

  if (typeof obj !== "object" || Array.isArray(obj)) {
    return <div style={{ color: "var(--text)" }}>{fmtValue(obj)}</div>;
  }

  const keys = diffKeys(compareWith, obj);

  return (
    <div className="space-y-1">
      {keys.map((k) => {
        const changed =
          emphasizeChanges &&
          safeJsonStringify((compareWith || {})[k]) !== safeJsonStringify(obj[k]);

        return (
          <div
            key={k}
            className="flex gap-2"
            style={
              changed
                ? {
                    background: "color-mix(in srgb, #22c55e 8%, transparent)",
                    border: "1px solid color-mix(in srgb, #22c55e 22%, transparent)",
                    borderRadius: "0.5rem",
                    padding: "0.375rem 0.5rem",
                  }
                : undefined
            }
          >
            <span className="shrink-0" style={{ color: "var(--text-muted)" }}>
              {KEY_LABEL[k] || k}:
            </span>
            <div style={{ color: "var(--text)" }}>{fmtValue(obj[k])}</div>
          </div>
        );
      })}
    </div>
  );
}

function ScrollCell({ children }) {
  return (
    <div className="min-w-[320px] max-w-[420px]">
      <div className="max-h-64 overflow-auto pr-2">{children}</div>
    </div>
  );
}

const toPlain = (v) =>
  typeof v === "boolean"
    ? v
      ? "Sí"
      : "No"
    : Array.isArray(v)
    ? v
        .map((x) => (typeof x === "object" ? safeJsonStringify(x) : String(x)))
        .join(", ")
    : v && typeof v === "object"
    ? Object.entries(v)
        .map(([k, val]) => {
          const vv = typeof val === "object" ? safeJsonStringify(val) : String(val);
          return `${KEY_LABEL[k] || k}: ${vv}`;
        })
        .join(" | ")
    : v ?? "—";

function normalizeAuditItem(x) {
  const createdAt = x?.createdAt || x?.ts || x?.timestamp || x?.date || null;

  return {
    _id: x?._id || "",
    createdAt,
    action: String(x?.action || "").trim(),
    entity: String(x?.entity || "").trim(),
    actorEmail: normalizeActor(x),
    before: x?.before ?? null,
    after: x?.after ?? null,
    raw: x,
  };
}

export default function AuditPage() {
  const [audits, setAudits] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const [filterAction, setFilterAction] = useState("");
  const [filterEntity, setFilterEntity] = useState("");
  const [filterActor, setFilterActor] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [dateErr, setDateErr] = useState("");
  const [showAllRows, setShowAllRows] = useState(false);

  const actionsOptions = useMemo(() => {
    const map = new Map();

    for (const a of audits) {
      if (!a.action) continue;

      const label = humanizeToken(a.action);
      if (!map.has(label)) {
        map.set(label, a.action);
      }
    }

    return [
      "",
      ...Array.from(map.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([, value]) => value),
    ];
  }, [audits]);

  const entityOptions = useMemo(() => {
    const set = new Set();
    for (const a of audits) {
      if (a.entity) set.add(a.entity);
    }
    return ["", ...Array.from(set).sort((a, b) => a.localeCompare(b))];
  }, [audits]);

  const fetchAudits = useCallback(async () => {
    try {
      setErr("");
      setLoading(true);

      if (
        dateFrom &&
        dateTo &&
        new Date(`${dateFrom}T00:00:00`) > new Date(`${dateTo}T23:59:59.999`)
      ) {
        setDateErr("La fecha 'desde' no puede ser mayor que 'hasta'.");
        setAudits([]);
        setFiltered([]);
        return;
      }

      setDateErr("");

      const pageSize = 500;
      let skip = 0;
      let total = Infinity;
      let acc = [];

      while (skip < total) {
        const params = {
          limit: pageSize,
          skip,
          ...(filterAction ? { action: filterAction } : {}),
          ...(filterEntity ? { entity: filterEntity } : {}),
          ...(filterActor ? { actor: filterActor } : {}),
          ...(dateFrom ? { from: dateFrom } : {}),
          ...(dateTo ? { to: dateTo } : {}),
        };

        const res = await iamApi.listAudit(params);

        const raw =
          (Array.isArray(res?.items) && res.items) ||
          (Array.isArray(res?.data?.items) && res.data.items) ||
          (Array.isArray(res?.data) && res.data) ||
          [];

        const batch = raw.map(normalizeAuditItem);
        acc = acc.concat(batch);

        const reportedTotal =
          Number(res?.total) ||
          Number(res?.data?.total) ||
          raw.length;

        total = reportedTotal;

        if (raw.length < pageSize) break;
        skip += pageSize;
      }

      const unique = [];
      const seen = new Set();

      for (const item of acc) {
        const k =
          item._id ||
          `${item.createdAt}|${item.action}|${item.entity}|${item.actorEmail}|${safeJsonStringify(item.before)}|${safeJsonStringify(item.after)}`;

        if (seen.has(k)) continue;
        seen.add(k);
        unique.push(item);
      }

      unique.sort((a, b) => {
        const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return tb - ta;
      });

      setAudits(unique);
      setFiltered(unique);
      setShowAllRows(false);
    } catch (e) {
      setErr(
        e?.response?.data?.error ||
          e?.message ||
          "No se pudo cargar el historial de auditoría"
      );
      setAudits([]);
      setFiltered([]);
      setShowAllRows(false);
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo, filterAction, filterEntity, filterActor]);

  useEffect(() => {
    fetchAudits();
  }, [fetchAudits]);

  const toStartOfDay = (s) => (s ? new Date(`${s}T00:00:00`) : null);
  const toEndOfDay = (s) => (s ? new Date(`${s}T23:59:59.999`) : null);

  useEffect(() => {
    let list = [...audits];

    const from = toStartOfDay(dateFrom);
    const to = toEndOfDay(dateTo);

    if (from && to && from > to) {
      setDateErr("La fecha 'desde' no puede ser mayor que 'hasta'.");
    } else {
      setDateErr("");
    }

    if (from) {
      list = list.filter((a) => {
        const t = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        return t >= from.getTime();
      });
    }

    if (to) {
      list = list.filter((a) => {
        const t = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        return t <= to.getTime();
      });
    }

    if (filterAction) list = list.filter((a) => a.action === filterAction);
    if (filterEntity) list = list.filter((a) => a.entity === filterEntity);

    if (filterActor) {
      const q = filterActor.toLowerCase();
      list = list.filter((a) => String(a.actorEmail || "").toLowerCase().includes(q));
    }

    setFiltered(list);
    setShowAllRows(false);
  }, [filterAction, filterEntity, filterActor, dateFrom, dateTo, audits]);

  const visibleRows = useMemo(() => {
    return showAllRows ? filtered : filtered.slice(0, INITIAL_VISIBLE_ROWS);
  }, [filtered, showAllRows]);

  const hiddenCount = Math.max(0, filtered.length - INITIAL_VISIBLE_ROWS);

  const exportExcel = () => {
    const rows = filtered.map((a) => ({
      Fecha: formatDateTime(a.createdAt),
      Acción: humanizeToken(a.action),
      Entidad: humanizeToken(a.entity),
      Actor: a.actorEmail || "",
      Antes: a.before ? toPlain(a.before) : "",
      Después: a.after ? toPlain(a.after) : "",
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Auditoría");
    const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });

    saveAs(
      new Blob([buf], { type: "application/octet-stream" }),
      `Historial_Auditoria_${Date.now()}.xlsx`
    );
  };

  const exportPDF = async () => {
    const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
    const marginX = 40;
    const marginY = 32;
    const generatedAt = new Date().toLocaleString();

    doc.setFontSize(14);
    doc.text("Sistema SENAF - Historial de Auditoría", marginX, marginY);
    doc.setFontSize(10);
    doc.text(`Generado: ${generatedAt}`, marginX, marginY + 12);

    let rango = "";
    if (dateFrom && dateTo) rango = `Rango: ${dateFrom} → ${dateTo}`;
    else if (dateFrom) rango = `Desde: ${dateFrom}`;
    else if (dateTo) rango = `Hasta: ${dateTo}`;

    if (rango) {
      doc.text(rango, doc.internal.pageSize.getWidth() - marginX, marginY + 12, {
        align: "right",
      });
    }

    const body = filtered.map((a) => [
      formatDateTime(a.createdAt),
      humanizeToken(a.action),
      humanizeToken(a.entity),
      a.actorEmail || "",
      a.before ? toPlain(a.before) : "",
      a.after ? toPlain(a.after) : "",
    ]);

    autoTable(doc, {
      startY: marginY + 22,
      head: [["Fecha", "Acción", "Entidad", "Actor", "Antes", "Después"]],
      body,
      styles: { fontSize: 8, cellPadding: 4, overflow: "linebreak" },
      headStyles: { fontStyle: "bold" },
      columnStyles: {
        0: { cellWidth: 90 },
        1: { cellWidth: 80 },
        2: { cellWidth: 80 },
        3: { cellWidth: 130 },
        4: { cellWidth: 180 },
        5: { cellWidth: 180 },
      },
    });

    doc.save(`Historial_Auditoria_${Date.now()}.pdf`);
  };

  const zebra = useMemo(
    () =>
      visibleRows.map((_, i) =>
        i % 2 === 0
          ? "color-mix(in srgb, var(--card-solid) 86%, transparent)"
          : "color-mix(in srgb, var(--card-solid) 78%, transparent)"
      ),
    [visibleRows]
  );

  return (
    <div className="min-h-[calc(100vh-4rem)] relative">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-70"
        style={{
          background:
            "radial-gradient(1000px 600px at 10% 10%, rgba(0,255,255,0.06), transparent 60%), radial-gradient(800px 500px at 90% 20%, rgba(168,85,247,0.08), transparent 60%)",
        }}
      />

      <div className="relative z-10 space-y-6 p-4 md:p-6">
        <div className="rounded-[24px] p-6" style={sxCard()}>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-semibold" style={{ color: "var(--text)" }}>
                Historial de Auditoría
              </h1>
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                Bitácora de acciones sobre usuarios, roles y permisos
              </p>
            </div>

            <div className="flex gap-2 flex-wrap">
              <button
                onClick={fetchAudits}
                className="px-3 py-2 rounded-lg text-sm"
                style={sxGhostBtn()}
              >
                Actualizar
              </button>

              <button
                onClick={exportExcel}
                className="px-3 py-2 rounded-lg text-sm"
                style={sxSuccessBtn()}
                disabled={!!dateErr}
                title={dateErr || ""}
              >
                Excel
              </button>

              <button
                onClick={exportPDF}
                className="px-3 py-2 rounded-lg text-sm"
                style={sxDangerBtn()}
                disabled={!!dateErr}
                title={dateErr || ""}
              >
                PDF
              </button>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 md:grid-cols-5 gap-3">
            <select
              style={sxInput()}
              className="rounded-lg px-3 py-2 text-sm outline-none"
              value={filterAction}
              onChange={(e) => setFilterAction(e.target.value)}
            >
              {actionsOptions.map((a, idx) => (
                <option key={idx} value={a}>
                  {a ? humanizeToken(a) : "Todas las acciones"}
                </option>
              ))}
            </select>

            <select
              style={sxInput()}
              className="rounded-lg px-3 py-2 text-sm outline-none"
              value={filterEntity}
              onChange={(e) => setFilterEntity(e.target.value)}
            >
              {entityOptions.map((e, idx) => (
                <option key={idx} value={e}>
                  {e ? humanizeToken(e) : "Todas las entidades"}
                </option>
              ))}
            </select>

            <input
              type="text"
              placeholder="Buscar actor…"
              style={sxInput()}
              className="rounded-lg px-3 py-2 text-sm outline-none"
              value={filterActor}
              onChange={(e) => setFilterActor(e.target.value)}
            />

            <input
              type="date"
              style={sxInput()}
              className="rounded-lg px-3 py-2 text-sm outline-none"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
            />

            <input
              type="date"
              style={sxInput()}
              className="rounded-lg px-3 py-2 text-sm outline-none"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
            />
          </div>

          {dateErr ? (
            <div className="mt-2 text-xs" style={{ color: "#fca5a5" }}>
              {dateErr}
            </div>
          ) : null}
        </div>

        <div className="rounded-[24px] overflow-hidden" style={sxCard()}>
          {err ? (
            <div className="p-3 text-sm" style={{ color: "#fca5a5" }}>
              {err}
            </div>
          ) : null}

          <div className="overflow-x-auto">
            <table
              className="min-w-[1500px] w-full text-sm"
              style={{ color: "var(--text)" }}
            >
              <thead
                className="sticky top-0 backdrop-blur z-10"
                style={{
                  background: "color-mix(in srgb, var(--card-solid) 94%, transparent)",
                }}
              >
                <tr
                  className="[&>th]:px-3 [&>th]:py-2 [&>th]:font-semibold"
                  style={{ borderBottom: "1px solid var(--border)" }}
                >
                  <th className="min-w-[170px]">Fecha</th>
                  <th className="min-w-[140px]">Acción</th>
                  <th className="min-w-[140px]">Entidad</th>
                  <th className="min-w-[240px]">Actor</th>
                  <th className="min-w-[360px]">Antes</th>
                  <th className="min-w-[360px]">Después</th>
                </tr>
              </thead>

              <tbody>
                {loading ? (
                  <tr>
                    <td
                      colSpan="6"
                      className="text-center py-12"
                      style={{ color: "var(--text-muted)" }}
                    >
                      Cargando…
                    </td>
                  </tr>
                ) : visibleRows.length === 0 ? (
                  <tr>
                    <td
                      colSpan="6"
                      className="text-center py-12"
                      style={{ color: "var(--text-muted)" }}
                    >
                      Sin registros
                    </td>
                  </tr>
                ) : (
                  visibleRows.map((a, i) => (
                    <tr
                      key={a._id || `${a.createdAt}-${i}`}
                      className="transition-colors"
                      style={{
                        background: zebra[i],
                        borderBottom: "1px solid var(--border)",
                      }}
                    >
                      <td
                        className="px-3 py-3 align-top"
                        style={{ color: "var(--text-muted)" }}
                      >
                        {formatDateTime(a.createdAt)}
                      </td>

                      <td className="px-3 py-3 align-top">
                        <span
                          className="px-2 py-0.5 rounded-full text-xs font-medium"
                          style={sxGhostBtn()}
                        >
                          {humanizeToken(a.action)}
                        </span>
                      </td>

                      <td className="px-3 py-3 align-top">
                        {a.entity ? humanizeToken(a.entity) : "—"}
                      </td>

                      <td
                        className="px-3 py-3 align-top"
                        style={{ color: "var(--text-muted)" }}
                      >
                        <div className="min-w-[220px] max-w-[280px] break-words">
                          {a.actorEmail || "—"}
                        </div>
                      </td>

                      <td className="px-3 py-3 text-xs align-top">
                        <ScrollCell>
                          <PrettyBox
                            obj={a.before}
                            compareWith={a.after}
                            emphasizeChanges={false}
                          />
                        </ScrollCell>
                      </td>

                      <td className="px-3 py-3 text-xs align-top">
                        <ScrollCell>
                          <PrettyBox
                            obj={a.after}
                            compareWith={a.before}
                            emphasizeChanges={true}
                          />
                        </ScrollCell>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div
            className="px-4 py-3 text-[12px] flex flex-col md:flex-row md:items-center md:justify-between gap-3"
            style={{
              color: "var(--text-muted)",
              borderTop: "1px solid var(--border)",
            }}
          >
            <div>
              Mostrando <span style={{ color: "var(--text)" }}>{visibleRows.length}</span> de{" "}
              <span style={{ color: "var(--text)" }}>{filtered.length}</span> registros filtrados
              {" · "}total cargados{" "}
              <span style={{ color: "var(--text)" }}>{audits.length}</span>
              {dateFrom || dateTo ? (
                <>
                  {" "}
                  · rango aplicado {dateFrom || "—"} → {dateTo || "—"}
                </>
              ) : null}
            </div>

            {hiddenCount > 0 ? (
              <button
                type="button"
                onClick={() => setShowAllRows((v) => !v)}
                className="px-3 py-2 rounded-lg text-sm"
                style={sxGhostBtn()}
              >
                {showAllRows
                  ? "Mostrar solo las últimas 10"
                  : `Mostrar ${hiddenCount} más`}
              </button>
            ) : filtered.length > INITIAL_VISIBLE_ROWS ? (
              <button
                type="button"
                onClick={() => setShowAllRows((v) => !v)}
                className="px-3 py-2 rounded-lg text-sm"
                style={sxGhostBtn()}
              >
                {showAllRows ? "Mostrar solo las últimas 10" : "Mostrar todos"}
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}