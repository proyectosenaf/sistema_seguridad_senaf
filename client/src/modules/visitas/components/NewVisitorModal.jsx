import React, { useEffect, useRef, useState } from "react";

// Lista de marcas
const VEHICLE_BRANDS = [
  "Toyota",
  "Honda",
  "Nissan",
  "Hyundai",
  "Kia",
  "Chevrolet",
  "Mazda",
  "Ford",
  "Mitsubishi",
  "Suzuki",
  "Volkswagen",
  "Mercedes-Benz",
  "BMW",
  "Audi",
  "Renault",
  "Peugeot",
  "Fiat",
  "Jeep",
  "Subaru",
  "Isuzu",
  "JAC",
  "Great Wall",
  "Changan",
  "Chery",
  "Otra", // para marcas no listadas
];

// Modelos base por marca (sin año)
const VEHICLE_MODELS_BASE_BY_BRAND = {
  Toyota: ["Corolla", "Hilux", "RAV4", "Yaris", "Prado"],
  Honda: ["Civic", "CR-V", "Fit", "HR-V"],
  Nissan: ["Versa", "Frontier", "Sentra", "Kicks"],
  Hyundai: ["Elantra", "Tucson", "Santa Fe", "Accent", "Creta"],
  Kia: ["Rio", "Sportage", "Sorento", "Picanto"],
  Chevrolet: ["Aveo", "Onix", "Tracker", "Captiva"],
  Mazda: ["Mazda 2", "Mazda 3", "CX-5", "CX-30"],
  Ford: ["Ranger", "Explorer", "Escape", "Fiesta"],
  Mitsubishi: ["L200", "Outlander", "Montero Sport"],
  Suzuki: ["Swift", "Vitara", "Jimny"],
  Volkswagen: ["Jetta", "Gol", "Tiguan", "Amarok"],
  "Mercedes-Benz": ["Clase C", "Clase E", "GLA"],
  BMW: ["Serie 3", "Serie 5", "X3", "X5"],
  Audi: ["A3", "A4", "Q3", "Q5"],
  Renault: ["Duster", "Koleos", "Logan"],
  Peugeot: ["208", "3008", "2008"],
  Fiat: ["Uno", "Argo", "Strada"],
  Jeep: ["Wrangler", "Renegade", "Cherokee"],
  Subaru: ["Impreza", "Forester", "Outback"],
  Isuzu: ["D-MAX"],
  JAC: ["JS2", "JS4", "T8"],
  "Great Wall": ["Wingle", "Poer"],
  Changan: ["CS15", "CS35", "CS55"],
  Chery: ["Tiggo 2", "Tiggo 4", "Tiggo 7"],
};

const START_YEAR = 2000;
const CURRENT_YEAR = new Date().getFullYear();

