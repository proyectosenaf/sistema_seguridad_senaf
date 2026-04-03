import React from "react";
import { useTranslation } from "react-i18next";
import Pill from "./Pill";
import {
  estadoTone,
  fmtDateTime,
  prioridadTone,
} from "../utils/bitacora.formatters";

function pretty(value, t) {
  if (value === null || value === undefined || value === "") {
    return t("bitacora.eventDetail.empty", { defaultValue: "—" });
  }

  if (typeof value === "boolean") {
    return value
      ? t("common.yes", { defaultValue: "Sí" })
      : t("common.no", { defaultValue: "No" });
  }

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

function rawValue(value, t) {
  if (value === null || value === undefined || value === "") {
    return t("bitacora.eventDetail.empty", { defaultValue: "—" });
  }

  if (typeof value === "boolean") {
    return value
      ? t("common.yes", { defaultValue: "Sí" })
      : t("common.no", { defaultValue: "No" });
  }

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

function buildPdfHtml(view, t) {
  const esc = (v) =>
    String(v ?? t("bitacora.eventDetail.empty", { defaultValue: "—" }))
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");

  const row = (label, value) => `
    <div class="item">
      <div class="label">${esc(label)}</div>
      <div class="value">${esc(rawValue(value, t))}</div>
    </div>
  `;

  const jsonBlock = (title, data) => `
    <section class="section">
      <div class="section-title">${esc(title)}</div>
      <pre>${esc(
        typeof data === "string"
          ? data
          : JSON.stringify(
              data ?? t("bitacora.eventDetail.empty", { defaultValue: "—" }),
              null,
              2
            )
      )}</pre>
    </section>
  `;

  return `
    <!doctype html>
    <html lang="${esc(i18nLangFromT(t))}">
      <head>
        <meta charset="utf-8" />
        <title>${esc(
          t("bitacora.eventDetail.title", { defaultValue: "Detalle del Evento" })
        )}</title>
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
        <h1>${esc(
          t("bitacora.eventDetail.title", { defaultValue: "Detalle del Evento" })
        )}</h1>
        <div class="subtitle">${esc(
          t("bitacora.eventDetail.subtitle", {
            defaultValue: "Vista completa de auditoría y trazabilidad",
          })
        )}</div>

        <div class="grid">
          ${row(
            t("bitacora.eventDetail.fields.dateTime", {
              defaultValue: "Fecha y Hora",
            }),
            view.fecha
          )}
          ${row(
            t("bitacora.eventDetail.fields.module", {
              defaultValue: "Módulo",
            }),
            view.modulo
          )}
          ${row(
            t("bitacora.eventDetail.fields.type", { defaultValue: "Tipo" }),
            view.tipo
          )}
          ${row(
            t("bitacora.eventDetail.fields.action", { defaultValue: "Acción" }),
            view.accion
          )}
          ${row(
            t("bitacora.eventDetail.fields.agent", { defaultValue: "Agente" }),
            view.agente
          )}
          ${row(
            t("bitacora.eventDetail.fields.actor", { defaultValue: "Actor" }),
            view.actorEmail || view.nombre
          )}
          ${row(
            t("bitacora.eventDetail.fields.actorRole", {
              defaultValue: "Rol del actor",
            }),
            view.actorRol
          )}
          ${row(
            t("bitacora.eventDetail.fields.shift", { defaultValue: "Turno" }),
            view.turno
          )}
          ${row(
            t("bitacora.eventDetail.fields.entity", {
              defaultValue: "Entidad",
            }),
            view.entidad
          )}
          ${row(
            t("bitacora.eventDetail.fields.entityId", {
              defaultValue: "ID Entidad",
            }),
            view.entidadId
          )}
          ${row(t("bitacora.eventDetail.fields.ip", { defaultValue: "IP" }), view.ip)}
          ${row(
            t("bitacora.eventDetail.fields.source", { defaultValue: "Source" }),
            view.source
          )}
          ${row(
            t("bitacora.eventDetail.fields.priority", {
              defaultValue: "Prioridad",
            }),
            view.prioridad
          )}
          ${row(
            t("bitacora.eventDetail.fields.status", { defaultValue: "Estado" }),
            view.estado
          )}
          ${row(
            t("bitacora.eventDetail.fields.relatedName", {
              defaultValue: "Nombre relacionado",
            }),
            view.nombre
          )}
          ${row(
            t("bitacora.eventDetail.fields.companyZone", {
              defaultValue: "Empresa / Zona",
            }),
            view.empresa
          )}
          ${row(
            t("bitacora.eventDetail.fields.actorId", {
              defaultValue: "Actor ID",
            }),
            view.actorId
          )}
          ${row(
            t("bitacora.eventDetail.fields.userAgent", {
              defaultValue: "User Agent",
            }),
            view.userAgent
          )}
          ${row(
            t("bitacora.eventDetail.fields.archived", {
              defaultValue: "Archivado",
            }),
            view.archived
              ? t("common.yes", { defaultValue: "Sí" })
              : t("common.no", { defaultValue: "No" })
          )}
          ${row(
            t("bitacora.eventDetail.fields.archivedBy", {
              defaultValue: "Archivado por",
            }),
            view.archivedBy
          )}
          ${row(
            t("bitacora.eventDetail.fields.archivedAt", {
              defaultValue: "Fecha archivado",
            }),
            view.archivedAt
          )}
          ${row(
            t("bitacora.eventDetail.fields.visible", {
              defaultValue: "Visible",
            }),
            view.visible
              ? t("common.yes", { defaultValue: "Sí" })
              : t("common.no", { defaultValue: "No" })
          )}
        </div>

        <section class="section">
          <div class="section-title">${esc(
            t("bitacora.eventDetail.sections.title", { defaultValue: "Título" })
          )}</div>
          <div class="section-body">${esc(rawValue(view.titulo, t))}</div>
        </section>

        <section class="section">
          <div class="section-title">${esc(
            t("bitacora.eventDetail.sections.description", {
              defaultValue: "Descripción",
            })
          )}</div>
          <div class="section-body">${esc(rawValue(view.descripcion, t))}</div>
        </section>

        ${
          view.meta && typeof view.meta === "object"
            ? jsonBlock(
                t("bitacora.eventDetail.sections.meta", {
                  defaultValue: "Meta",
                }),
                view.meta
              )
            : ""
        }

        ${
          view.before !== undefined && view.before !== null && view.before !== ""
            ? jsonBlock(
                t("bitacora.eventDetail.sections.before", {
                  defaultValue: "Before",
                }),
                view.before
              )
            : ""
        }

        ${
          view.after !== undefined && view.after !== null && view.after !== ""
            ? jsonBlock(
                t("bitacora.eventDetail.sections.after", {
                  defaultValue: "After",
                }),
                view.after
              )
            : ""
        }
      </body>
    </html>
  `;
}

function i18nLangFromT(t) {
  return t?.i18n?.language || "es";
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

function exportEventPdf(view, t) {
  const html = buildPdfHtml(view, t);

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
    alert(
      t("bitacora.eventDetail.errors.pdfFailed", {
        defaultValue: "No se pudo generar el PDF.",
      })
    );
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
      alert(
        t("bitacora.eventDetail.errors.pdfFailed", {
          defaultValue: "No se pudo generar el PDF.",
        })
      );
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
  const { t } = useTranslation();

  return (
    <div className="bitacora-modal-section">
      <div className="bitacora-modal-section-head">
        <div className="bitacora-modal-section-title">{title}</div>
      </div>
      <div className="bitacora-modal-section-body">
        <pre className="bitacora-modal-pre rounded-xl bg-black/5 p-3 text-xs leading-relaxed dark:bg-white/5">
          {pretty(data, t)}
        </pre>
      </div>
    </div>
  );
}

function MetaItem({ label, value }) {
  const { t } = useTranslation();

  return (
    <div className="bitacora-modal-card">
      <div className="bitacora-modal-label">{label}</div>
      <div className="bitacora-modal-value">{pretty(value, t)}</div>
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
  const { t } = useTranslation();

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
    exportEventPdf(view, t);
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
            <div className="bitacora-modal-title">
              {t("bitacora.eventDetail.title", {
                defaultValue: "Detalle del Evento",
              })}
            </div>
            <div className="bitacora-modal-subtitle">
              {t("bitacora.eventDetail.subtitle", {
                defaultValue: "Vista completa de auditoría y trazabilidad",
              })}
            </div>
          </div>

          <button
            type="button"
            onClick={handleClose}
            className="bitacora-modal-close"
            aria-label={t("actions.close", { defaultValue: "Cerrar" })}
            disabled={deleting}
          >
            ✕
          </button>
        </div>

        <div className="bitacora-modal-body">
          {loading && (
            <div className="bitacora-modal-card mb-4 text-sm opacity-80">
              {t("bitacora.eventDetail.loading", {
                defaultValue: "Cargando detalle del evento…",
              })}
            </div>
          )}

          {!!error && (
            <div className="mb-4 rounded-xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-300">
              {error}
            </div>
          )}

          <div className="bitacora-modal-grid">
            <MetaItem
              label={t("bitacora.eventDetail.fields.dateTime", {
                defaultValue: "Fecha y Hora",
              })}
              value={view.fecha}
            />
            <MetaItem
              label={t("bitacora.eventDetail.fields.module", {
                defaultValue: "Módulo",
              })}
              value={view.modulo}
            />
            <MetaItem
              label={t("bitacora.eventDetail.fields.type", {
                defaultValue: "Tipo",
              })}
              value={view.tipo}
            />
            <MetaItem
              label={t("bitacora.eventDetail.fields.action", {
                defaultValue: "Acción",
              })}
              value={view.accion}
            />

            <MetaItem
              label={t("bitacora.eventDetail.fields.agent", {
                defaultValue: "Agente",
              })}
              value={view.agente}
            />
            <MetaItem
              label={t("bitacora.eventDetail.fields.actor", {
                defaultValue: "Actor",
              })}
              value={view.actorEmail || view.nombre}
            />
            <MetaItem
              label={t("bitacora.eventDetail.fields.actorRole", {
                defaultValue: "Rol del actor",
              })}
              value={view.actorRol}
            />
            <MetaItem
              label={t("bitacora.eventDetail.fields.shift", {
                defaultValue: "Turno",
              })}
              value={view.turno}
            />

            <MetaItem
              label={t("bitacora.eventDetail.fields.entity", {
                defaultValue: "Entidad",
              })}
              value={view.entidad}
            />
            <MetaItem
              label={t("bitacora.eventDetail.fields.entityId", {
                defaultValue: "ID Entidad",
              })}
              value={view.entidadId}
            />
            <MetaItem
              label={t("bitacora.eventDetail.fields.ip", {
                defaultValue: "IP",
              })}
              value={view.ip}
            />
            <MetaItem
              label={t("bitacora.eventDetail.fields.source", {
                defaultValue: "Source",
              })}
              value={view.source}
            />
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="bitacora-modal-card flex items-center justify-between gap-3">
              <div>
                <div className="bitacora-modal-label">
                  {t("bitacora.eventDetail.fields.priority", {
                    defaultValue: "Prioridad",
                  })}
                </div>
                <div className="mt-1">
                  <Pill tone={prioridadTone(view.prioridad)}>
                    {view.prioridad ||
                      t("bitacora.eventDetail.empty", { defaultValue: "—" })}
                  </Pill>
                </div>
              </div>
            </div>

            <div className="bitacora-modal-card flex items-center justify-between gap-3">
              <div>
                <div className="bitacora-modal-label">
                  {t("bitacora.eventDetail.fields.status", {
                    defaultValue: "Estado",
                  })}
                </div>
                <div className="mt-1">
                  <Pill tone={estadoTone(view.estado)}>
                    {view.estado ||
                      t("bitacora.eventDetail.empty", { defaultValue: "—" })}
                  </Pill>
                </div>
              </div>
            </div>
          </div>

          <div className="bitacora-modal-section">
            <div className="bitacora-modal-section-head">
              <div className="bitacora-modal-section-title">
                {t("bitacora.eventDetail.sections.title", {
                  defaultValue: "Título",
                })}
              </div>
            </div>
            <div className="bitacora-modal-section-body">
              <div className="bitacora-modal-value whitespace-pre-wrap leading-relaxed">
                {view.titulo ||
                  t("bitacora.eventDetail.empty", { defaultValue: "—" })}
              </div>
            </div>
          </div>

          <div className="bitacora-modal-section">
            <div className="bitacora-modal-section-head">
              <div className="bitacora-modal-section-title">
                {t("bitacora.eventDetail.sections.description", {
                  defaultValue: "Descripción",
                })}
              </div>
            </div>
            <div className="bitacora-modal-section-body">
              <div className="whitespace-pre-wrap leading-relaxed text-[15px] text-[var(--text)]">
                {view.descripcion ||
                  t("bitacora.eventDetail.empty", { defaultValue: "—" })}
              </div>
            </div>
          </div>

          <div className="mt-4 bitacora-modal-grid">
            <MetaItem
              label={t("bitacora.eventDetail.fields.relatedName", {
                defaultValue: "Nombre relacionado",
              })}
              value={view.nombre}
            />
            <MetaItem
              label={t("bitacora.eventDetail.fields.companyZone", {
                defaultValue: "Empresa / Zona",
              })}
              value={view.empresa}
            />
            <MetaItem
              label={t("bitacora.eventDetail.fields.actorId", {
                defaultValue: "Actor ID",
              })}
              value={view.actorId}
            />
            <MetaItem
              label={t("bitacora.eventDetail.fields.userAgent", {
                defaultValue: "User Agent",
              })}
              value={view.userAgent}
            />
            <MetaItem
              label={t("bitacora.eventDetail.fields.archived", {
                defaultValue: "Archivado",
              })}
              value={
                view.archived
                  ? t("common.yes", { defaultValue: "Sí" })
                  : t("common.no", { defaultValue: "No" })
              }
            />
            <MetaItem
              label={t("bitacora.eventDetail.fields.archivedBy", {
                defaultValue: "Archivado por",
              })}
              value={view.archivedBy}
            />
            <MetaItem
              label={t("bitacora.eventDetail.fields.archivedAt", {
                defaultValue: "Fecha archivado",
              })}
              value={view.archivedAt}
            />
            <MetaItem
              label={t("bitacora.eventDetail.fields.visible", {
                defaultValue: "Visible",
              })}
              value={view.visible}
            />
          </div>

          {hasMeta && (
            <JsonBlock
              title={t("bitacora.eventDetail.sections.meta", {
                defaultValue: "Meta",
              })}
              data={view.meta}
            />
          )}

          {(hasBefore || hasAfter) && (
            <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
              <JsonBlock
                title={t("bitacora.eventDetail.sections.before", {
                  defaultValue: "Before",
                })}
                data={view.before}
              />
              <JsonBlock
                title={t("bitacora.eventDetail.sections.after", {
                  defaultValue: "After",
                })}
                data={view.after}
              />
            </div>
          )}

          <div className="bitacora-modal-actions">
            <button
              type="button"
              onClick={handleClose}
              disabled={deleting}
              className="bitacora-modal-btn disabled:cursor-not-allowed disabled:opacity-60"
            >
              {t("actions.close", { defaultValue: "Cerrar" })}
            </button>

            <button
              type="button"
              onClick={handleExportPdf}
              disabled={deleting || loading}
              className="bitacora-modal-btn disabled:cursor-not-allowed disabled:opacity-60"
            >
              {t("bitacora.eventDetail.actions.exportPdf", {
                defaultValue: "Exportar PDF",
              })}
            </button>

            <button
              type="button"
              onClick={handleExportJson}
              disabled={deleting || loading}
              className="bitacora-modal-btn disabled:cursor-not-allowed disabled:opacity-60"
            >
              {t("bitacora.eventDetail.actions.exportJson", {
                defaultValue: "Exportar JSON",
              })}
            </button>

            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              className="bitacora-modal-btn bitacora-modal-btn--danger disabled:cursor-not-allowed disabled:opacity-60"
            >
              {deleting
                ? t("bitacora.eventDetail.actions.archiving", {
                    defaultValue: "Archivando...",
                  })
                : t("bitacora.eventDetail.actions.archive", {
                    defaultValue: "Archivar",
                  })}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}