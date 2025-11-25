// client/src/pages/Evaluacion/Evaluacion.jsx
import React from "react";
import { api } from "../../lib/api.js";

/* =========================
   Utils
========================= */
const toYYYYMM = (d) => new Date(d).toISOString().slice(0, 7);
const monthName = (yyyyMM) => {
  const [y, m] = (yyyyMM || "").split("-").map(Number);
  if (!y || !m) return yyyyMM || "—";
  const dt = new Date(Date.UTC(y, m - 1, 1));
  return dt.toLocaleDateString(undefined, { month: "long", year: "numeric" });
};
const clamp = (n) => Math.max(0, Math.min(100, Math.round(n)));
const pct = (done, total) => {
  const d = Number(done ?? 0);
  const t = Number(total ?? 0);
  if (!t || Number.isNaN(d) || Number.isNaN(t)) return 0;
  return clamp((d / t) * 100);
};

// Valida formato AAAA-MM-DD
const isValidISODate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s || "");

// Calcula tipo de evaluación según rango de días
const calcTipoEvaluacion = (inicio, fin) => {
  if (!isValidISODate(inicio) || !isValidISODate(fin)) return "Mensual";
  const d1 = new Date(inicio + "T00:00:00");
  const d2 = new Date(fin + "T00:00:00");
  if (Number.isNaN(d1.getTime()) || Number.isNaN(d2.getTime()) || d2 < d1) {
    return "Mensual";
  }
  const diffMs = d2.getTime() - d1.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1;

  if (diffDays <= 31) return "Mensual";
  if (diffDays <= 93) return "Trimestral";
  if (diffDays <= 183) return "Semestral";
  return "Anual";
};

// ✅ Rendimiento basado SOLO en puntualidad y tareas
const computeRendimiento = (item) => {
  const p = Number(item?.puntualidad ?? 0);
  const t = Number(item?.tareas ?? 0);
  if (Number.isNaN(p) || Number.isNaN(t)) return 0;
  return clamp((p + t) / 2);
};

function normalizeEmployees(rows) {
  const byEmp = new Map();
  for (const r of rows || []) {
    const name =
      r?.empleado?.nombre ??
      r?.empleado ??
      r?.nombre ??
      r?.name ??
      "—";
    if (!byEmp.has(name)) {
      byEmp.set(name, {
        name,
        diasPuntuales: 0,
        diasTotales: 0,
        tardanzas: 0,
        tareasCompletadas: 0,
        tareasTotales: 0,
        pendientes: 0,
      });
    }
    const e = byEmp.get(name);

    const puntuales = Number(
      r?.puntuales ?? r?.diasPuntuales ?? r?.horarios?.puntuales
    );
    const diasTot = Number(
      r?.totalDias ?? r?.diasTotales ?? r?.horarios?.totales
    );
    const tard = Number(
      r?.tardanzas ?? r?.horarios?.tardanzas
    );

    const comp = Number(
      r?.completadas ??
      r?.tareasCompletadas ??
      r?.tareas?.completadas
    );
    const tot = Number(
      r?.totalTareas ?? r?.tareasTotales ?? r?.tareas?.totales
    );
    const pen = Number(
      r?.pendientes ?? r?.tareasPendientes ?? r?.tareas?.pendientes
    );

    if (!Number.isNaN(puntuales)) e.diasPuntuales += puntuales;
    if (!Number.isNaN(diasTot)) e.diasTotales += diasTot;
    if (!Number.isNaN(tard)) e.tardanzas += tard;

    if (!Number.isNaN(comp)) e.tareasCompletadas += comp;
    if (!Number.isNaN(tot)) e.tareasTotales += tot;
    if (!Number.isNaN(pen)) e.pendientes += pen;
  }
  return Array.from(byEmp.values());
}

/* =========================
   DEMO
========================= */
const DEMO = [
  {
    nombre: "José Ramírez",
    puntuales: 29,
    totalDias: 30,
    tardanzas: 1,
    completadas: 46,
    totalTareas: 50,
    pendientes: 4,
  },
  {
    nombre: "Carlos Seguridad",
    puntuales: 26,
    totalDias: 30,
    tardanzas: 4,
    completadas: 42,
    totalTareas: 50,
    pendientes: 8,
  },
  {
    nombre: "María Vigilante",
    puntuales: 28,
    totalDias: 30,
    tardanzas: 2,
    completadas: 44,
    totalTareas: 50,
    pendientes: 6,
  },
  {
    nombre: "Roberto Guardia",
    puntuales: 22,
    totalDias: 30,
    tardanzas: 8,
    completadas: 40,
    totalTareas: 50,
    pendientes: 10,
  },
  {
    nombre: "Ana Velasco",
    puntuales: 27,
    totalDias: 30,
    tardanzas: 3,
    completadas: 45,
    totalTareas: 50,
    pendientes: 5,
  },
  {
    nombre: "Diego Morales",
    puntuales: 29,
    totalDias: 30,
    tardanzas: 1,
    completadas: 47,
    totalTareas: 50,
    pendientes: 3,
  },
];

const DEMO_HISTORY = [
  {
    empleado: "José Ramírez",
    periodo: "2024-09",
    tipo: "Mensual",
    rendimiento: 90,
    puntualidad: 95,
    tareas: 92,
    estado: "Excelente",
    fecha: "2024-09-30",
  },
  {
    empleado: "Carlos Seguridad",
    periodo: "2024-09",
    tipo: "Mensual",
    rendimiento: 87,
    puntualidad: 88,
    tareas: 85,
    estado: "Excelente",
    fecha: "2024-09-30",
  },
  {
    empleado: "María Vigilante",
    periodo: "2024-09",
    tipo: "Mensual",
    rendimiento: 85,
    puntualidad: 92,
    tareas: 88,
    estado: "Excelente",
    fecha: "2024-09-30",
  },
  {
    empleado: "Roberto Guardia",
    periodo: "2024-08",
    tipo: "Mensual",
    rendimiento: 77,
    puntualidad: 75,
    tareas: 80,
    estado: "Satisfactorio",
    fecha: "2024-08-31",
  },
  {
    empleado: "Ana Velasco",
    periodo: "2024-08",
    tipo: "Mensual",
    rendimiento: 68,
    puntualidad: 65,
    tareas: 70,
    estado: "Requiere Mejora",
    fecha: "2024-08-31",
  },
  {
    empleado: "Diego Morales",
    periodo: "2024-07",
    tipo: "Mensual",
    rendimiento: 93,
    puntualidad: 98,
    tareas: 95,
    estado: "Excelente",
    fecha: "2024-07-31",
  },
];

