import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { API_BASE, UI } from "../utils/accesos.constants.js";
import {
  sxCard,
  sxGhostBtn,
  sxInput,
  sxMutedBox,
  sxPrimaryBtn,
} from "../utils/accesos.helpers.js";
import { validateEmpleadoForm } from "../utils/accesos.validators.js";
import Field from "./Field.jsx";

export default function NuevoEmpleadoModal({
  open,
  onClose,
  onCreated,
  sexos = [],
  estados = [],
  departamentos = [],
  cargos = [],
}) {
  const { t } = useTranslation();

  const INITIAL = {
    nombreCompleto: "",
    id_persona: "",
    dni: "",
    fechaNacimiento: "",
    sexo: "",
    direccion: "",
    telefono: "",
    departamento: "",
    cargo: "",
    fechaIngreso: "",
    estado: "Activo",
  };

  const [form, setForm] = useState(INITIAL);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setForm(INITIAL);
      setError("");
    }
  }, [open]);

  if (!open) return null;

  const setVal = (k, v) => setForm((s) => ({ ...s, [k]: v }));

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    setError("");

    const errors = validateEmpleadoForm(form);
    if (errors.length) {
      setError(errors.join(" • "));
      setSubmitting(false);
      return;
    }

    try {
      const body = {
        nombreCompleto: form.nombreCompleto.trim(),
        idInterno: form.id_persona.trim(),
        dni: form.dni.trim(),
        fechaNacimiento: form.fechaNacimiento || null,
        sexo: form.sexo || "",
        direccion: form.direccion.trim(),
        telefono: form.telefono.trim(),
        departamento: form.departamento.trim(),
        cargo: form.cargo.trim(),
        fechaIngreso: form.fechaIngreso || null,
        activo: form.estado === "Activo",
      };

      const res = await fetch(`${API_BASE}/acceso/empleados`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok || data?.ok === false) {
        throw new Error(
          data?.error ||
            t("access.employeeModal.createError", {
              defaultValue: "Error creando empleado",
            })
        );
      }

      onCreated?.(data.item);
      onClose?.();
      setForm(INITIAL);
    } catch (err) {
      setError(
        err.message ||
          t("system.errorGeneric", {
            defaultValue: "Error inesperado",
          })
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className={UI.modalOverlay} style={{ background: "rgba(2, 6, 23, 0.5)" }}>
      <div className="w-full max-w-3xl rounded-[22px]" style={sxCard()}>
        <div className={UI.modalHeader} style={{ borderBottom: "1px solid var(--border)" }}>
          <h2 className="text-base sm:text-lg font-semibold" style={{ color: "var(--text)" }}>
            {t("access.employeeModal.title", {
              defaultValue: "Registrar Nuevo Empleado",
            })}
          </h2>
          <button onClick={onClose} style={{ color: "var(--text-muted)" }}>
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-4 sm:px-6 py-4 sm:py-5 space-y-4">
          {error && (
            <div className={UI.mutedBox} style={sxMutedBox()}>
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
            <Field label={t("access.employeeModal.fullName")}>
              <input
                className={UI.fieldInput}
                style={sxInput()}
                value={form.nombreCompleto}
                onChange={(e) => setVal("nombreCompleto", e.target.value)}
                required
              />
            </Field>

            <Field label={t("access.employeeModal.personId")}>
              <input
                className={UI.fieldInput}
                style={sxInput()}
                value={form.id_persona}
                onChange={(e) => setVal("id_persona", e.target.value)}
                required
              />
            </Field>

            <Field label="DNI">
              <input
                className={UI.fieldInput}
                style={sxInput()}
                value={form.dni}
                onChange={(e) => setVal("dni", e.target.value)}
                maxLength={17}
                required
              />
            </Field>

            <Field label={t("access.employeeModal.birthDate")}>
              <input
                type="date"
                className={UI.fieldInput}
                style={sxInput()}
                value={form.fechaNacimiento}
                onChange={(e) => setVal("fechaNacimiento", e.target.value)}
                required
              />
            </Field>

            <Field label={t("access.employeeModal.gender")}>
              <select
                className={UI.fieldSelect}
                style={sxInput()}
                value={form.sexo}
                onChange={(e) => setVal("sexo", e.target.value)}
                required
              >
                <option value="">
                  {t("system.select", { defaultValue: "- Seleccionar -" })}
                </option>
                {sexos.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </Field>

            <Field label={t("access.employeeModal.phone")}>
              <input
                className={UI.fieldInput}
                style={sxInput()}
                value={form.telefono}
                onChange={(e) => setVal("telefono", e.target.value)}
                maxLength={9}
                required
              />
            </Field>

            <Field label={t("access.employeeModal.address")} span={2}>
              <input
                className={UI.fieldInput}
                style={sxInput()}
                value={form.direccion}
                onChange={(e) => setVal("direccion", e.target.value)}
                required
              />
            </Field>

            <Field label={t("access.employeeModal.department")}>
              <select
                className={UI.fieldSelect}
                style={sxInput()}
                value={form.departamento}
                onChange={(e) => setVal("departamento", e.target.value)}
                required
              >
                <option value="">
                  {t("system.select", { defaultValue: "- Seleccionar -" })}
                </option>
                {departamentos.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </Field>

            <Field label={t("access.employeeModal.position")}>
              <select
                className={UI.fieldSelect}
                style={sxInput()}
                value={form.cargo}
                onChange={(e) => setVal("cargo", e.target.value)}
                required
              >
                <option value="">
                  {t("system.select", { defaultValue: "- Seleccionar -" })}
                </option>
                {cargos.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </Field>

            <Field label={t("access.employeeModal.entryDate")}>
              <input
                type="date"
                className={UI.fieldInput}
                style={sxInput()}
                value={form.fechaIngreso}
                onChange={(e) => setVal("fechaIngreso", e.target.value)}
                required
              />
            </Field>

            <Field label={t("access.employeeModal.status")}>
              <select
                className={UI.fieldSelect}
                style={sxInput()}
                value={form.estado}
                onChange={(e) => setVal("estado", e.target.value)}
                required
              >
                {estados.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
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
              {t("actions.cancel")}
            </button>
            <button
              type="submit"
              className={UI.btnPrimary}
              style={sxPrimaryBtn()}
              disabled={submitting}
            >
              {submitting
                ? t("actions.saving", { defaultValue: "Guardando…" })
                : t("actions.save")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}