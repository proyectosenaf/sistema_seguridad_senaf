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

// Longitudes / límites
const DNI_DIGITS = 13; // 0801YYYYXXXXX
const PHONE_MIN_DIGITS = 8;
const NAME_MAX = 40;
const COMPANY_MAX = 20;
const EMP_MAX = 20;
const REASON_MAX = 20;
const EMAIL_MAX = 25;

export default function NewVisitorModal({ onClose, onSubmit }) {
  const [name, setName] = useState("");
  const [document, setDocument] = useState("");
  const [company, setCompany] = useState("");
  const [employee, setEmployee] = useState("");
  const [reason, setReason] = useState("");
  const [phone, setPhone] = useState("+504 ");
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Vehículo
  const [hasVehicle, setHasVehicle] = useState(false);
  const [vehicleBrand, setVehicleBrand] = useState("");
  const [vehicleModel, setVehicleModel] = useState("");
  const [vehicleModelCustom, setVehicleModelCustom] = useState("");
  const [vehiclePlate, setVehiclePlate] = useState("");

  // Errores de validación
  const [errors, setErrors] = useState({});

  const firstInputRef = useRef(null);

  // ===== Horario (modo pruebas) =====
  function isWithinBusinessHours(date) {
    if (!(date instanceof Date) || isNaN(date.getTime())) return false;
    return true;
  }

  function businessHoursMessage() {
    return "Modo pruebas: actualmente se permite registrar visitas en cualquier horario.";
  }
  // ==================================

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

  // ---------- Handlers de cambio + limpieza de errores ----------

  const handleNameChange = (e) => {
    // Solo letras (con tildes) y espacios, máx 40
    let val = e.target.value
      .replace(/[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ\s]/g, "")
      .slice(0, NAME_MAX);
    setName(val);
    setErrors((prev) => ({ ...prev, name: undefined }));
  };

  const handleDocumentChange = (e) => {
    // Solo dígitos, 13 en total, formateados como 0801-YYYY-XXXXX
    const digits = e.target.value.replace(/\D/g, "").slice(0, DNI_DIGITS);

    let formatted = digits;
    if (digits.length > 4 && digits.length <= 8) {
      formatted = `${digits.slice(0, 4)}-${digits.slice(4)}`;
    } else if (digits.length > 8) {
      formatted = `${digits.slice(0, 4)}-${digits.slice(4, 8)}-${digits.slice(
        8
      )}`;
    }

    setDocument(formatted);
    setErrors((prev) => ({ ...prev, document: undefined }));
  };

  const handleCompanyChange = (e) => {
    // Solo letras y espacios, máx 20
    let val = e.target.value
      .replace(/[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ\s]/g, "")
      .slice(0, COMPANY_MAX);
    setCompany(val);
    setErrors((prev) => ({ ...prev, company: undefined }));
  };

  const handleEmployeeChange = (e) => {
    // Solo letras y espacios, máx 20
    let val = e.target.value
      .replace(/[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ\s]/g, "")
      .slice(0, EMP_MAX);
    setEmployee(val);
    setErrors((prev) => ({ ...prev, employee: undefined }));
  };

  const handleReasonChange = (e) => {
    // Solo letras y espacios, máx 20
    let val = e.target.value
      .replace(/[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ\s]/g, "")
      .slice(0, REASON_MAX);
    setReason(val);
    setErrors((prev) => ({ ...prev, reason: undefined }));
  };

  const handlePhoneChange = (e) => {
    // Mantener prefijo +504 y formatear +504 9999-9999
    let input = e.target.value;

    if (input.startsWith("+504")) {
      input = input.slice(4).trimStart();
    }

    const digits = input.replace(/\D/g, "").slice(0, PHONE_MIN_DIGITS);

    let localFormatted = "";
    if (digits.length <= 4) {
      localFormatted = digits;
    } else {
      localFormatted = `${digits.slice(0, 4)}-${digits.slice(4)}`;
    }

    const formatted = `+504 ${localFormatted}`;
    setPhone(formatted);
    setErrors((prev) => ({ ...prev, phone: undefined }));
  };

  const handleEmailChange = (e) => {
    // Alfanumérico + . _ - y @, sin espacios, máx 25
    let val = e.target.value.replace(/\s/g, "").slice(0, EMAIL_MAX);
    setEmail(val);
    setErrors((prev) => ({ ...prev, email: undefined }));
  };

  const handleVehicleBrandChange = (e) => {
    const val = e.target.value;
    setVehicleBrand(val);
    setVehicleModel("");
    setVehicleModelCustom("");
    setErrors((prev) => ({
      ...prev,
      vehicleBrand: undefined,
      vehicleModel: undefined,
    }));
  };

  const handleVehicleModelChange = (e) => {
    const val = e.target.value;
    setVehicleModel(val);
    if (val !== "__customBefore2000") {
      setVehicleModelCustom("");
    }
    setErrors((prev) => ({ ...prev, vehicleModel: undefined }));
  };

  const handleVehicleModelCustomChange = (e) => {
    setVehicleModelCustom(e.target.value);
    setErrors((prev) => ({ ...prev, vehicleModel: undefined }));
  };

  const handleVehiclePlateChange = (e) => {
    // Alfanumérico mayúscula y guion, máx 8 (ej. HAA-1234)
    const val = e.target.value
      .toUpperCase()
      .replace(/[^A-Z0-9-]/g, "")
      .slice(0, 8);
    setVehiclePlate(val);
    setErrors((prev) => ({ ...prev, vehiclePlate: undefined }));
  };

  // ---------- Validación del formulario ----------

  function validateForm() {
    const newErrors = {};

    // Nombre: obligatorio, máx 40, dos nombres y al menos un apellido
    const trimmedName = name.trim();
    const parts = trimmedName.split(/\s+/).filter(Boolean);
    if (!trimmedName) {
      newErrors.name = "El nombre es obligatorio.";
    } else if (trimmedName.length > NAME_MAX) {
      newErrors.name = `El nombre no debe superar ${NAME_MAX} caracteres.`;
    } else if (parts.length < 3) {
      newErrors.name =
        "Ingrese el nombre completo: dos nombres y al menos un apellido.";
    }

    // DNI: obligatorio y completo (13 dígitos)
    const dniDigits = document.replace(/\D/g, "");
    if (!dniDigits) {
      newErrors.document = "El DNI es obligatorio.";
    } else if (dniDigits.length !== DNI_DIGITS) {
      newErrors.document = `El DNI debe tener exactamente ${DNI_DIGITS} dígitos.`;
    }

    // Empresa: opcional, pero si la escribe máx 20
    if (company.trim() && company.trim().length > COMPANY_MAX) {
      newErrors.company = `La empresa no debe superar ${COMPANY_MAX} caracteres.`;
    }

    // Empleado anfitrión: obligatorio, máx 20
    const trimmedEmp = employee.trim();
    if (!trimmedEmp) {
      newErrors.employee = "El empleado anfitrión es obligatorio.";
    } else if (trimmedEmp.length > EMP_MAX) {
      newErrors.employee = `El empleado no debe superar ${EMP_MAX} caracteres.`;
    }

    // Motivo: obligatorio, máx 20
    const trimmedReason = reason.trim();
    if (!trimmedReason) {
      newErrors.reason = "El motivo es obligatorio.";
    } else if (trimmedReason.length > REASON_MAX) {
      newErrors.reason = `El motivo no debe superar ${REASON_MAX} caracteres.`;
    }

    // Teléfono: opcional, pero si se llena debe tener 8 dígitos después de +504
    const phoneTrimmed = phone.trim();
    if (phoneTrimmed && phoneTrimmed !== "+504") {
      const digits = phone.replace(/\D/g, "");
      const localDigits = digits.replace(/^504/, "");
      if (localDigits.length < PHONE_MIN_DIGITS) {
        newErrors.phone =
          "El teléfono debe tener 8 dígitos después de +504.";
      }
    }

    // Correo: opcional, pero si se llena -> máx 25, con @ y termina en .com o .org
    if (email.trim()) {
      if (email.length > EMAIL_MAX) {
        newErrors.email = `El correo no debe superar ${EMAIL_MAX} caracteres.`;
      } else if (!email.includes("@")) {
        newErrors.email = "El correo debe incluir el símbolo @.";
      } else {
        const emailRegex =
          /^[A-Za-z0-9._-]+@[A-Za-z0-9.-]+\.(com|org)$/i;
        if (!emailRegex.test(email.trim())) {
          newErrors.email =
            "El correo debe tener un dominio válido y terminar en .com o .org.";
        }
      }
    }

    // Vehículo (si aplica)
    const finalModel = vehicleModelCustom.trim() || vehicleModel.trim();

    if (hasVehicle) {
      if (!vehicleBrand.trim()) {
        newErrors.vehicleBrand = "La marca es obligatoria.";
      }
      if (!finalModel) {
        newErrors.vehicleModel = "El modelo es obligatorio.";
      }
      const plate = vehiclePlate.trim();
      if (!plate) {
        newErrors.vehiclePlate = "La placa es obligatoria.";
      } else {
        // Placa: 5–8 caracteres, al menos una letra y un número
        const plateRegex = /^(?=.*[A-Z])(?=.*\d)[A-Z0-9-]{5,8}$/;
        if (!plateRegex.test(plate)) {
          newErrors.vehiclePlate =
            "Placa inválida. Use letras mayúsculas, números y guion (5 a 8 caracteres).";
        }
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  // ---------- Submit ----------

  async function handleSubmit(e) {
    e.preventDefault();
    if (submitting) return;

    if (!validateForm()) return;

    setSubmitting(true);

    try {
      const finalModel = vehicleModelCustom.trim() || vehicleModel.trim();
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
              model: finalModel,
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

  // Modelos según marca seleccionada
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
        className="w-full max-w-[560px] mx-2 card-rich p-4 md:p-5 max-h-[90vh] overflow-y-auto"
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-visitor-title"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-4">
          <h3
            id="new-visitor-title"
            className="text-lg font-semibold text-neutral-100"
          >
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

        {/* Formulario */}
        <form
          onSubmit={handleSubmit}
          className="grid grid-cols-1 md:grid-cols-2 gap-3"
        >
          <div className="md:col-span-2">
            <label className="text-xs text-neutral-400">Nombre completo</label>
            <input
              ref={firstInputRef}
              className="input-fx w-full"
              value={name}
              onChange={handleNameChange}
              placeholder="Ej. María Fernanda López Pérez"
              required
            />
            {errors.name && (
              <p className="text-xs text-red-400 mt-1">{errors.name}</p>
            )}
          </div>

          <div>
            <label className="text-xs text-neutral-400">DNI</label>
            <input
              className="input-fx w-full"
              value={document}
              onChange={handleDocumentChange}
              placeholder="0801-YYYY-XXXXX"
              required
              inputMode="numeric"
            />
            {errors.document && (
              <p className="text-xs text-red-400 mt-1">{errors.document}</p>
            )}
          </div>

          <div>
            <label className="text-xs text-neutral-400">Empresa</label>
            <input
              className="input-fx w-full"
              value={company}
              onChange={handleCompanyChange}
              placeholder="SENAF / Munily"
            />
            {errors.company && (
              <p className="text-xs text-red-400 mt-1">{errors.company}</p>
            )}
          </div>

          <div className="md:col-span-2">
            <label className="text-xs text-neutral-400">
              Empleado anfitrión
            </label>
            <input
              className="input-fx w-full"
              value={employee}
              onChange={handleEmployeeChange}
              placeholder="Nombre de la persona que visita"
              required
            />
            {errors.employee && (
              <p className="text-xs text-red-400 mt-1">{errors.employee}</p>
            )}
          </div>

          <div className="md:col-span-2">
            <label className="text-xs text-neutral-400">Motivo</label>
            <input
              className="input-fx w-full"
              value={reason}
              onChange={handleReasonChange}
              placeholder="Reunión / Entrega / Mantenimiento…"
              required
            />
            {errors.reason && (
              <p className="text-xs text-red-400 mt-1">{errors.reason}</p>
            )}
          </div>

          <div>
            <label className="text-xs text-neutral-400">Teléfono</label>
            <input
              className="input-fx w-full"
              value={phone}
              onChange={handlePhoneChange}
              placeholder="+504 9999-9999"
              type="tel"
              inputMode="tel"
            />
            {errors.phone && (
              <p className="text-xs text-red-400 mt-1">{errors.phone}</p>
            )}
          </div>

          <div>
            <label className="text-xs text-neutral-400">Correo</label>
            <input
              type="email"
              className="input-fx w-full"
              value={email}
              onChange={handleEmailChange}
              placeholder="correo@empresa.com"
            />
            {errors.email && (
              <p className="text-xs text-red-400 mt-1">{errors.email}</p>
            )}
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
                    setErrors((prev) => ({
                      ...prev,
                      vehicleBrand: undefined,
                      vehicleModel: undefined,
                      vehiclePlate: undefined,
                    }));
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
                    onChange={handleVehicleBrandChange}
                  >
                    <option value="">Seleccione marca…</option>
                    {VEHICLE_BRANDS.map((b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                  </select>
                  {errors.vehicleBrand && (
                    <p className="text-xs text-red-400 mt-1">
                      {errors.vehicleBrand}
                    </p>
                  )}
                </div>

                {/* Modelo */}
                <div>
                  <label className="text-xs text-neutral-400">
                    Modelo <span className="text-red-400">*</span>
                  </label>
                  <select
                    className="input-fx w-full"
                    value={vehicleModel}
                    onChange={handleVehicleModelChange}
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

                  {showCustomModelInput && (
                    <input
                      className="input-fx w-full mt-2"
                      value={vehicleModelCustom}
                      onChange={handleVehicleModelCustomChange}
                      placeholder="Escriba modelo y año (ej. Corolla 1998)"
                    />
                  )}
                  {errors.vehicleModel && (
                    <p className="text-xs text-red-400 mt-1">
                      {errors.vehicleModel}
                    </p>
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
                    onChange={handleVehiclePlateChange}
                    placeholder="Ej. HAA-1234"
                  />
                  {errors.vehiclePlate && (
                    <p className="text-xs text-red-400 mt-1">
                      {errors.vehiclePlate}
                    </p>
                  )}
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