export default function NewVisitorModal({ onClose, onSubmit }) {
  const [name, setName] = useState("");
  const [document, setDocument] = useState("");
  const [company, setCompany] = useState("");
  const [employee, setEmployee] = useState("");
  const [reason, setReason] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Vehículo
  const [hasVehicle, setHasVehicle] = useState(false);
  const [vehicleBrand, setVehicleBrand] = useState("");
  const [vehicleModel, setVehicleModel] = useState("");
  const [vehicleModelCustom, setVehicleModelCustom] = useState(""); // para modelos/años < 2000 o especiales
  const [vehiclePlate, setVehiclePlate] = useState("");

  const firstInputRef = useRef(null);

  // ===== Helpers de horario de atención (igual que tenías) =====
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
  // ============================================================

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

      let finalModel = vehicleModelCustom.trim() || vehicleModel.trim();

      if (hasVehicle) {
        if (!vehicleBrand.trim() || !finalModel || !vehiclePlate.trim()) {
          alert("Completa los datos del vehículo (marca, modelo y placa).");
          setSubmitting(false);
          return;
        }
      }

      const now = new Date();
      if (!isWithinBusinessHours(now)) {
        alert(
          `No se puede registrar la visita fuera del horario permitido.\n${businessHoursMessage()}`
        );
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
        vehicle: hasVehicle
          ? {
              brand: vehicleBrand.trim(),
              model: finalModel, // aquí ya va "Corolla 2005" o lo que elija/escriba
              plate: vehiclePlate.trim(),
            }
          : null,
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

  // Modelos (con año 2000–actual) correspondientes a la marca seleccionada
  const modelsForBrand =
    vehicleBrand && VEHICLE_MODELS_BASE_BY_BRAND[vehicleBrand]
      ? VEHICLE_MODELS_BASE_BY_BRAND[vehicleBrand].flatMap((base) => {
          const list = [];
          for (let y = START_YEAR; y <= CURRENT_YEAR; y++) {
            list.push(`${base} ${y}`);
          }
          return list;
        })
      : [];

  const showCustomModelInput =
    vehicleBrand === "Otra" || vehicleModel === "__customBefore2000";

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

          {/* ================== SECCIÓN VEHÍCULO ================== */}
          <div className="md:col-span-2 mt-1 border-t border-neutral-800/60 pt-3">
            <div className="flex items-center gap-2">
              <input
                id="has-vehicle"
                type="checkbox"
                className="h-4 w-4"
                checked={hasVehicle}
                onChange={(e) => {
                  const checked = e.target.checked;
                  setHasVehicle(checked);
                  if (!checked) {
                    setVehicleBrand("");
                    setVehicleModel("");
                    setVehicleModelCustom("");
                    setVehiclePlate("");
                  }
                }}
              />
              <label
                htmlFor="has-vehicle"
                className="text-xs text-neutral-300 cursor-pointer select-none"
              >
                El visitante llegó en vehículo
              </label>
            </div>

            {hasVehicle && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3">
                {/* Marca */}
                <div>
                  <label className="text-xs text-neutral-400">
                    Marca <span className="text-red-400">*</span>
                  </label>
                  <select
                    className="input-fx w-full"
                    value={vehicleBrand}
                    onChange={(e) => {
                      const val = e.target.value;
                      setVehicleBrand(val);
                      setVehicleModel("");
                      setVehicleModelCustom("");
                    }}
                  >
                    <option value="">Seleccione marca…</option>
                    {VEHICLE_BRANDS.map((b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Modelo (2000–actual o manual para <2000) */}
                <div>
                  <label className="text-xs text-neutral-400">
                    Modelo <span className="text-red-400">*</span>
                  </label>
                  <select
                    className="input-fx w-full"
                    value={vehicleModel}
                    onChange={(e) => {
                      const val = e.target.value;
                      setVehicleModel(val);
                      if (val !== "__customBefore2000") {
                        setVehicleModelCustom("");
                      }
                    }}
                    disabled={!vehicleBrand || vehicleBrand === "Otra"}
                  >
                    <option value="">Seleccione modelo (año ≥ 2000)…</option>
                    {modelsForBrand.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                    <option value="__customBefore2000">
                      Otro modelo / año &lt; 2000 (escribir)
                    </option>
                  </select>

                  {/* Input manual: marca "Otra" o año < 2000 */}
                  {showCustomModelInput && (
                    <input
                      className="input-fx w-full mt-2"
                      value={vehicleModelCustom}
                      onChange={(e) => setVehicleModelCustom(e.target.value)}
                      placeholder="Escriba modelo y año (ej. Corolla 1998)"
                    />
                  )}
                </div>

                {/* Placa */}
                <div>
                  <label className="text-xs text-neutral-400">
                    Placa <span className="text-red-400">*</span>
                  </label>
                  <input
                    className="input-fx w-full"
                    value={vehiclePlate}
                    onChange={(e) => setVehiclePlate(e.target.value)}
                    placeholder="Ej. HAA-1234"
                  />
                </div>
              </div>
            )}
          </div>
          {/* ====================================================== */}

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