/* =========================
   UI helpers
========================= */
function Progress({ value }) {
  return (
    <div className="flex items-center gap-2">
      <div className="w-full h-2 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden">
        <div
          className="h-full rounded-full bar-gradient"
          style={{ width: `${clamp(value)}%` }}
        />
      </div>
      <span className="min-w-[42px] text-right text-sm opacity-70">
        {clamp(value)}%
      </span>
    </div>
  );
}
function MiniBar({ value, tone = "info" }) {
  return (
    <div className="flex items-center gap-2">
      <div className={`mini-bar mini-bar--${tone}`}>
        <span
          className="mini-bar__fill"
          style={{ width: `${clamp(value)}%` }}
        />
      </div>
      <span className="text-sm opacity-70">{clamp(value)}%</span>
    </div>
  );
}
function Chip({ children, tone = "success" }) {
  return <span className={`chip chip--${tone}`}>{children}</span>;
}
function Stat({ icon, label, value }) {
  return (
    <div className="fx-kpi">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl grid place-items-center bg-white/60 dark:bg.white/10 shadow-sm">
          <span className="text-lg">{icon}</span>
        </div>
        <div>
          <div className="text-sm opacity-70">{label}</div>
          <div className="text-xl font-bold">{value}</div>
        </div>
      </div>
    </div>
  );
}

/* ===== Botón de icono pequeño ===== */
const IconBtn = ({ label, tone = "default", onClick, children }) => {
  const toneCls =
    tone === "danger"
      ? "text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
      : tone === "info"
      ? "text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/20"
      : tone === "success"
      ? "text-green-600 hover:bg-green-50 dark:text-green-400 dark:hover:bg-green-900/20"
      : "text-neutral-600 hover:bg-black/5 dark:text-neutral-300 dark:hover:bg-white/10";
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      className={`p-1.5 rounded-md text-[14px] leading-none ${toneCls}`}
    >
      {children}
    </button>
  );
};

/* =========================
   Modal base con animación suave
========================= */
function ModalShell({ open, onRequestClose, children, width = "w-[min(600px,94vw)]" }) {
  const [show, setShow] = React.useState(false);
  React.useEffect(() => {
    if (open) {
      setShow(true);
    }
  }, [open]);
  const startClose = () => {
    setShow(false);
    setTimeout(() => onRequestClose?.(), 180);
  };
  if (!open) return null;
  return (
    <div
      className={`fixed inset-0 z-[120] grid place-items-center bg-black/50 backdrop-blur-sm p-2 transition-opacity.duration-200 ${
        show ? "opacity-100" : "opacity-0"
      }`}
      aria-modal="true"
      role="dialog"
    >
      <div
        className={`${width} max-h-[88vh] overflow-y-auto rounded-lg bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 shadow-2xl.transform transition-all.duration-200 ${
          show
            ? "opacity-100 scale-100 translate-y-0"
            : "opacity-0 scale-[0.97] translate-y-1"
        }`}
      >
        {children(startClose)}
      </div>
    </div>
  );
}

