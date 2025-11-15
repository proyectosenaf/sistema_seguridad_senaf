import React, { useEffect, useRef, useState } from "react";

export default function NewVisitorModal({ onClose, onSubmit }) {
  const [name, setName] = useState("");
  const [document, setDocument] = useState("");
  const [company, setCompany] = useState("");
  const [employee, setEmployee] = useState("");
  const [reason, setReason] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const firstInputRef = useRef(null);

  // ===== Helpers de horario de atención (ACTUALIZADO SIN MOVER NADA MÁS) =====
  function isWithinBusinessHours(date) {
    if (!(date instanceof Date) || isNaN(date.getTime())) return false;
    const h = date.getHours();
    const m = date.getMinutes();
    const s = date.getSeconds();
    const totalSeconds = h * 3600 + m * 60 + s;

    const morningStart = 8 * 3600;
    const morningEndInclusive = 12 * 3600;

    const afternoonStart = 13 * 3600;
    const afternoonEndExclusive = 16 * 3600 + 59 * 60;

    if (totalSeconds >= morningStart && totalSeconds <= morningEndInclusive) return true;
    if (totalSeconds >= afternoonStart && totalSeconds < afternoonEndExclusive) return true;

    return false;
  }

  function businessHoursMessage() {
    return "Horario permitido: 08:00–12:00 (12:00 incluido) y 13:00–16:58. Después de 16:59 no se permiten registros.";
  }
  // ==========================================================================

  useEffect(() => {
    firstInputRef.current?.focus();
  }, []);

  useEffect(() => {
    function onKeyDown(e) {
      if (e.key === "Escape") onClose?.();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);

    try {
      if (!name.trim() || !document.trim() || !employee.trim() || !reason.trim()) {
        alert("Completa los campos obligatorios.");
        setSubmitting(false);
        return;
      }

      const now = new Date();
      if (!isWithinBusinessHours(now)) {
        alert(`No se puede registrar la visita fuera del horario permitido.\n${businessHoursMessage()}`);
        setSubmitting(false);
        return;
      }

      await onSubmit?.({
        name: name.trim(),
        document: document.trim(),
        company: company.trim(),
        employee: employee.trim() || undefined,
        reason: reason.trim(),
        phone: phone.trim(),
        email: email.trim(),
      });
    } catch (err) {
      console.error("[NewVisitorModal] onSubmit error:", err);
      alert("No se pudo registrar. Revisa la conexión e inténtalo de nuevo.");
    } finally {
      setSubmitting(false);
    }
  }

  function handleBackdrop(e) {
    if (e.target === e.currentTarget) onClose?.();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onMouseDown={handleBackdrop}
    >
      <div
        className="w-[95%] max-w-[560px] card-rich p-4 md:p-5"
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-visitor-title"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-4">
          <h3 id="new-visitor-title" className="text-lg font-semibold text-neutral-100">
            Registrar Visitante
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="text-neutral-400 hover:text-neutral-200"
            aria-label="Cerrar"
          >
            ✕
          </button>
        </div>

        <div className="mb-3 text-xs text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-md px-3 py-2">
          {businessHoursMessage()}
        </div>

        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="md:col-span-2">
            <label className="text-xs text-neutral-400">Nombre completo</label>
            <input
              ref={firstInputRef}
              className="input-fx w-full"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej. María López"
              required
            />
          </div>

          <div>
            <label className="text-xs text-neutral-400">Documento</label>
            <input
              className="input-fx w-full"
              value={document}
              onChange={(e) => setDocument(e.target.value)}
              placeholder="0801-YYYY-XXXXX"
              required
              inputMode="numeric"
            />
          </div>

          <div>
            <label className="text-xs text-neutral-400">Empresa</label>
            <input
              className="input-fx w-full"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              placeholder="SENAF / Munily S.A."
            />
          </div>

          <div className="md:col-span-2">
            <label className="text-xs text-neutral-400">Empleado anfitrión</label>
            <input
              className="input-fx w-full"
              value={employee}
              onChange={(e) => setEmployee(e.target.value)}
              placeholder="Nombre de la persona que visita"
              required
            />
          </div>

          <div className="md:col-span-2">
            <label className="text-xs text-neutral-400">Motivo</label>
            <input
              className="input-fx w-full"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Reunión / Entrega / Mantenimiento…"
              required
            />
          </div>

          <div>
            <label className="text-xs text-neutral-400">Teléfono</label>
            <input
              className="input-fx w-full"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+504 9999-9999"
              type="tel"
            />
          </div>

          <div>
            <label className="text-xs text-neutral-400">Correo</label>
            <input
              type="email"
              className="input-fx w-full"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="correo@empresa.com"
            />
          </div>

          <div className="md:col-span-2 flex items-center justify-end gap-2 mt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-2 text-sm rounded-lg bg-neutral-700/40 hover:bg-neutral-700/60"
              disabled={submitting}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="btn-neon px-3 py-2 text-sm rounded-lg font-semibold disabled:opacity-60"
              disabled={submitting}
            >
              {submitting ? "Registrando…" : "Registrar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
