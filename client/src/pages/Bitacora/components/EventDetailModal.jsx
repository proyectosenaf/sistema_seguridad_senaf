import React from "react";
import Pill from "./Pill";
import {
  estadoTone,
  fmtDateTime,
  prioridadTone,
} from "../utils/bitacora.formatters";

function pretty(value) {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "Sí" : "No";
  if (typeof value === "number") return String(value);

  if (typeof value === "string") {
    const asDate = new Date(value);
    if (!Number.isNaN(asDate.getTime()) && value.length >= 10) {
      return fmtDateTime(asDate.toISOString());
    }
    return value;
  }

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function rawValue(value) {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "Sí" : "No";
  if (typeof value === "number") return String(value);
  if (typeof value === "string") return value;

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function sanitizeFileNamePart(value, fallback = "evento") {
  const v = String(value || "")
    .trim()
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, "")
    .replace(/\s+/g, "_")
    .slice(0, 60);

  return v || fallback;
}

function downloadTextFile(
  content,
  filename,
  mimeType = "text/plain;charset=utf-8"
) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();

  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function buildPdfHtml(view) {
  const esc = (v) =>
    String(v ?? "—")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");

  const row = (label, value) => `
    <div class="item">
      <div class="label">${esc(label)}</div>
      <div class="value">${esc(rawValue(value))}</div>
    </div>
  `;

  const jsonBlock = (title, data) => `
    <section class="section">
      <div class="section-title">${esc(title)}</div>
      <pre>${esc(
        typeof data === "string" ? data : JSON.stringify(data ?? "—", null, 2)
      )}</pre>
    </section>
  `;

  return `
    <!doctype html>
    <html lang="es">
      <head>
        <meta charset="utf-8" />
        <title>Detalle del Evento</title>
        <style>
          @page { size: A4; margin: 18mm; }
          body {
            font-family: Arial, Helvetica, sans-serif;
            color: #111827;
            font-size: 12px;
            line-height: 1.45;
            margin: 0;
          }
          h1 {
            margin: 0 0 4px;
            font-size: 24px;
          }
          .subtitle {
            margin: 0 0 18px;
            color: #4b5563;
            font-size: 13px;
          }
          .grid {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 10px;
            margin-bottom: 14px;
          }
          .item {
            border: 1px solid #d1d5db;
            border-radius: 10px;
            padding: 10px 12px;
            break-inside: avoid;
          }
          .label {
            font-size: 11px;
            color: #6b7280;
            margin-bottom: 4px;
          }
          .value {
            font-size: 14px;
            font-weight: 700;
            word-break: break-word;
            white-space: pre-wrap;
          }
          .section {
            margin-top: 14px;
            border: 1px solid #d1d5db;
            border-radius: 12px;
            overflow: hidden;
            break-inside: avoid;
          }
          .section-title {
            background: #f3f4f6;
            border-bottom: 1px solid #d1d5db;
            padding: 10px 12px;
            font-size: 14px;
            font-weight: 700;
          }
          .section-body {
            padding: 12px;
            white-space: pre-wrap;
            word-break: break-word;
          }
          pre {
            margin: 0;
            padding: 12px;
            white-space: pre-wrap;
            word-break: break-word;
            font-size: 11px;
            font-family: Consolas, Menlo, monospace;
          }
        </style>
      </head>
      <body>
        <h1>Detalle del Evento</h1>
        <div class="subtitle">Vista completa de auditoría y trazabilidad</div>

        <div class="grid">
          ${row("Fecha y Hora", view.fecha)}
          ${row("Módulo", view.modulo)}
          ${row("Tipo", view.tipo)}
          ${row("Acción", view.accion)}
          ${row("Agente", view.agente)}
          ${row("Actor", view.actorEmail || view.nombre)}
          ${row("Rol del actor", view.actorRol)}
          ${row("Turno", view.turno)}
          ${row("Entidad", view.entidad)}
          ${row("ID Entidad", view.entidadId)}
          ${row("IP", view.ip)}
          ${row("Source", view.source)}
          ${row("Prioridad", view.prioridad)}
          ${row("Estado", view.estado)}
          ${row("Nombre relacionado", view.nombre)}
          ${row("Empresa / Zona", view.empresa)}
          ${row("Actor ID", view.actorId)}
          ${row("User Agent", view.userAgent)}
          ${row("Archivado", view.archived ? "Sí" : "No")}
          ${row("Archivado por", view.archivedBy)}
          ${row("Fecha archivado", view.archivedAt)}
          ${row("Visible", view.visible ? "Sí" : "No")}
        </div>

        <section class="section">
          <div class="section-title">Título</div>
          <div class="section-body">${esc(rawValue(view.titulo))}</div>
        </section>

        <section class="section">
          <div class="section-title">Descripción</div>
          <div class="section-body">${esc(rawValue(view.descripcion))}</div>
        </section>

        ${
          view.meta && typeof view.meta === "object"
            ? jsonBlock("Meta", view.meta)
            : ""
        }

        ${
          view.before !== undefined && view.before !== null && view.before !== ""
            ? jsonBlock("Before", view.before)
            : ""
        }

        ${
          view.after !== undefined && view.after !== null && view.after !== ""
            ? jsonBlock("After", view.after)
            : ""
        }
      </body>
    </html>
  `;
}

function exportEventJson(view) {
  const baseName = sanitizeFileNamePart(
    `${view?.modulo || "bitacora"}_${view?.tipo || "evento"}_${
      view?._id || view?.id || view?.entidadId || Date.now()
    }`,
    "evento_bitacora"
  );

  const data = {
    ...view,
    exportedAt: new Date().toISOString(),
  };

  downloadTextFile(
    JSON.stringify(data, null, 2),
    `${baseName}.json`,
    "application/json;charset=utf-8"
  );
}

function exportEventPdf(view) {
  const html = buildPdfHtml(view);

  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";
  iframe.style.visibility = "hidden";

  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document;
  if (!doc || !iframe.contentWindow) {
    document.body.removeChild(iframe);
    alert("No se pudo generar el PDF.");
    return;
  }

  doc.open();
  doc.write(html);
  doc.close();

  const runPrint = () => {
    try {
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
    } catch (err) {
      console.error("Error imprimiendo PDF:", err);
      alert("No se pudo generar el PDF.");
    } finally {
      setTimeout(() => {
        if (iframe.parentNode) {
          iframe.parentNode.removeChild(iframe);
        }
      }, 1000);
    }
  };

  if (doc.readyState === "complete") {
    setTimeout(runPrint, 250);
  } else {
    iframe.onload = () => setTimeout(runPrint, 250);
  }
}

function JsonBlock({ title, data }) {
  return (
    <div className="bitacora-modal-section">
      <div className="bitacora-modal-section-head">
        <div className="bitacora-modal-section-title">{title}</div>
      </div>
      <div className="bitacora-modal-section-body">
        <pre className="bitacora-modal-pre rounded-xl bg-black/5 p-3 text-xs leading-relaxed dark:bg-white/5">
          {pretty(data)}
        </pre>
      </div>
    </div>
  );
}

function MetaItem({ label, value }) {
  return (
    <div className="bitacora-modal-card">
      <div className="bitacora-modal-label">{label}</div>
      <div className="bitacora-modal-value">{pretty(value)}</div>
    </div>
  );
}

export default function EventDetailModal({
  view,
  onClose,
  onDelete,
  deleting = false,
  loading = false,
  error = "",
}) {
  if (!view) return null;

  const handleClose = () => {
    if (deleting) return;
    onClose?.();
  };

  const handleDelete = () => {
    if (deleting) return;
    onDelete?.(view);
  };

  const handleExportJson = () => {
    if (deleting || loading || !view) return;
    exportEventJson(view);
  };

  const handleExportPdf = () => {
    if (deleting || loading || !view) return;
    exportEventPdf(view);
  };

  const hasBefore =
    view.before !== undefined && view.before !== null && view.before !== "";
  const hasAfter =
    view.after !== undefined && view.after !== null && view.after !== "";
  const hasMeta = view.meta && typeof view.meta === "object";

  return (
    <div className="bitacora-modal-backdrop" onClick={handleClose}>
      <div
        className="bitacora-modal-shell"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bitacora-modal-head">
          <div>
            <div className="bitacora-modal-title">Detalle del Evento</div>
            <div className="bitacora-modal-subtitle">
              Vista completa de auditoría y trazabilidad
            </div>
          </div>

          <button
            type="button"
            onClick={handleClose}
            className="bitacora-modal-close"
            aria-label="Cerrar"
            disabled={deleting}
          >
            ✕
          </button>
        </div>

        <div className="bitacora-modal-body">
          {loading && (
            <div className="bitacora-modal-card mb-4 text-sm opacity-80">
              Cargando detalle del evento…
            </div>
          )}

          {!!error && (
            <div className="mb-4 rounded-xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-300">
              {error}
            </div>
          )}

          <div className="bitacora-modal-grid">
            <MetaItem label="Fecha y Hora" value={view.fecha} />
            <MetaItem label="Módulo" value={view.modulo} />
            <MetaItem label="Tipo" value={view.tipo} />
            <MetaItem label="Acción" value={view.accion} />

            <MetaItem label="Agente" value={view.agente} />
            <MetaItem label="Actor" value={view.actorEmail || view.nombre} />
            <MetaItem label="Rol del actor" value={view.actorRol} />
            <MetaItem label="Turno" value={view.turno} />

            <MetaItem label="Entidad" value={view.entidad} />
            <MetaItem label="ID Entidad" value={view.entidadId} />
            <MetaItem label="IP" value={view.ip} />
            <MetaItem label="Source" value={view.source} />
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="bitacora-modal-card flex items-center justify-between gap-3">
              <div>
                <div className="bitacora-modal-label">Prioridad</div>
                <div className="mt-1">
                  <Pill tone={prioridadTone(view.prioridad)}>
                    {view.prioridad || "—"}
                  </Pill>
                </div>
              </div>
            </div>

            <div className="bitacora-modal-card flex items-center justify-between gap-3">
              <div>
                <div className="bitacora-modal-label">Estado</div>
                <div className="mt-1">
                  <Pill tone={estadoTone(view.estado)}>
                    {view.estado || "—"}
                  </Pill>
                </div>
              </div>
            </div>
          </div>

          <div className="bitacora-modal-section">
            <div className="bitacora-modal-section-head">
              <div className="bitacora-modal-section-title">Título</div>
            </div>
            <div className="bitacora-modal-section-body">
              <div className="bitacora-modal-value whitespace-pre-wrap leading-relaxed">
                {view.titulo || "—"}
              </div>
            </div>
          </div>

          <div className="bitacora-modal-section">
            <div className="bitacora-modal-section-head">
              <div className="bitacora-modal-section-title">Descripción</div>
            </div>
            <div className="bitacora-modal-section-body">
              <div className="whitespace-pre-wrap leading-relaxed text-[15px] text-[var(--text)]">
                {view.descripcion || "—"}
              </div>
            </div>
          </div>

          <div className="mt-4 bitacora-modal-grid">
            <MetaItem label="Nombre relacionado" value={view.nombre} />
            <MetaItem label="Empresa / Zona" value={view.empresa} />
            <MetaItem label="Actor ID" value={view.actorId} />
            <MetaItem label="User Agent" value={view.userAgent} />
            <MetaItem label="Archivado" value={view.archived ? "Sí" : "No"} />
            <MetaItem label="Archivado por" value={view.archivedBy} />
            <MetaItem label="Fecha archivado" value={view.archivedAt} />
            <MetaItem label="Visible" value={view.visible} />
          </div>

          {hasMeta && <JsonBlock title="Meta" data={view.meta} />}

          {(hasBefore || hasAfter) && (
            <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
              <JsonBlock title="Before" data={view.before} />
              <JsonBlock title="After" data={view.after} />
            </div>
          )}

          <div className="bitacora-modal-actions">
            <button
              type="button"
              onClick={handleClose}
              disabled={deleting}
              className="bitacora-modal-btn disabled:cursor-not-allowed disabled:opacity-60"
            >
              Cerrar
            </button>

            <button
              type="button"
              onClick={handleExportPdf}
              disabled={deleting || loading}
              className="bitacora-modal-btn disabled:cursor-not-allowed disabled:opacity-60"
            >
              Exportar PDF
            </button>

            <button
              type="button"
              onClick={handleExportJson}
              disabled={deleting || loading}
              className="bitacora-modal-btn disabled:cursor-not-allowed disabled:opacity-60"
            >
              Exportar JSON
            </button>

            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              className="bitacora-modal-btn bitacora-modal-btn--danger disabled:cursor-not-allowed disabled:opacity-60"
            >
              {deleting ? "Archivando..." : "Archivar"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}