/* =========================
   Modal VER
========================= */
function ViewEvalModal({ open, item, onClose }) {
  if (!open || !item) return null;
  const initials = (item.empleado || "")
    .split(" ")
    .map((s) => s[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  // ✅ rendimiento calculado solo con puntualidad + tareas
  const rendimiento = computeRendimiento(item);

  return (
    <ModalShell
      open={open}
      onRequestClose={onClose}
      width="w-[min(560px,94vw)]"
    >
      {(close) => (
        <>
          <div className="relative overflow-hidden">
            <div className="h-16 bg-gradient-to-r from-emerald-400/70 via-teal-400/70 to-sky-400/70 dark:from-emerald-500/30 dark:via-teal-500/30 dark:to-sky-500/30" />
            <button
              onClick={close}
              className="absolute top-2 right-2 px-2 py-1 rounded-md bg-white/80 dark:bg-black/40 hover:bg-white dark:hover:bg-black text-sm"
            >
              ✕
            </button>
            <div className="px-4 -mt-8 pb-2 flex items-end gap-3">
              <div className="w-14 h-14 rounded-2xl bg-white dark:bg-neutral-800 grid place-items-center shadow-md ring-2 ring-white/70 dark:ring-white/10">
                <span className="font-bold text-emerald-600">
                  {initials}
                </span>
              </div>
              <div className="pb-1">
                <h3 className="text-lg font-extrabold">
                  {item.empleado}
                </h3>
                <div className="text-xs opacity-70">
                  {monthName(item.periodo)} · {item.tipo ?? "Mensual"}
                </div>
              </div>
            </div>
          </div>

          <div className="p-4 grid gap-3 text-sm">
            <div className="grid grid-cols-3 gap-3 max-[520px]:grid-cols-1">
              <InfoCard label="Rendimiento" value={`${rendimiento}%`} tone="ok" />
              <InfoCard label="Puntualidad" value={`${item.puntualidad}%`} tone="ok" />
              <InfoCard label="Tareas" value={`${item.tareas}%`} tone="ok" />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs opacity-70">Estado</span>
              <Chip
                tone={
                  item.estado === "Excelente"
                    ? "success"
                    : item.estado === "Satisfactorio"
                    ? "info"
                    : "danger"
                }
              >
                {item.estado}
              </Chip>
              <span className="ml-auto text-xs.opacity-70">
                Fecha: {item.fecha}
              </span>
            </div>
          </div>

          <div className="px-4 py-3 border-t border-neutral-200 dark:border-neutral-800 text-right">
            <button
              onClick={close}
              className="px-3 py-2 rounded-lg.border border-neutral-300 dark:border-neutral-700 hover:bg-black/5 dark:hover:bg-white/10 text-xs"
            >
              Cerrar
            </button>
          </div>
        </>
      )}
    </ModalShell>
  );
}

function InfoCard({ label, value, tone = "ok" }) {
  const barTone =
    tone === "ok"
      ? "bg-emerald-500"
      : tone === "warn"
      ? "bg-amber-500"
      : "bg-rose-500";
  return (
    <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 p-3 bg-white/60 dark:bg-white/5 shadow-sm">
      <div className="text-xs mb-1 opacity-70">{label}</div>
      <div className="font-bold">{value}</div>
      <div className="mt-2 h-1.5 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden">
        <div className={`h-full ${barTone} rounded-full w-3/4`} />
      </div>
    </div>
  );
}

/* =========================
   Modal Confirmación BORRAR
========================= */
function ConfirmDeleteModal({ open, item, onConfirm, onCancel }) {
  if (!open) return null;
  return (
    <ModalShell
      open={open}
      onRequestClose={onCancel}
      width="w-[min(460px,92vw)]"
    >
      {(close) => (
        <>
          <div className="px-4 py-3 border-b border-neutral-200 dark:border-neutral-800 flex.items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-red-500/10 text-red-600 grid place-items-center">
              !
            </div>
            <h3 className="text-sm font-bold">Confirmar eliminación</h3>
            <button
              className="ml-auto px-2 py-1 rounded-md hover:bg-black/5 dark:hover:bg-white/10"
              onClick={() => {
                close();
                onCancel?.();
              }}
            >
              ✕
            </button>
          </div>
          <div className="p-4 text-sm">
            ¿Eliminar la evaluación de <b>{item?.empleado}</b> correspondiente a{" "}
            <b>{monthName(item?.periodo)}</b>?<br />
            Esta acción no se puede deshacer.
          </div>
          <div className="px-4 py-3 border-t border-neutral-200 dark:border-neutral-800 flex justify-end gap-2">
            <button
              onClick={() => {
                close();
                onCancel?.();
              }}
              className="px-3 py-2 rounded-lg.border border-neutral-300 dark:border-neutral-700 hover:bg-black/5 dark:hover:bg.white/10 text-xs"
            >
              Cancelar
            </button>
            <button
              onClick={() => {
                close();
                onConfirm?.();
              }}
              className="px-3 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 text-xs"
            >
              Eliminar
            </button>
          </div>
        </>
      )}
    </ModalShell>
  );
}

/* =========================
   Modal "Nueva Evaluación"
========================= */
function NuevaEvaluacionModal({
  open,
  onClose,
  empleados,
  onSubmit,
  defaultPeriodo,
  initial = null,
  submitLabel = "Registrar Evaluación",
}) {
  const periodItems = React.useMemo(() => {
    const labels = [];
    const [yy, mm] = (defaultPeriodo || toYYYYMM(new Date()))
      .split("-")
      .map(Number);
    for (let i = 0; i < 3; i++) {
      const date = new Date(Date.UTC(yy, mm - 1 - i, 1));
      const v = date.toISOString().slice(0, 7);
      labels.push({ value: v, label: monthName(v) });
    }
    labels.push({ value: `${yy}-Q3`, label: `Q3 ${yy}` });
    labels.push({ value: `${yy}-S2`, label: `Semestre 2 ${yy}` });
    return labels;
  }, [defaultPeriodo]);

  const baseForm = {
    empleado: "",
    periodo: "",
    tipo: "Mensual",
    fechaInicio: "",
    fechaFin: "",
    puntualidad: 85,
    tareas: 88,
    observaciones: "",
    recomendaciones: "",
  };
  const [form, setForm] = React.useState(baseForm);

  React.useEffect(() => {
    if (!open) return;
    const today = new Date().toISOString().slice(0, 10);
    const filled = { ...baseForm, ...initial };
    if (!filled.fechaInicio) filled.fechaInicio = today;
    // Internamente usamos fechaFin igual a fechaInicio para no romper la lógica
    if (!filled.fechaFin) filled.fechaFin = filled.fechaInicio;
    // periodo interno basado en fecha de inicio para no romper filtros
    if (!filled.periodo) {
      filled.periodo =
        (filled.fechaInicio && filled.fechaInicio.slice(0, 7)) ||
        periodItems[0]?.value ||
        "";
    }
    filled.tipo = calcTipoEvaluacion(filled.fechaInicio, filled.fechaFin);
    setForm(filled);
  }, [open, initial, periodItems]);

  const promedio = Math.round(
    (form.puntualidad + form.tareas) / 2
  );

  const setField = (k) => (e) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const setRange = (k) => (v) =>
    setForm((f) => ({ ...f, [k]: v }));

  // Cambio de fecha de inicio (sin mostrar fecha de finalización)
  const handleFechaInicioChange = (e) => {
    const value = e.target.value;
    if (value && !isValidISODate(value)) return;
    setForm((f) => {
      const next = {
        ...f,
        fechaInicio: value,
        fechaFin: value || f.fechaFin,
      };
      next.tipo = calcTipoEvaluacion(next.fechaInicio, next.fechaFin);
      if (next.fechaInicio && isValidISODate(next.fechaInicio)) {
        next.periodo = next.fechaInicio.slice(0, 7);
      }
      return next;
    });
  };

  // Textareas sin números
  const setTextOnly = (k) => (e) => {
    const raw = e.target.value || "";
    const cleaned = raw.replace(/[0-9]/g, "");
    setForm((f) => ({ ...f, [k]: cleaned }));
  };

  const handleSubmit = async (close) => {
    const fechaInicio = form.fechaInicio;
    // Usamos internamente la misma fecha como fin
    const fechaFin = form.fechaFin || form.fechaInicio || "";

    if (!form.empleado || !fechaInicio) {
      alert("Debe seleccionar el guardia y la fecha de inicio de evaluación.");
      return;
    }

    if (!isValidISODate(fechaInicio) || (fechaFin && !isValidISODate(fechaFin))) {
      alert("Las fechas deben tener un formato válido (AAAA-MM-DD).");
      return;
    }

    const d1 = new Date(fechaInicio + "T00:00:00");
    const d2 = new Date((fechaFin || fechaInicio) + "T00:00:00");
    if (Number.isNaN(d1.getTime()) || Number.isNaN(d2.getTime()) || d2 < d1) {
      alert("La fecha de finalización debe ser mayor o igual que la fecha de inicio.");
      return;
    }

    const periodo =
      form.periodo ||
      (fechaInicio && fechaInicio.slice(0, 7)) ||
      "";

    const tipoEval = calcTipoEvaluacion(fechaInicio, fechaFin || fechaInicio);

    const payload = {
      ...form,
      fechaInicio,
      fechaFin: fechaFin || fechaInicio,
      periodo,
      tipo: tipoEval,
      promedio,
      fecha: new Date().toISOString().slice(0, 10),
    };

    try {
      const res = await api.post("/evaluaciones", payload);
      const saved = res?.data?.item || res?.data || payload;
      onSubmit?.(saved);
      close();
    } catch (err) {
      console.error("Error al guardar la evaluación:", err);
      const msg =
        err?.response?.data?.message ||
        "Error al guardar la evaluación en el servidor.";
      alert(msg);
    }
  };

  if (!open) return null;

  return (
    <ModalShell
      open={open}
      onRequestClose={onClose}
      width="w-[min(600px,94vw)]"
    >
      {(close) => (
        <>
          <div className="px-3 py-2 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
            <h2 className="text-sm font-bold">
              {submitLabel === "Registrar Evaluación"
                ? "Registrar Nueva Evaluación"
                : "Editar Evaluación"}
            </h2>
            <button
              className="px-2 py-1 rounded-md.hover:bg-black/5 dark:hover:bg-white/10"
              onClick={close}
            >
              ✕
            </button>
          </div>

          <div className="p-3 grid gap-3 text-[0.9rem]">
            {/* Guardia, fecha y tipo en UNA sola línea */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              <div className="w-full">
                <label className="block text-xs opacity-70 mb-1">
                  Guardia *
                </label>
                <select
                  className="input-fx w-full h-9 text-[0.9rem]"
                  value={form.empleado}
                  onChange={setField("empleado")}
                >
                  <option value="">Seleccionar guardia</option>
                  {empleados.map((e) => (
                    <option key={e} value={e}>
                      {e}
                    </option>
                  ))}
                </select>
              </div>
              <div className="w-full">
                <label className="block text-xs opacity-70 mb-1">
                  Fecha de inicio de evaluación *
                </label>
                <input
                  type="date"
                  className="input-fx w-full h-9 text-[0.9rem]"
                  value={form.fechaInicio}
                  onChange={handleFechaInicioChange}
                />
              </div>
              <div className="w-full">
                <label className="block text-xs opacity-70 mb-1">
                  Tipo de Evaluación (automático)
                </label>
                <input
                  className="input-fx w-full h-9 text-[0.9rem] bg-neutral-100/70 dark:bg-neutral-800/50"
                  value={form.tipo}
                  readOnly
                />
              </div>
            </div>

            <div className="grid.grid-cols-1 lg:grid-cols-2 gap-3">
              <div className="space-y-3">
                <h3 className="font-semibold text-xs">
                  Criterios de Evaluación
                </h3>
                <SliderRow
                  label="Puntualidad"
                  value={form.puntualidad}
                  onChange={setRange("puntualidad")}
                />
                <SliderRow
                  label="Cumplimiento de Tareas"
                  value={form.tareas}
                  onChange={setRange("tareas")}
                />
              </div>
              <div className="space-y-3">
                <div className="h-4" />
                <div className="mt-1 p-2.5 rounded-md border border-neutral-200 dark:border-neutral-800 bg-white/70 dark:bg.white/5">
                  <div className="text-center font-extrabold text-sm">
                    Promedio:{" "}
                    <span className="text-neutral-900 dark:text-neutral-100">
                      {promedio}%
                    </span>
                  </div>
                  <div className="mt-2 w-full h-2 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden">
                    <div
                      className="h-full rounded-full bar-gradient"
                      style={{ width: `${promedio}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-2.5">
              <div className="w-full">
                <label className="block text-xs.opacity-70 mb-1">
                  Observaciones
                </label>
                <textarea
                  className="input-fx w-full text-[0.9rem]"
                  rows={2}
                  value={form.observaciones}
                  onChange={setTextOnly("observaciones")}
                />
              </div>
              <div className="w-full">
                <label className="block text-xs.opacity-70 mb-1">
                  Recomendaciones
                </label>
                <textarea
                  className="input-fx w-full text-[0.9rem]"
                  rows={2}
                  value={form.recomendaciones}
                  onChange={setTextOnly("recomendaciones")}
                />
              </div>
            </div>
          </div>

          <div className="px-3 py-2.5 border-t border-neutral-200 dark:border-neutral-800 flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2">
            <button
              onClick={onClose}
              className="px-3 py-2 rounded-lg.border border-neutral-300 dark:border-neutral-700 hover:bg-black/5 dark:hover:bg.white/10 text-xs w-full sm:w-auto"
            >
              Cancelar
            </button>
            <button
              onClick={() => handleSubmit(onClose)}
              disabled={!form.empleado || !form.fechaInicio}
              className="px-3 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 text-xs disabled:opacity-60 disabled:cursor-not-allowed w-full sm:w-auto"
            >
              {submitLabel}
            </button>
          </div>
        </>
      )}
    </ModalShell>
  );
}

function SliderRow({ label, value, onChange }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="font-medium text-xs">{label}</span>
        <span className="opacity-70 text-xs">{value}%</span>
      </div>
      <input
        type="range"
        min={0}
        max={100}
        step={1}
        className="w-full h-1.5 accent-blue-600"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  );
}

/* =========================
   Reportes Panel (nuevo)
========================= */
function ReportesPanel({
  employeesAll,
  employees,
  kpis,
  history,
  periodActual,
}) {
  const [rep, setRep] = React.useState({
    periodo: periodActual,
    empleado: "Todos",
  });
  const [preview, setPreview] = React.useState([]);

  const empleadosUnicos = React.useMemo(
    () => ["Todos", ...Array.from(new Set(employeesAll.map((e) => e.name)))],
    [employeesAll]
  );

  const filtered = React.useMemo(() => {
    let data = history.slice();
    if (rep.periodo && rep.periodo !== "Todos")
      data = data.filter((h) => h.periodo === rep.periodo);
    if (rep.empleado && rep.empleado !== "Todos")
      data = data.filter((h) => h.empleado === rep.empleado);
    data.sort((a, b) => {
      const n = (a.empleado || "").localeCompare(b.empleado || "");
      if (n !== 0) return n;
      return (b.periodo || "").localeCompare(a.periodo || "");
    });
    return data;
  }, [history, rep.periodo, rep.empleado]);

  const buildDataset = React.useCallback(() => {
    const resumen = {
      periodo: rep.periodo === "Todos" ? "(varios)" : rep.periodo,
      generado: new Date().toISOString(),
      kpis,
      totalRegistros: filtered.length,
      empresa: "SENAF",
    };
    const detalle = filtered.map((r) => ({
      empleado: r.empleado,
      periodo: r.periodo,
      tipo: r.tipo ?? "Mensual",
      // ✅ rendimiento en reportes basado SOLO en puntualidad+tareas
      rendimiento: computeRendimiento(r),
      puntualidad: r.puntualidad,
      tareas: r.tareas,
      estado: r.estado,
      fecha: r.fecha,
    }));
    return { resumen, detalle };
  }, [filtered, kpis, rep.periodo]);

  const download = (filename, mime, content) => {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  // === Excel ===
  const exportarExcel = () => {
    const { resumen, detalle } = buildDataset();
    const fechaHora = new Date();
    const subtitulo = `Reporte de Evaluaciones — ${
      rep.periodo === "Todos"
        ? "Todos los periodos"
        : monthName(rep.periodo)
    }`;

    const style = `
      <style>
        body { font-family: Calibri, "Segoe UI", Arial, sans-serif; }
        .brand { font-size:22px; font-weight:800; margin:8px 0 2px 0; }
        .subtitle { font-size:16px; font-weight:700; margin:0 0 10px 0; }
        .meta { margin:6px 0 12px 0; font-size:12px; }
        table { width:100%; border-collapse:collapse; font-size:12px; }
        thead th{
          background:#0ea5e9; color:#fff; text-align:left; padding:8px;
          border:1px solid #0ea5e9; font-weight:700;
        }
        tbody td{ padding:6px; border:1px solid #e5e7eb; }
        tbody tr:nth-child(even){ background:#f8fafc; }
        .kpi{ display:inline-block; margin-right:12px; }
      </style>`;

    const resumenHtml = `
      <div class="meta">
        <span class="kpi"><b>Empresa:</b> SENAF</span>
        <span class="kpi"><b>Generado:</b> ${fechaHora.toLocaleDateString()} ${fechaHora.toLocaleTimeString()}</span>
        <span class="kpi"><b>Periodo:</b> ${
          rep.periodo === "Todos" ? "Todos" : monthName(rep.periodo)
        }</span>
        <span class="kpi"><b>Registros:</b> ${
          resumen.totalRegistros
        }</span>
      </div>
      <div class="meta">
        <span class="kpi"><b>Rendimiento Promedio:</b> ${
          kpis.rendimientoPromedio
        }</span>
        <span class="kpi"><b>Excelentes:</b> ${
          kpis.excelentes
        }</span>
        <span class="kpi"><b>Requieren Mejora:</b> ${
          kpis.mejora
        }</span>
        <span class="kpi"><b>Evaluados:</b> ${
          kpis.evaluados
        }</span>
      </div>`;

    const header = [
      "Empleado",
      "Período",
      "Tipo",
      "Rend.",
      "Punt.",
      "Tareas",
      "Estado",
      "Fecha",
    ];
    const rows = detalle.map((d) => [
      d.empleado,
      monthName(d.periodo),
      d.tipo || "Mensual",
      `${d.rendimiento}%`,
      `${d.puntualidad}%`,
      `${d.tareas}%`,
      d.estado,
      d.fecha,
    ]);

    const table = `
      <table>
        <thead><tr>${header.map((h) => `<th>${h}</th>`).join("")}</tr></thead>
        <tbody>
          ${rows
            .map(
              (r) =>
                `<tr>${r.map((c) => `<td>${c}</td>`).join("")}</tr>`
            )
            .join("")}
        </tbody>
      </table>`;

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/>${style}</head><body>
      <div class="brand">SENAF</div>
      <div class="subtitle">${subtitulo}</div>
      ${resumenHtml}
      ${table}
    </body></html>`;

    download(
      `reporte-evaluaciones-${rep.periodo || "todos"}.xls`,
      "application/vnd.ms-excel",
      html
    );
  };

  // === PDF ===
  const exportarPDF = () => {
    const { detalle } = buildDataset();
    const win = window.open("", "_blank");
    const fechaHora = new Date();
    const periodoTxt =
      rep.periodo === "Todos"
        ? "Todos los periodos"
        : monthName(rep.periodo);
    const titulo = `Reporte de Evaluaciones (${periodoTxt})`;

    const style = `
      <style>
        @page { margin: 16mm; }
        * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        body{font-family: Inter, ui-sans-serif, system-ui, Segoe UI, Arial; margin:0; color:#0f172a; }
        header{display:flex;justify-content:space-between;align-items:flex-start;padding-top:4px;margin-bottom:10px;border-bottom:2px solid #e2e8f0;}
        .brand{font-weight:900;font-size:28px;letter-spacing:.3px;margin:0 0 6px 0;}
        .meta{font-size:12px;color:#334155;text-align:right;line-height:1.3}
        h1.title{font-size:22px;font-weight:800;margin:8px 0 10px 0}
        .kpis{display:flex;gap:10px;flex-wrap:wrap;margin:6px 0 12px}
        .chip{background:#e0ecff;border:1px solid #c7d2fe;border-radius:10px;padding:6px 10px;font-size:12px}
        table{width:100%;border-collapse:separate;border-spacing:0;font-size:12px}
        thead th{
          background:#1E40AF;color:#ffffff;font-weight:700;text-align:left;padding:8px 10px;
          border-right:1px solid #1E3A8A
        }
        thead th:first-child{border-top-left-radius:12px}
        thead th:last-child{border-top-right-radius:12px;border-right:none}
        tbody td{padding:8px 10px;border-bottom:1px solid #e2e8f0;border-right:1px solid #e2e8f0}
        tbody td:last-child{border-right:none}
        tbody tr:nth-child(even) td{background:#F8FAFC}
        footer{position:fixed;bottom:12mm;left:0;right:0;text-align:center;color:#94a3b8;font-size:11px}
        table, tr, td, th { page-break-inside: avoid; }
      </style>`;

    const headerMeta = `
      <div class="meta">
        <div><b>Fecha:</b> ${fechaHora.toLocaleDateString()} — <b>Hora:</b> ${fechaHora.toLocaleTimeString()}</div>
        <div><b>Periodo:</b> ${periodoTxt}</div>
      </div>`;

    const kpisHtml = `
      <div class="kpis">
        <span class="chip"><b>Rendimiento Promedio:</b> ${kpis.rendimientoPromedio}</span>
        <span class="chip"><b>Excelentes:</b> ${kpis.excelentes}</span>
        <span class="chip"><b>Requieren Mejora:</b> ${kpis.mejora}</span>
        <span class="chip"><b>Evaluados:</b> ${kpis.evaluados}</span>
      </div>`;

    const headerRow = [
      "Empleado",
      "Período",
      "Tipo",
      "Rend.",
      "Punt.",
      "Tareas",
      "Estado",
      "Fecha",
    ]
      .map((h) => `<th>${h}</th>`)
      .join("");

    const bodyRows = detalle
      .map(
        (r) => `
      <tr>
        <td>${r.empleado}</td>
        <td>${monthName(r.periodo)}</td>
        <td>${r.tipo ?? "Mensual"}</td>
        <td>${r.rendimiento}%</td>
        <td>${r.puntualidad}%</td>
        <td>${r.tareas}%</td>
        <td>${r.estado}</td>
        <td>${r.fecha}</td>
      </tr>`
      )
      .join("");

    const html = `<!doctype html>
    <html>
      <head><meta charset="utf-8" />${style}</head>
      <body>
        <header>
          <div>
            <div class="brand">SENAF</div>
        </div>
          ${headerMeta}
        </header>

        <h1 class="title">${titulo}</h1>
        ${kpisHtml}

        <table>
          <thead><tr>${headerRow}</tr></thead>
          <tbody>${bodyRows}</tbody>
        </table>

        <footer>Generado por el sistema de Evaluación — SENAF</footer>
      </body>
    </html>`;

    win.document.open();
    win.document.write(html);
    win.document.close();
    win.onload = () => {
      win.focus();
      win.print();
    };
  };

  const generar = () => {
    const { detalle } = buildDataset();
    setPreview(detalle.slice(0, 15));
  };

  return (
    <div className="card">
      <div className="flex flex-col.sm:flex-row sm:items-center sm:justify-between mb-3 gap-2">
        <h3 className="font-semibold text-lg">🧾 Reportes</h3>
        <div className="text-xs.opacity-70">
          Exporta a Excel o PDF (con marca SENAF)
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,2fr)_minmax(0,2fr)_minmax(0,1.4fr)_minmax(0,1.6fr)] gap-3">
        <div>
          <label className="block text-xs.opacity-70 mb-1">Período</label>
          <select
            className="input-fx w-full"
            value={rep.periodo}
            onChange={(e) =>
              setRep((r) => ({ ...r, periodo: e.target.value }))
            }
          >
            <option value={periodActual}>{monthName(periodActual)}</option>
            <option>Todos</option>
          </select>
        </div>
        <div>
          <label className="block text-xs.opacity-70 mb-1">Empleado</label>
          <select
            className="input-fx w-full"
            value={rep.empleado}
            onChange={(e) =>
              setRep((r) => ({ ...r, empleado: e.target.value }))
            }
          >
            {empleadosUnicos.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-end">
          <button
            className="w-full sm:w-auto px-3 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700"
            onClick={generar}
          >
            Generar vista previa
          </button>
        </div>

        <div className="flex items-end gap-2 justify-end">
          <button
            className="w-full sm:w-auto px-3 py-2 rounded-lg bg-green-600 text-white hover:bg-green-700 text-xs"
            onClick={exportarExcel}
          >
            Exportar a Excel
          </button>

          <button
            className="w-full sm:w-auto px-3 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 text-xs"
            onClick={exportarPDF}
          >
            Exportar a PDF
          </button>
        </div>
      </div>

      <div className="mt-3 overflow-x-auto">
        <table className="tbl w-full min-w-[640px]">
          <thead>
            <tr>
              <th>Empleado</th>
              <th>Período</th>
              <th>Tipo</th>
              <th>Rendimiento</th>
              <th>Puntualidad</th>
              <th>Tareas</th>
              <th>Estado</th>
              <th>Fecha</th>
            </tr>
          </thead>
          <tbody>
            {preview.length === 0 && (
              <tr>
                <td
                  colSpan={8}
                  className="text-center py-6 opacity-70"
                >
                  Genera una vista previa para ver los datos…
                </td>
              </tr>
            )}
            {preview.map((r, i) => (
              <tr key={i}>
                <td>{r.empleado}</td>
                <td>{monthName(r.periodo)}</td>
                <td>{r.tipo ?? "Mensual"}</td>
                <td>{r.rendimiento}%</td>
                <td>{r.puntualidad}%</td>
                <td>{r.tareas}%</td>
                <td>{r.estado}</td>
                <td>{r.fecha}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* =========================
   Página
========================= */
export default function Evaluacion() {
  const [filters, setFilters] = React.useState({
    periodo: toYYYYMM(new Date()),
    q: "",
  });
  const [rows, setRows] = React.useState([]);
  const [loading, setLoading] = React.useState(false);

  const [openModal, setOpenModal] = React.useState(false);
  const [editInitial, setEditInitial] = React.useState(null);
  const [editIndex, setEditIndex] = React.useState(null);

  const [viewItem, setViewItem] = React.useState(null);

  const [histFilters, setHistFilters] = React.useState({
    q: "",
    empleado: "Todos",
    periodo: "Todos",
  });
  const [history, setHistory] = React.useState([]);

  const [confirmDel, setConfirmDel] = React.useState({
    open: false,
    idx: null,
    item: null,
  });

  const fetchData = React.useCallback(async () => {
    setLoading(true);
    try {
      const { periodo, q } = filters;
      let data = null;
      try {
        const r = await api.get("/evaluaciones", {
          params: { periodo, q },
        });
        data = r?.data?.items ?? r?.data ?? null;
      } catch {
        data = null;
      }
      if (!Array.isArray(data)) {
        const r = await api.get("/evaluacion", {
          params: { periodo, q },
        });
        data = r?.data?.items ?? r?.data ?? [];
      }
      setRows(Array.isArray(data) ? data : []);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  const fetchHistory = React.useCallback(async () => {
    try {
      let data = null;
      try {
        const r = await api.get("/evaluaciones/historial");
        data = r?.data?.items ?? r?.data ?? null;
      } catch {
        data = null;
      }
      if (!Array.isArray(data)) data = DEMO_HISTORY;
      setHistory(data);
    } catch {
      setHistory(DEMO_HISTORY);
    }
  }, []);

  React.useEffect(() => {
    fetchData();
  }, [fetchData]);
  React.useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const employeesAll = React.useMemo(() => {
    const fromApi = normalizeEmployees(rows);
    if (fromApi.length) return fromApi;
    return DEMO.map((d) => ({
      name: d.nombre,
      diasPuntuales: d.puntuales,
      diasTotales: d.totalDias,
      tardanzas: d.tardanzas,
      tareasCompletadas: d.completadas,
      tareasTotales: d.totalTareas,
      pendientes: d.pendientes,
    }));
  }, [rows]);

  const topQ = filters.q.trim().toLowerCase();
  const employees = React.useMemo(() => {
    if (!topQ) return employeesAll;
    return employeesAll.filter((e) =>
      (e.name || "").toLowerCase().includes(topQ)
    );
  }, [employeesAll, topQ]);

  const employeeNames = React.useMemo(
    () => employeesAll.map((e) => e.name),
    [employeesAll]
  );

  // === KPIs ACTUALIZADOS ===
  const kpis = React.useMemo(() => {
    // Rendimiento promedio (sobre los empleados agregados)
    const n = employees.length || 1;
    const punctualPcts = employees.map((e) =>
      pct(e.diasPuntuales, e.diasTotales)
    );
    const taskPcts = employees.map((e) =>
      pct(e.tareasCompletadas, e.tareasTotales)
    );
    const rendimiento = clamp(
      (punctualPcts.reduce((s, n) => s + n, 0) +
        taskPcts.reduce((s, n) => s + n, 0)) /
        (2 * n)
    );

    // Contadores basados en el HISTORIAL para el período seleccionado
    const historyForPeriod = history.filter(
      (h) => !filters.periodo || h.periodo === filters.periodo
    );

    const excelentes = historyForPeriod.filter(
      (h) => h.estado === "Excelente"
    ).length;

    const mejora = historyForPeriod.filter(
      (h) => h.estado === "Requiere Mejora"
    ).length;

    return {
      rendimientoPromedio: `${rendimiento}%`,
      excelentes,
      mejora,
      evaluados: employees.length,
    };
  }, [employees, history, filters.periodo]);

  const filteredHistory = React.useMemo(() => {
    let data = [...history];
    const q = histFilters.q.toLowerCase();
    if (q)
      data = data.filter((r) =>
        (r.empleado || "").toLowerCase().includes(q)
      );
    if (histFilters.empleado !== "Todos")
      data = data.filter((r) => r.empleado === histFilters.empleado);
    if (histFilters.periodo !== "Todos")
      data = data.filter((r) => r.periodo === histFilters.periodo);
    return data;
  }, [history, histFilters]);

  const periodosDisponibles = React.useMemo(() => {
    const set = new Set(history.map((h) => h.periodo));
    return Array.from(set).sort().reverse();
  }, [history]);

  const upsertHistory = (payload) => {
    if (editIndex !== null && editIndex !== undefined) {
      setHistory((h) => {
        const copy = [...h];
        copy[editIndex] = {
          ...copy[editIndex],
          empleado: payload.empleado,
          periodo: payload.periodo.includes("-")
            ? payload.periodo
            : copy[editIndex].periodo,
          tipo: payload.tipo,
          rendimiento:
            payload.promedio ??
            Math.round(
              (payload.puntualidad + payload.tareas) / 2
            ),
          puntualidad: payload.puntualidad,
          tareas: payload.tareas,
          estado:
            payload.promedio >= 90
              ? "Excelente"
              : payload.promedio >= 80
              ? "Satisfactorio"
              : "Requiere Mejora",
          fecha: new Date().toISOString().slice(0, 10),
        };
        return copy;
      });
      setEditIndex(null);
      setEditInitial(null);
    } else {
      const label = payload.periodo.includes("-")
        ? payload.periodo
        : filters.periodo;
      setHistory((h) => [
        {
          empleado: payload.empleado,
          periodo: label,
          tipo: payload.tipo,
          rendimiento:
            payload.promedio ??
            Math.round(
              (payload.puntualidad + payload.tareas) / 2
            ),
          puntualidad: payload.puntualidad,
          tareas: payload.tareas,
          estado:
            payload.promedio >= 90
              ? "Excelente"
              : payload.promedio >= 80
              ? "Satisfactorio"
              : "Requiere Mejora",
          fecha: new Date().toISOString().slice(0, 10),
        },
        ...h,
      ]);
    }
  };

  const onView = (item) => setViewItem(item);
  const onEdit = (item, idx) => {
    setEditIndex(idx);
    const approx = Math.round(item.rendimiento ?? 80);
    const initial = {
      empleado: item.empleado,
      periodo: item.periodo,
      tipo: item.tipo ?? "Mensual",
      // Para ediciones antiguas, no tenemos fechas guardadas; se tomarán por defecto
      puntualidad: item.puntualidad ?? approx,
      tareas: item.tareas ?? approx,
      observaciones: "",
      recomendaciones: "",
    };
    setEditInitial(initial);
    setOpenModal(true);
  };
  const onDelete = (idx) => {
    const item = history[idx];
    setConfirmDel({ open: true, idx, item });
  };

  const confirmDelete = () => {
    setHistory((h) => h.filter((_, i) => i !== confirmDel.idx));
    setConfirmDel({ open: false, idx: null, item: null });
  };

  return (
    <section className="space-y-5" data-fx="neon">
      {/* Encabezado */}
      <div className="flex flex-col lg:flex-row lg:items-end gap-3">
        <div className="flex-1 min-w-[220px]">
          <h1 className="text-2xl font-extrabold">
            Evaluación de Personal
          </h1>
          <p className="text-sm.opacity-70">
            Monitoreo de rendimiento, horarios y cumplimiento de tareas
          </p>
        </div>

        <div className="w-full lg:w-auto lg:ml-auto flex flex-col sm:flex-row gap-3">
          <div className="flex-1 min-w-[180px]">
            <label className="block text-sm.opacity-70 mb-1">
              Periodo
            </label>
            <input
              type="month"
              className="input-fx date-input w-full"
              value={filters.periodo}
              onChange={(e) =>
                setFilters((f) => ({ ...f, periodo: e.target.value }))
              }
            />
          </div>

          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm.opacity-70 mb-1">
              Buscar
            </label>
            <input
              className="input-fx search-input w-full"
              placeholder="Buscar por empleado…"
              value={filters.q}
              onChange={(e) =>
                setFilters((f) => ({ ...f, q: e.target.value }))
              }
            />
          </div>

          <div className="w-full sm:w-auto">
            <label className="block text-sm.opacity-0 mb-1">
              .
            </label>
            <button
              type="button"
              className="w-full sm:w-auto px-3 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700"
              onClick={() => {
                setEditInitial(null);
                setEditIndex(null);
                setOpenModal(true);
              }}
            >
              + Nueva Evaluación
            </button>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-4 gap-4 max-[1024px]:grid-cols-2 max-[640px]:grid-cols-1">
        <Stat
          icon="📈"
          label="Rendimiento Promedio"
          value={kpis.rendimientoPromedio}
        />
        <Stat
          icon="🏅"
          label="Desempeño Excelente"
          value={kpis.excelentes}
        />
        <Stat
          icon="⚠"
          label="Requieren Mejora"
          value={kpis.mejora}
        />
        <Stat
          icon="👥"
          label="Empleados Evaluados"
          value={kpis.evaluados}
        />
      </div>

      {/* Paneles */}
      <div className="grid grid-cols-2 gap-4 max-[1024px]:grid-cols-1">
        <div className="card">
          <div className="flex.items-center justify-between mb-2">
            <h3 className="font-semibold text-lg">
              🎯 Cumplimiento de Tareas
            </h3>
            {loading && (
              <div className="text-sm.opacity-70">Cargando…</div>
            )}
          </div>
          <div>
            {employees.map((e, i) => {
              const p = pct(e.tareasCompletadas, e.tareasTotales);
              return (
                <div
                  key={`t-${e.name}-${i}`}
                  className="py-2 border-b border-neutral-200/60 dark:border-neutral-800/60"
                >
                  <div className="font-semibold">{e.name}</div>
                  <Progress value={p} />
                </div>
              );
            })}
          </div>
        </div>
        <div className="card">
          <div className="flex.items-center justify-between mb-2">
            <h3 className="font-semibold text-lg">
              🕒 Cumplimiento de Horarios
            </h3>
            {loading && (
              <div className="text-sm.opacity-70">Cargando…</div>
            )}
          </div>
          <div>
            {employees.map((e, i) => {
              const p = pct(e.diasPuntuales, e.diasTotales);
              return (
                <div
                  key={`h-${e.name}-${i}`}
                  className="py-2 border-b border-neutral-200/60 dark:border-neutral-800/60"
                >
                  <div className="font-semibold">{e.name}</div>
                  <Progress value={p} />
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Historial */}
      <div className="eval-history">
        <div className="px-4 pt-4">
          <h3 className="text-lg sm:text-xl font-extrabold mb-2">
            Historial de Evaluaciones
          </h3>
        </div>

        <div className="history-toolbar flex flex-wrap gap-2 px-4 pb-2">
          <div className="search flex-1 min-w-[180px]">
            <input
              className="input-fx w-full"
              placeholder="Buscar por empleado..."
              value={histFilters.q}
              onChange={(e) =>
                setHistFilters((f) => ({ ...f, q: e.target.value }))
              }
            />
            <span className="icon">🔎</span>
          </div>

          <div className="select-wrap min-w-[160px]">
            <span className="ctrl-icon">🧑‍💼</span>
            <select
              className="input-fx pill-select w-full"
              value={histFilters.empleado}
              onChange={(e) =>
                setHistFilters((f) => ({
                  ...f,
                  empleado: e.target.value,
                }))
              }
              aria-label="Empleado"
            >
              <option>Todos</option>
              {Array.from(new Set(history.map((h) => h.empleado))).map(
                (n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                )
              )}
            </select>
          </div>

          <div className="select-wrap min-w-[160px]">
            <span className="ctrl-icon">📅</span>
            <select
              className="input-fx pill-select w-full"
              value={histFilters.periodo}
              onChange={(e) =>
                setHistFilters((f) => ({
                  ...f,
                  periodo: e.target.value,
                }))
              }
              aria-label="Periodo"
            >
              <option>Todos</option>
              {periodosDisponibles.map((p) => (
                <option key={p} value={p}>
                  {monthName(p)}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="overflow-x-auto px-2 pb-2">
          <table className="tbl w-full min-w-[720px] text-sm">
            <thead>
              <tr>
                <th>Empleado</th>
                <th>Período</th>
                <th>Tipo</th>
                <th>Rendimiento</th>
                <th>Puntualidad</th>
                <th>Tareas</th>
                <th>Estado</th>
                <th>Fecha</th>
                <th style={{ width: 80 }} className="text-right pr-3">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredHistory.length === 0 && (
                <tr>
                  <td
                    colSpan={9}
                    className="text-center py-6 opacity-70"
                  >
                    Sin registros.
                  </td>
                </tr>
              )}
              {filteredHistory.map((r, i) => {
                // ✅ Calculamos rendimiento SOLO con puntualidad+tareas
                const rend = computeRendimiento(r);
                const toneFor = (val) =>
                  val >= 90 ? "ok" : val >= 80 ? "warn" : "bad";
                const estadoTone =
                  r.estado === "Excelente"
                    ? "success"
                    : r.estado === "Satisfactorio"
                    ? "info"
                    : "danger";
                return (
                  <tr key={i}>
                    <td>
                      <button
                        className="link"
                        onClick={() => setViewItem(r)}
                      >
                        {r.empleado}
                      </button>
                    </td>
                    <td>{monthName(r.periodo)}</td>
                    <td>{r.tipo ?? "Mensual"}</td>
                    <td>
                      <MiniBar
                        value={rend}
                        tone={toneFor(rend)}
                      />
                    </td>
                    <td>
                      <MiniBar
                        value={r.puntualidad}
                        tone={toneFor(r.puntualidad)}
                      />
                    </td>
                    <td>
                      <MiniBar
                        value={r.tareas}
                        tone={toneFor(r.tareas)}
                      />
                    </td>
                    <td>
                      <Chip tone={estadoTone}>{r.estado}</Chip>
                    </td>
                    <td>{r.fecha}</td>
                    <td className="text-right pr-3">
                      <div className="flex gap-1 justify-end">
                        <IconBtn
                          label="Ver"
                          tone="success"
                          onClick={() => setViewItem(r)}
                        >
                          <svg
                            width="18"
                            height="18"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                          >
                            <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z" />
                            <circle cx="12" cy="12" r="3" />
                          </svg>
                        </IconBtn>
                        <IconBtn
                          label="Editar"
                          tone="info"
                          onClick={() =>
                            onEdit(r, history.indexOf(r))
                          }
                        >
                          <svg
                            width="18"
                            height="18"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                          >
                            <path d="M12 20h9" />
                            <path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
                          </svg>
                        </IconBtn>
                        <IconBtn
                          label="Borrar"
                          tone="danger"
                          onClick={() =>
                            onDelete(history.indexOf(r))
                          }
                        >
                          <svg
                            width="18"
                            height="18"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                          >
                            <polyline points="3 6 5 6 21 6" />
                            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                            <path d="M10 11v6M14 11v6" />
                            <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                          </svg>
                        </IconBtn>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Reportes (nuevo) */}
      <ReportesPanel
        employeesAll={employeesAll}
        employees={employees}
        kpis={kpis}
        history={history}
        periodActual={filters.periodo}
      />

      {/* Modales */}
      <NuevaEvaluacionModal
        open={openModal}
        onClose={() => {
          setOpenModal(false);
          setEditInitial(null);
          setEditIndex(null);
        }}
        empleados={employeeNames}
        defaultPeriodo={filters.periodo}
        onSubmit={upsertHistory}
        initial={editInitial}
        submitLabel={
          editIndex !== null && editIndex !== undefined
            ? "Guardar Cambios"
            : "Registrar Evaluación"
        }
      />

      <ViewEvalModal
        open={!!viewItem}
        item={viewItem}
        onClose={() => setViewItem(null)}
      />

      <ConfirmDeleteModal
        open={confirmDel.open}
        item={confirmDel.item}
        onCancel={() =>
          setConfirmDel({ open: false, idx: null, item: null })
        }
        onConfirm={confirmDelete}
      />
    </section>
  );
}
