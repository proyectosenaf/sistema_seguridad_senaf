import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import QRCode from "qrcode";

export const ROOT = (
  import.meta.env.VITE_API_BASE_URL ||
  import.meta.env.VITE_API_URL ||
  "http://localhost:4000/api"
).replace(/\/$/, "");

export const VISITAS_API_URL = `${ROOT}/visitas/v1/visitas`;
export const CITAS_API_URL = `${ROOT}/citas`;

export const STORAGE_KEY = "visitas_demo";
export const CITA_STORAGE_KEY = "citas_demo";
export const QR_PREFIX = "SENAF_CITA_QR::";

export function normalizeEmail(v) {
  return String(v || "").trim().toLowerCase();
}

export function normalizeDoc(v) {
  return String(v || "").replace(/\D/g, "");
}

export function normalizeRoleName(v) {
  return String(v || "").trim().toLowerCase();
}

export function normalizeCompanionItem(item) {
  return {
    id:
      item?.id ||
      item?._id ||
      `comp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: String(item?.name || item?.nombre || "").trim(),
    document: String(
      item?.document || item?.documento || item?.dni || ""
    ).trim(),
  };
}

export function formatCompanionsSummary(list) {
  if (!Array.isArray(list) || list.length === 0) return "—";

  return list
    .map((item) => {
      const n = String(item?.name || "").trim();
      const d = String(item?.document || "").trim();
      if (n && d) return `${n} (${d})`;
      return n || d || "";
    })
    .filter(Boolean)
    .join(" | ");
}

export function resolveAuthPrincipal(auth) {
  const raw = auth?.me || auth?.user || null;
  if (!raw || typeof raw !== "object") return null;

  const nestedRoles = Array.isArray(raw.user?.roles) ? raw.user.roles : [];
  const directRoles = Array.isArray(raw.roles) ? raw.roles : [];
  const role =
    raw.role ||
    raw.rol ||
    raw.user?.role ||
    raw.user?.rol ||
    raw.profile?.role ||
    raw.profile?.rol ||
    "";

  const roles = [...directRoles, ...nestedRoles, role].filter(Boolean);

  const email =
    normalizeEmail(raw.email) ||
    normalizeEmail(raw.user?.email) ||
    normalizeEmail(raw.profile?.email) ||
    "";

  const document =
    normalizeDoc(raw.documento) ||
    normalizeDoc(raw.document) ||
    normalizeDoc(raw.dni) ||
    normalizeDoc(raw.user?.documento) ||
    normalizeDoc(raw.user?.document) ||
    normalizeDoc(raw.user?.dni) ||
    "";

  const roleSet = new Set(roles.map((r) => normalizeRoleName(r)));

  const hint = (() => {
    try {
      return localStorage.getItem("senaf_is_visitor") === "1";
    } catch {
      return false;
    }
  })();

  return {
    raw,
    email,
    document,
    roles,
    isVisitor:
      hint ||
      roleSet.has("visita") ||
      roleSet.has("visitor") ||
      roleSet.has("visitante"),
  };
}

export function citaBelongsToVisitor(cita, principal) {
  const email = normalizeEmail(principal?.email);
  const doc = normalizeDoc(principal?.document);

  const candidateEmails = [
    cita?.correo,
    cita?.email,
    cita?.visitorEmail,
    cita?.visitanteEmail,
    cita?.createdByEmail,
    cita?.solicitanteEmail,
    cita?.userEmail,
  ]
    .map(normalizeEmail)
    .filter(Boolean);

  const candidateDocs = [
    cita?.documento,
    cita?.document,
    cita?.dni,
    cita?.createdByDocument,
  ]
    .map(normalizeDoc)
    .filter(Boolean);

  if (email && candidateEmails.includes(email)) return true;
  if (doc && candidateDocs.includes(doc)) return true;

  return false;
}

export function visitaBelongsToVisitor(visita, principal) {
  const email = normalizeEmail(principal?.email);
  const doc = normalizeDoc(principal?.document);

  const candidateEmails = [
    visita?.email,
    visita?.correo,
    visita?.visitorEmail,
    visita?.visitanteEmail,
    visita?.createdByEmail,
    visita?.userEmail,
  ]
    .map(normalizeEmail)
    .filter(Boolean);

  const candidateDocs = [visita?.documento, visita?.document, visita?.dni]
    .map(normalizeDoc)
    .filter(Boolean);

  if (email && candidateEmails.includes(email)) return true;
  if (doc && candidateDocs.includes(doc)) return true;

  return false;
}

export function getTodayRange() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}

export function normalizeCitaEstado(value) {
  const raw = String(value || "").trim().toLowerCase();

  const map = {
    solicitada: "Programada",
    programada: "Programada",

    "en revisión": "En revisión",
    "en revision": "En revisión",
    en_revision: "En revisión",

    autorizada: "Autorizada",
    autorizado: "Autorizada",

    denegada: "Denegada",
    denegado: "Denegada",

    cancelada: "Cancelada",
    cancelado: "Cancelada",

    dentro: "Dentro",
    ingresada: "Dentro",
    ingresado: "Dentro",

    finalizada: "Finalizada",
    finalizado: "Finalizada",
  };

  return map[raw] || (String(value || "").trim() || "Programada");
}

export function prettyCitaEstado(value) {
  const estado = normalizeCitaEstado(value);

  switch (estado) {
    case "Programada":
      return "programada";
    case "En revisión":
      return "en revisión";
    case "Autorizada":
      return "autorizada";
    case "Denegada":
      return "denegada";
    case "Cancelada":
      return "cancelada";
    case "Dentro":
      return "ingresada";
    case "Finalizada":
      return "finalizada";
    default:
      return String(estado || "programada").toLowerCase();
  }
}

export function stripDiacritics(str) {
  if (!str) return str;
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

export function safeJsonStringify(value) {
  try {
    return JSON.stringify(value);
  } catch {
    return "";
  }
}

export function normalizeQrPayloadValue(payload) {
  if (payload == null) return "";

  if (typeof payload === "string") {
    const trimmed = payload.trim();
    if (!trimmed) return "";
    if (trimmed === "[object Object]") return "";
    return trimmed;
  }

  if (typeof payload === "object") {
    const json = safeJsonStringify(payload);
    return json.trim();
  }

  const primitive = String(payload).trim();
  if (!primitive || primitive === "[object Object]") return "";
  return primitive;
}

function parseCitaDate(cita) {
  if (cita?.citaAt instanceof Date && !Number.isNaN(cita.citaAt.getTime())) {
    return cita.citaAt;
  }

  if (cita?.citaAt) {
    const temp = new Date(cita.citaAt);
    if (!Number.isNaN(temp.getTime())) return temp;
  }

  if (cita?.fecha && cita?.hora) {
    const temp = new Date(`${cita.fecha}T${cita.hora}:00`);
    if (!Number.isNaN(temp.getTime())) return temp;
  }

  return null;
}

function shouldKeepQrFieldsForCita(cita) {
  const estado = normalizeCitaEstado(cita?.estado);
  return estado === "Autorizada" || estado === "Dentro";
}

function sanitizeCitaQrFields(cita = {}) {
  const keepQr = shouldKeepQrFieldsForCita(cita);

  return {
    ...cita,
    qrDataUrl: keepQr ? String(cita?.qrDataUrl || "").trim() : "",
    qrPayload: keepQr ? cita?.qrPayload ?? "" : "",
    qrToken: keepQr ? String(cita?.qrToken || "").trim() : "",
  };
}

export function buildQrValueForCita(cita) {
  if (!cita) return "";

  if (cita.qrToken && String(cita.qrToken).trim()) {
    return `${QR_PREFIX}${String(cita.qrToken).trim()}`;
  }

  const normalizedQrPayload = normalizeQrPayloadValue(cita.qrPayload);
  if (normalizedQrPayload) {
    return stripDiacritics(normalizedQrPayload);
  }

  const nombre = cita.nombre || cita.visitante || "Visitante";
  const documento = cita.documento || "No especificado";
  const empresa = cita.empresa || "—";
  const empleado = cita.empleado || "—";
  const motivo = cita.motivo || "—";

  const citaDate = parseCitaDate(cita);

  let fecha = "—";
  let hora = "—";

  if (citaDate) {
    fecha = citaDate.toLocaleDateString("es-ES", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
    hora = citaDate.toLocaleTimeString("es-ES", {
      hour: "2-digit",
      minute: "2-digit",
    });
  } else {
    if (cita.fecha) fecha = cita.fecha;
    if (cita.hora) hora = cita.hora;
  }

  const estadoLegible = prettyCitaEstado(cita.estado);

  const text = [
    "INVITACION DE VISITA",
    "------------------------",
    `Visitante: ${nombre}`,
    `Documento: ${documento}`,
    `Empresa: ${empresa}`,
    `Visita a: ${empleado}`,
    `Motivo: ${motivo}`,
    `Fecha: ${fecha}`,
    `Hora: ${hora}`,
    `Estado: ${estadoLegible}`,
  ].join("\n");

  return stripDiacritics(text);
}

export function getRenderableQrValue(cita) {
  const value = buildQrValueForCita(cita);
  return typeof value === "string" ? value.trim() : "";
}

export async function resolveQrImageDataUrl(cita) {
  if (cita?.qrDataUrl && String(cita.qrDataUrl).trim()) {
    return String(cita.qrDataUrl).trim();
  }

  const value = getRenderableQrValue(cita);
  if (!value) return "";

  try {
    return await QRCode.toDataURL(value, {
      width: 320,
      margin: 1,
      errorCorrectionLevel: "M",
    });
  } catch (err) {
    console.warn("[visitas] no se pudo generar imagen QR:", err);
    return "";
  }
}

export function buildQrDownloadFilename(cita) {
  const nombre = String(cita?.nombre || cita?.visitante || "cita")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-_]/g, "");

  const documento = String(cita?.documento || "")
    .trim()
    .replace(/\s+/g, "")
    .replace(/[^a-zA-Z0-9-_]/g, "");

  const citaDate = parseCitaDate(cita);
  const fecha = citaDate
    ? citaDate.toISOString().slice(0, 10)
    : String(cita?.fecha || "").replace(/\//g, "-");

  return `senaf-cita-${nombre || "qr"}${documento ? `-${documento}` : ""}${
    fecha ? `-${fecha}` : ""
  }.png`;
}

export async function downloadQrCita(cita) {
  const dataUrl = await resolveQrImageDataUrl(cita);
  if (!dataUrl) return;

  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = buildQrDownloadFilename(cita);
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

export async function printQrCita(cita) {
  const dataUrl = await resolveQrImageDataUrl(cita);
  if (!dataUrl) return;

  const win = window.open("", "_blank", "width=900,height=720");
  if (!win) return;

  const citaDate = parseCitaDate(cita);

  const fecha = citaDate
    ? citaDate.toLocaleDateString("es-HN")
    : cita?.fecha || "—";

  const hora = citaDate
    ? citaDate.toLocaleTimeString("es-HN", {
        hour: "2-digit",
        minute: "2-digit",
      })
    : cita?.hora || "—";

  const acompanantes =
    Array.isArray(cita?.acompanantes) && cita.acompanantes.length
      ? `
        <div class="row"><span class="label">Acompañantes:</span></div>
        <ul class="companions">
          ${cita.acompanantes
            .map(
              (comp) =>
                `<li>${String(comp?.nombre || "").trim()}${
                  comp?.documento ? ` — ${String(comp.documento).trim()}` : ""
                }</li>`
            )
            .join("")}
        </ul>
      `
      : "";

  win.document.open();
  win.document.write(`
    <!doctype html>
    <html lang="es">
      <head>
        <meta charset="utf-8" />
        <title>QR de cita SENAF</title>
        <style>
          body { font-family: Arial, Helvetica, sans-serif; color: #0f172a; padding: 24px; }
          .card { max-width: 760px; margin: 0 auto; border: 1px solid #cbd5e1; border-radius: 20px; padding: 24px; }
          .title { font-size: 30px; font-weight: 700; margin-bottom: 8px; }
          .subtitle { font-size: 16px; color: #475569; margin-bottom: 18px; line-height: 1.5; }
          .qr { text-align: center; margin: 18px 0 24px; }
          .qr img { width: 300px; height: 300px; object-fit: contain; border: 1px solid #e2e8f0; border-radius: 18px; padding: 12px; background: #fff; }
          .details { border: 1px solid #cbd5e1; border-radius: 16px; padding: 18px; background: #f8fafc; }
          .row { margin: 8px 0; font-size: 18px; line-height: 1.5; }
          .label { font-weight: 700; }
          .companions { margin: 8px 0 0 20px; padding: 0; font-size: 17px; line-height: 1.5; }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="title">Cita agendada</div>
          <div class="subtitle">Presente este código QR al guardia para validar su ingreso.</div>
          <div class="qr"><img src="${dataUrl}" alt="QR de cita" /></div>
          <div class="details">
            <div class="row"><span class="label">Visitante:</span> ${String(cita?.nombre || cita?.visitante || "").trim()}</div>
            <div class="row"><span class="label">Documento:</span> ${String(cita?.documento || "").trim()}</div>
            <div class="row"><span class="label">Empleado:</span> ${String(cita?.empleado || "").trim()}</div>
            <div class="row"><span class="label">Motivo:</span> ${String(cita?.motivo || "").trim()}</div>
            <div class="row"><span class="label">Fecha:</span> ${fecha}</div>
            <div class="row"><span class="label">Hora:</span> ${hora}</div>
            ${acompanantes}
          </div>
        </div>
      </body>
    </html>
  `);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 300);
}

export function saveToStorage(next) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch (e) {
    console.warn("[visitas] no se pudo guardar en localStorage:", e);
  }
}

/**
 * Citas de negocio NO se guardan en localStorage.
 * Se deja la función por compatibilidad.
 */
export function saveCitasToStorage(_next) {
  try {
    localStorage.removeItem(CITA_STORAGE_KEY);
  } catch (e) {
    console.warn("[citas] no se pudo limpiar localStorage:", e);
  }
}

export function loadFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];

    return arr.map((v) => ({
      ...v,
      entryAt: v.entryAt ? new Date(v.entryAt) : null,
      exitAt: v.exitAt ? new Date(v.exitAt) : null,
      kind: v.kind || "Presencial",
      acompanado: !!v.acompanado,
      acompanantes: Array.isArray(v.acompanantes)
        ? v.acompanantes.map(normalizeCompanionItem)
        : [],
      companionsSummary: formatCompanionsSummary(v.acompanantes || []),
    }));
  } catch (e) {
    console.warn("[visitas] no se pudo leer de localStorage:", e);
    return [];
  }
}

/**
 * Citas de negocio NO se cargan desde localStorage.
 * Se deja la función por compatibilidad.
 */
export function loadCitasFromStorage() {
  return [];
}

export function normalizeVisitFromServer(v) {
  const id = v?._id || v?.id || `local-${Date.now()}-${Math.random()}`;
  const entryAt = v?.fechaEntrada
    ? new Date(v.fechaEntrada)
    : v?.entryAt
    ? new Date(v.entryAt)
    : null;
  const exitAt = v?.fechaSalida
    ? new Date(v.fechaSalida)
    : v?.exitAt
    ? new Date(v.exitAt)
    : null;
  const vehiculo = v?.vehiculo || null;

  const vehicleBrand =
    vehiculo?.marca || vehiculo?.brand || v?.vehicleBrand || "";
  const vehicleModel =
    vehiculo?.modelo || vehiculo?.model || v?.vehicleModel || "";
  const vehiclePlate =
    vehiculo?.placa || vehiculo?.plate || v?.vehiclePlate || "";

  const vehicleSummary =
    vehicleBrand || vehicleModel || vehiclePlate
      ? `${vehicleBrand || "N/D"}${vehicleModel ? ` ${vehicleModel}` : ""}${
          vehiclePlate ? ` (${vehiclePlate})` : ""
        }`
      : "—";

  const acompanantes = Array.isArray(v?.acompanantes)
    ? v.acompanantes.map(normalizeCompanionItem)
    : [];

  return {
    id,
    _id: id,
    kind: v?.tipo || v?.kind || "Presencial",
    name: v?.nombre || v?.name || "",
    document: v?.documento || v?.document || v?.dni || "",
    company: v?.empresa || v?.company || "—",
    employee: v?.empleado || v?.employee || "—",
    phone: v?.telefono || v?.phone || "",
    email: v?.correo || v?.email || "",
    reason: v?.motivo || v?.reason || "",
    entry:
      entryAt && !Number.isNaN(entryAt.getTime())
        ? `${entryAt.toLocaleDateString("es-ES", {
            day: "2-digit",
            month: "2-digit",
          })}, ${entryAt.toLocaleTimeString("es-ES", {
            hour: "2-digit",
            minute: "2-digit",
          })}`
        : "—",
    exit:
      exitAt && !Number.isNaN(exitAt.getTime())
        ? `${exitAt.toLocaleDateString("es-ES", {
            day: "2-digit",
            month: "2-digit",
          })}, ${exitAt.toLocaleTimeString("es-ES", {
            hour: "2-digit",
            minute: "2-digit",
          })}`
        : "-",
    status: v?.estado || v?.status || "Dentro",
    entryAt,
    exitAt,
    vehicleBrand,
    vehicleModel,
    vehiclePlate,
    vehicleSummary,
    acompanado: !!v?.acompanado || acompanantes.length > 0,
    acompanantes,
    companionsSummary: formatCompanionsSummary(acompanantes),
    raw: v,
  };
}

export function normalizeCitaFromServer(c, index = 0) {
  const id = c?._id || c?.id || `server-cita-${index}`;
  const citaAt = parseCitaDate(c);
  const estado = normalizeCitaEstado(c?.estado);

  return sanitizeCitaQrFields({
    ...c,
    _id: id,
    id,
    citaAt,
    estado,
  });
}

export function mergeVisitLists(serverList, localList) {
  const map = new Map();

  for (const item of localList) {
    map.set(item.id, item);
  }

  for (const item of serverList) {
    map.set(item.id, {
      ...(map.get(item.id) || {}),
      ...item,
    });
  }

  return Array.from(map.values()).sort((a, b) => {
    const da = a.entryAt instanceof Date ? a.entryAt.getTime() : 0;
    const db = b.entryAt instanceof Date ? b.entryAt.getTime() : 0;
    return db - da;
  });
}

/**
 * Para citas:
 * - el backend manda siempre
 * - local no puede pisar estados, QR ni horarios oficiales
 */
export function mergeCitaLists(serverList, localList) {
  const map = new Map();

  for (const raw of serverList || []) {
    const item = sanitizeCitaQrFields({
      ...raw,
      _id: raw?._id || raw?.id,
      id: raw?.id || raw?._id,
      citaAt: parseCitaDate(raw),
      estado: normalizeCitaEstado(raw?.estado),
    });

    if (!item._id) continue;
    map.set(String(item._id), item);
  }

  for (const raw of localList || []) {
    const id = raw?._id || raw?.id;
    if (!id) continue;

    if (map.has(String(id))) {
      continue;
    }

    const item = sanitizeCitaQrFields({
      ...raw,
      _id: id,
      id,
      citaAt: parseCitaDate(raw),
      estado: normalizeCitaEstado(raw?.estado),
    });

    map.set(String(id), item);
  }

  return Array.from(map.values()).sort((a, b) => {
    const da = a.citaAt instanceof Date ? a.citaAt.getTime() : 0;
    const db = b.citaAt instanceof Date ? b.citaAt.getTime() : 0;
    return da - db;
  });
}

export function buildExportRows(list) {
  return list.map((v) => ({
    Visitante: v.name || "",
    DNI: v.document || "",
    Empresa: v.company || "",
    Empleado: v.employee || "",
    Tipo: v.kind || "",
    Acompanado: v.acompanado ? "Sí" : "No",
    Acompanantes: v.companionsSummary || "—",
    VehiculoMarca: v.vehicleBrand || "",
    VehiculoModelo: v.vehicleModel || "",
    VehiculoPlaca: v.vehiclePlate || "",
    Entrada: v.entry || "",
    Salida: v.exit || "",
    Estado: v.status || "",
  }));
}

export async function exportExcel(list) {
  const rows = buildExportRows(list);
  if (rows.length === 0) {
    alert("No hay datos para exportar.");
    return;
  }

  try {
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Visitas");
    const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    const blob = new Blob([wbout], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const ts = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
    a.download = `visitas-${ts}.xlsx`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  } catch (err) {
    console.warn("Error generando XLSX:", err);
  }
}

export function exportPDF(list) {
  const rows = buildExportRows(list);
  if (rows.length === 0) {
    alert("No hay datos para exportar.");
    return;
  }

  try {
    const doc = new jsPDF({
      orientation: "landscape",
      unit: "pt",
      format: "a4",
    });

    doc.setFontSize(14);
    doc.text("Reporte de Visitantes SENAF", 40, 40);

    const headers = Object.keys(rows[0]);
    const body = rows.map((r) => headers.map((h) => String(r[h] ?? "")));

    autoTable(doc, {
      startY: 60,
      head: [headers],
      body,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [30, 30, 30], textColor: 255 },
      theme: "grid",
      margin: { left: 20, right: 20 },
    });

    const ts = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
    doc.save(`visitas-${ts}.pdf`);
  } catch (err) {
    console.error("Error generando PDF con jsPDF:", err);
    alert(
      "No se pudo generar PDF automáticamente. Revisa las dependencias (jspdf, jspdf-autotable)."
    );
  }
}

export function buildExportCitasRows(list) {
  return list.map((c) => {
    const tipoLegible =
      c.tipoCita === "profesional"
        ? "Profesional"
        : c.tipoCita === "personal"
        ? "Personal"
        : "";

    const citaDate = parseCitaDate(c);

    let fecha = "";
    let hora = "";

    if (citaDate) {
      fecha = citaDate.toLocaleDateString("es-ES", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });
      hora = citaDate.toLocaleTimeString("es-ES", {
        hour: "2-digit",
        minute: "2-digit",
      });
    } else {
      fecha = c.fecha || "";
      hora = c.hora || "";
    }

    return {
      Visitante: c.nombre || c.visitante || "",
      DNI: c.documento || "",
      Empresa: c.empresa || "",
      Empleado: c.empleado || "",
      Motivo: c.motivo || "",
      Telefono: c.telefono || "",
      TipoCita: tipoLegible,
      Fecha: fecha,
      Hora: hora,
      Estado: prettyCitaEstado(c.estado),
    };
  });
}

export async function exportCitasExcel(list) {
  const rows = buildExportCitasRows(list);
  if (rows.length === 0) {
    alert("No hay citas para exportar.");
    return;
  }

  try {
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Citas");
    const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    const blob = new Blob([wbout], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const ts = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
    a.download = `citas-${ts}.xlsx`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  } catch (err) {
    console.warn("Error generando XLSX de citas:", err);
  }
}

export function exportCitasPDF(list) {
  const rows = buildExportCitasRows(list);
  if (rows.length === 0) {
    alert("No hay citas para exportar.");
    return;
  }

  try {
    const doc = new jsPDF({
      orientation: "landscape",
      unit: "pt",
      format: "a4",
    });

    doc.setFontSize(14);
    doc.text("Reporte de Citas (pre-registro)", 40, 40);

    const headers = Object.keys(rows[0]);
    const body = rows.map((r) => headers.map((h) => String(r[h] ?? "")));

    autoTable(doc, {
      startY: 60,
      head: [headers],
      body,
      styles: { fontSize: 9 },
      headStyles: { fillColor: [30, 30, 30], textColor: 255 },
      theme: "grid",
      margin: { left: 20, right: 20 },
    });

    const ts = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
    doc.save(`citas-${ts}.pdf`);
  } catch (err) {
    console.error("Error generando PDF de citas:", err);
    alert(
      "No se pudo generar el PDF de citas. Revisa las dependencias (jspdf, jspdf-autotable)."
    );
  }
}