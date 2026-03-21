import { useEffect, useMemo, useRef, useState } from "react";
import { Mic, MicOff, PencilLine } from "lucide-react";
import { UI } from "../utils/accesos.constants.js";
import {
  formatDateTime,
  sxCard,
  sxGhostBtn,
  sxInput,
  sxMutedBox,
  sxSuccessBtn,
} from "../utils/accesos.helpers.js";
import Field from "./Field.jsx";

export default function NuevoMovimientoModal({
  open,
  onClose,
  onCreated,
  empleados,
}) {
  const PERMISO_LABEL = "Permiso";

  const personaOptions = useMemo(() => {
    return empleados.map((e) => ({
      value: e._id,
      label: e.nombreCompleto,
    }));
  }, [empleados]);

  const INITIAL = {
    tipo: "PERMISO",
    personaId: "",
    placa: "",
    observacion: "",
    fechaHora: "",
    fechaFin: "",
    noRegresa: false,
  };

  const [form, setForm] = useState(INITIAL);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const [speechSupported, setSpeechSupported] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef(null);

  useEffect(() => {
    if (open) {
      setForm(INITIAL);
      setError("");
    }
  }, [open]);

  useEffect(() => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setSpeechSupported(false);
      recognitionRef.current = null;
      return;
    }

    setSpeechSupported(true);

    const recognition = new SpeechRecognition();
    recognition.lang = "es-HN";
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onstart = () => {
      setIsListening(true);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognition.onerror = (event) => {
      console.warn("[NuevoMovimientoModal] speech error:", event?.error);
      setIsListening(false);
    };

    recognition.onresult = (event) => {
      let finalTranscript = "";
      let interimTranscript = "";

      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const transcript = event.results[i][0]?.transcript || "";
        if (event.results[i].isFinal) finalTranscript += transcript + " ";
        else interimTranscript += transcript;
      }

      if (finalTranscript.trim()) {
        setForm((prev) => ({
          ...prev,
          observacion: `${prev.observacion}${prev.observacion ? " " : ""}${finalTranscript.trim()}`.trim(),
        }));
      }
    };

    recognitionRef.current = recognition;

    return () => {
      try {
        recognition.stop();
      } catch {
        // ignore
      }
    };
  }, []);

  useEffect(() => {
    if (!open && recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
      setIsListening(false);
    }
  }, [open]);

  if (!open) return null;

  const setVal = (k, v) => setForm((s) => ({ ...s, [k]: v }));

  function validar() {
    const errs = [];
    if (!form.personaId) errs.push("Debe seleccionar un empleado");
    if (!form.fechaHora) errs.push("La hora de salida es obligatoria");
    if (!form.noRegresa && !form.fechaFin) {
      errs.push("La hora de regreso es obligatoria si el empleado regresa");
    }
    if (!form.observacion.trim()) errs.push("La observación es obligatoria");
    return errs;
  }

  function toggleVoiceDictation() {
    if (!speechSupported || !recognitionRef.current) {
      setError("El dictado por voz no está disponible en este navegador.");
      return;
    }

    setError("");

    try {
      if (isListening) {
        recognitionRef.current.stop();
      } else {
        recognitionRef.current.start();
      }
    } catch (err) {
      console.warn("[NuevoMovimientoModal] toggle voice error:", err);
      setError("No se pudo iniciar el dictado por voz.");
      setIsListening(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    setError("");

    const errs = validar();
    if (errs.length) {
      setError(errs.join(" • "));
      setSubmitting(false);
      return;
    }

    const empleadoSel = empleados.find((e) => e._id === form.personaId);
    const personaNombre = empleadoSel?.nombreCompleto || "";
    const depto = empleadoSel?.departamento || "";
    const salidaLocal = form.fechaHora
      ? formatDateTime(new Date(form.fechaHora))
      : "";
    const regresoLocal = form.fechaFin
      ? formatDateTime(new Date(form.fechaFin))
      : "";
    const fechaIso = form.fechaHora
      ? new Date(form.fechaHora).toISOString().slice(0, 10)
      : "";

    const nuevoRegistro = {
      fechaHora: salidaLocal,
      fechaFin: form.noRegresa ? undefined : regresoLocal,
      noRegresa: !!form.noRegresa,
      tipo: PERMISO_LABEL,
      persona: personaNombre,
      personaId: form.personaId,
      departamento: depto,
      placa: form.placa.trim().toUpperCase(),
      observacion: form.observacion.trim(),
      fechaIso,
    };

    onCreated?.(nuevoRegistro);
    onClose?.();
    setSubmitting(false);
  }

  return (
    <div
      className={UI.modalOverlayHigh}
      style={{ background: "rgba(2, 6, 23, 0.5)" }}
    >
      <div className="w-full max-w-xl rounded-[22px]" style={sxCard()}>
        <div
          className={UI.modalHeader}
          style={{ borderBottom: "1px solid var(--border)" }}
        >
          <h2
            className="text-base sm:text-lg font-semibold"
            style={{ color: "var(--text)" }}
          >
            Registrar Permiso
          </h2>

          <button
            type="button"
            onClick={onClose}
            style={{ color: "var(--text-muted)" }}
          >
            ✕
          </button>
        </div>

        <form
          onSubmit={handleSubmit}
          className="px-4 sm:px-6 py-4 sm:py-5 space-y-4"
        >
          {error && (
            <div className={UI.mutedBox} style={sxMutedBox()}>
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
            <Field label="Tipo">
              <input
                type="text"
                className={UI.fieldInput}
                style={sxInput({ color: "var(--text-muted)" })}
                value={PERMISO_LABEL}
                readOnly
              />
            </Field>

            <Field label="Empleado">
              <select
                className={UI.fieldSelect}
                style={sxInput()}
                value={form.personaId}
                onChange={(e) => setVal("personaId", e.target.value)}
                required
              >
                <option value="">- Seleccionar -</option>
                {personaOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Placa del vehículo (opcional)">
              <input
                className={UI.fieldInput}
                style={sxInput()}
                value={form.placa}
                onChange={(e) => setVal("placa", e.target.value)}
              />
            </Field>

            <Field label="Hora de salida (inicio)">
              <input
                type="datetime-local"
                className={UI.fieldInput}
                style={sxInput()}
                value={form.fechaHora}
                onChange={(e) => setVal("fechaHora", e.target.value)}
                required
              />
            </Field>

            <Field label="Hora de regreso (fin)">
              <input
                type="datetime-local"
                className={UI.fieldInput}
                style={sxInput()}
                value={form.fechaFin}
                onChange={(e) => setVal("fechaFin", e.target.value)}
                disabled={form.noRegresa}
                required={!form.noRegresa}
              />
            </Field>

            <Field label="No regresa">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="noRegresaCheckbox"
                  checked={form.noRegresa}
                  onChange={(e) => setVal("noRegresa", e.target.checked)}
                  className="h-4 w-4"
                />
                <label
                  htmlFor="noRegresaCheckbox"
                  className="text-sm"
                  style={{ color: "var(--text)" }}
                >
                  No regresa
                </label>
              </div>
            </Field>

            <Field
              label={
                <div className="flex items-center justify-between gap-2 w-full">
                  <span>Observación</span>

                  <div className="flex items-center gap-2">
                    <span
                      className="inline-flex items-center gap-1 text-xs"
                      style={{ color: "var(--text-muted)" }}
                    >
                      <PencilLine className="h-3.5 w-3.5" />
                      Manual
                    </span>

                    <button
                      type="button"
                      onClick={toggleVoiceDictation}
                      disabled={!speechSupported}
                      className="inline-flex items-center gap-1 rounded-[12px] px-2.5 py-1 text-xs transition-all duration-150"
                      style={{
                        ...sxGhostBtn(),
                        opacity: speechSupported ? 1 : 0.55,
                        border: isListening
                          ? "1px solid rgba(34, 197, 94, 0.45)"
                          : "1px solid var(--border)",
                        boxShadow: isListening
                          ? "0 0 0 2px rgba(34,197,94,0.12)"
                          : "var(--shadow-sm)",
                      }}
                      title={
                        speechSupported
                          ? isListening
                            ? "Detener dictado"
                            : "Iniciar dictado por voz"
                          : "Dictado por voz no disponible"
                      }
                    >
                      {isListening ? (
                        <MicOff className="h-3.5 w-3.5" />
                      ) : (
                        <Mic className="h-3.5 w-3.5" />
                      )}
                      <span>{isListening ? "Detener" : "Micrófono"}</span>
                    </button>
                  </div>
                </div>
              }
              span={2}
            >
              <div className="space-y-2">
                <textarea
                  className={UI.fieldInput}
                  style={sxInput()}
                  rows={4}
                  value={form.observacion}
                  onChange={(e) => setVal("observacion", e.target.value)}
                  placeholder="Escriba manualmente o use el micrófono para dictar..."
                  required
                />

                <div
                  className="text-xs"
                  style={{
                    color: isListening ? "#22c55e" : "var(--text-muted)",
                  }}
                >
                  {isListening
                    ? "Escuchando... hable ahora para llenar la observación."
                    : speechSupported
                    ? "Puede escribir manualmente o usar dictado por voz."
                    : "Puede escribir manualmente. El dictado por voz no está disponible en este navegador."}
                </div>
              </div>
            </Field>
          </div>

          <div className="flex flex-col sm:flex-row justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className={UI.btnGhost}
              style={sxGhostBtn()}
              disabled={submitting}
            >
              Cancelar
            </button>

            <button
              type="submit"
              className={UI.btnSuccess}
              style={sxSuccessBtn()}
              disabled={submitting}
            >
              {submitting ? "Guardando…" : "Guardar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}