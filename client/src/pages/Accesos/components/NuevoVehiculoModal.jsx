import { useEffect, useState } from "react";
import { API_BASE, CATALOGS, UI } from "../utils/accesos.constants.js";
import {
  fetchCatalog,
  sxCard,
  sxGhostBtn,
  sxInput,
  sxMutedBox,
  sxSuccessBtn,
} from "../utils/accesos.helpers.js";
import Field from "./Field.jsx";

const OTHER_BRAND = "__OTRA_MARCA__";
const OTHER_MODEL = "__OTRO_MODELO__";

export default function NuevoVehiculoModal({
  open,
  onClose,
  onCreated,
  empleados,
  marcasVehiculos = [],
}) {
  const INITIAL = {
    empleadoId: "",
    marca: "",
    nuevaMarca: "",
    modelo: "",
    nuevoModelo: "",
    placa: "",
    enEmpresa: false,
  };

  const [form, setForm] = useState(INITIAL);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [modelosDisponibles, setModelosDisponibles] = useState([]);
  const [loadingModelos, setLoadingModelos] = useState(false);

  const isOtraMarca = form.marca === OTHER_BRAND;
  const isOtroModelo = form.modelo === OTHER_MODEL;

  useEffect(() => {
    if (open) {
      setForm(INITIAL);
      setError("");
      setModelosDisponibles([]);
    }
  }, [open]);

  useEffect(() => {
    let cancel = false;

    async function loadModelos() {
      if (!form.marca || form.marca === OTHER_BRAND) {
        setModelosDisponibles([]);
        return;
      }

      setLoadingModelos(true);

      try {
        const items = await fetchCatalog(
          `${CATALOGS.modelosVehiculos}?marca=${encodeURIComponent(form.marca)}`
        );
        if (!cancel) setModelosDisponibles(items);
      } catch (e) {
        console.warn("[NuevoVehiculoModal] error cargando modelos:", e);
        if (!cancel) setModelosDisponibles([]);
      } finally {
        if (!cancel) setLoadingModelos(false);
      }
    }

    loadModelos();

    return () => {
      cancel = true;
    };
  }, [form.marca]);

  if (!open) return null;

  const setVal = (k, v) => setForm((s) => ({ ...s, [k]: v }));

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError("");

    try {
      const marcaFinal = isOtraMarca ? form.nuevaMarca.trim() : form.marca;
      const modeloFinal = isOtroModelo ? form.nuevoModelo.trim() : form.modelo.trim();
      const placaTrim = form.placa.trim().toUpperCase();

      if (!form.empleadoId || !marcaFinal || !modeloFinal || !placaTrim) {
        setError("Todos los campos son obligatorios.");
        setSaving(false);
        return;
      }

      if (!/^[A-Za-z0-9]{7}$/.test(placaTrim)) {
        setError("La placa debe tener exactamente 7 caracteres alfanuméricos.");
        setSaving(false);
        return;
      }

      const body = {
        empleado: form.empleadoId,
        marca: marcaFinal,
        modelo: modeloFinal,
        placa: placaTrim,
        enEmpresa: !!form.enEmpresa,
      };

      const res = await fetch(`${API_BASE}/acceso/vehiculos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok || data?.ok === false) {
        throw new Error(data?.error || "No se pudo crear el vehículo");
      }

      onCreated?.();
      onClose?.();
    } catch (err) {
      setError(err.message || "Error inesperado");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className={UI.modalOverlay}
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
            Registrar Nuevo Vehículo
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

          <div className="grid grid-cols-1 gap-3 sm:gap-4">
            <Field label="Empleado">
              <select
                className={UI.fieldSelect}
                style={sxInput()}
                value={form.empleadoId}
                onChange={(e) => setVal("empleadoId", e.target.value)}
                required
              >
                <option value="">- Seleccionar -</option>
                {empleados.map((e) => (
                  <option key={e._id} value={e._id}>
                    {e.nombreCompleto} {e.id_persona ? `(${e.id_persona})` : ""}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Marca">
              <select
                className={UI.fieldSelect}
                style={sxInput()}
                value={form.marca}
                onChange={(e) => {
                  const value = e.target.value;
                  setForm((s) => ({
                    ...s,
                    marca: value,
                    nuevaMarca: value === OTHER_BRAND ? s.nuevaMarca : "",
                    modelo: "",
                    nuevoModelo: "",
                  }));
                }}
                required
              >
                <option value="">- Seleccionar -</option>
                {marcasVehiculos.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
                <option value={OTHER_BRAND}>Otro...</option>
              </select>
            </Field>

            {isOtraMarca && (
              <Field label="Nueva marca">
                <input
                  className={UI.fieldInput}
                  style={sxInput()}
                  value={form.nuevaMarca}
                  onChange={(e) => setVal("nuevaMarca", e.target.value)}
                  placeholder="Escriba la nueva marca"
                  required
                />
              </Field>
            )}

            <Field label="Modelo">
              <select
                className={UI.fieldSelect}
                style={sxInput()}
                value={form.modelo}
                onChange={(e) => {
                  const value = e.target.value;
                  setForm((s) => ({
                    ...s,
                    modelo: value,
                    nuevoModelo: value === OTHER_MODEL ? s.nuevoModelo : "",
                  }));
                }}
                required
                disabled={
                  (!form.marca && !isOtraMarca) ||
                  (!isOtraMarca && loadingModelos)
                }
              >
                <option value="">
                  {loadingModelos && !isOtraMarca
                    ? "Cargando modelos..."
                    : "- Seleccionar -"}
                </option>

                {!isOtraMarca &&
                  modelosDisponibles.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}

                <option value={OTHER_MODEL}>Otro...</option>
              </select>
            </Field>

            {isOtroModelo && (
              <Field label="Nuevo modelo">
                <input
                  className={UI.fieldInput}
                  style={sxInput()}
                  value={form.nuevoModelo}
                  onChange={(e) => setVal("nuevoModelo", e.target.value)}
                  placeholder="Escriba el nuevo modelo"
                  required
                />
              </Field>
            )}

            <Field label="Placa">
              <input
                className={UI.fieldInput}
                style={sxInput()}
                value={form.placa}
                onChange={(e) => setVal("placa", e.target.value)}
                maxLength={7}
                placeholder="7 caracteres alfanuméricos"
                required
              />
            </Field>

            <div className="flex items-center gap-2">
              <input
                id="enEmpresaChk"
                type="checkbox"
                className="h-4 w-4"
                checked={form.enEmpresa}
                onChange={(e) => setVal("enEmpresa", e.target.checked)}
              />
              <label
                htmlFor="enEmpresaChk"
                className="text-sm"
                style={{ color: "var(--text)" }}
              >
                En Empresa
              </label>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className={UI.btnGhost}
              style={sxGhostBtn()}
              disabled={saving}
            >
              Cancelar
            </button>

            <button
              type="submit"
              className={UI.btnSuccess}
              style={sxSuccessBtn()}
              disabled={saving}
            >
              {saving ? "Guardando…" : "Guardar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}