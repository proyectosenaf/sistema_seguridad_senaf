import React, { useEffect, useRef, useState } from "react";

// 🔹 BASE DEL BACKEND
const ROOT = (
  import.meta.env.VITE_API_BASE_URL || "http://localhost:4000/api"
).replace(/\/$/, "");

// 🔹 ENDPOINTS DE CATÁLOGOS
const VEHICLE_BRANDS_API_URL =
  import.meta.env.VITE_VEHICLE_BRANDS_API_URL ||
  `${ROOT}/catalogos/vehiculos/marcas`;

const VEHICLE_MODELS_API_URL =
  import.meta.env.VITE_VEHICLE_MODELS_API_URL ||
  `${ROOT}/catalogos/vehiculos/modelos`;

// Longitudes / límites
const DNI_DIGITS = 13;
const PHONE_MIN_DIGITS = 8;
const NAME_MAX = 40;
const COMPANY_MAX = 20;
const EMP_MAX = 20;
const REASON_MAX = 20;
const EMAIL_MAX = 25;

function sxCard(extra = {}) {
  return {
    background: "color-mix(in srgb, var(--card) 90%, transparent)",
    border: "1px solid var(--border)",
    boxShadow: "var(--shadow-md)",
    backdropFilter: "blur(12px) saturate(130%)",
    WebkitBackdropFilter: "blur(12px) saturate(130%)",
    ...extra,
  };
}

function sxInput(extra = {}) {
  return {
    background: "var(--input-bg)",
    color: "var(--text)",
    border: "1px solid var(--input-border)",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,.04)",
    ...extra,
  };
}

function sxGhostBtn(extra = {}) {
  return {
    background: "color-mix(in srgb, var(--card-solid) 88%, transparent)",
    color: "var(--text)",
    border: "1px solid var(--border)",
    boxShadow: "var(--shadow-sm)",
    ...extra,
  };
}

function sxPrimaryBtn(extra = {}) {
  return {
    background: "linear-gradient(135deg, #2563eb, #06b6d4)",
    color: "#fff",
    border: "1px solid transparent",
    boxShadow: "0 10px 20px color-mix(in srgb, #2563eb 22%, transparent)",
    ...extra,
  };
}

function normalizeCatalogArray(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.data)) return data.data;
  return [];
}

function normalizeBrandItem(item) {
  if (typeof item === "string") return item;
  return item?.name || item?.label || item?.marca || item?.value || "";
}

function normalizeModelItem(item) {
  if (typeof item === "string") return item;
  return item?.name || item?.label || item?.modelo || item?.value || "";
}

export default function NewVisitorModal({
  onClose,
  onSubmit,
  knownVisitors = [],
  editingVisitor = null,
}) {
  const allKnown = Array.isArray(knownVisitors) ? knownVisitors : [];

  const [name, setName] = useState("");
  const [document, setDocument] = useState("");
  const [company, setCompany] = useState("");
  const [employee, setEmployee] = useState("");
  const [reason, setReason] = useState("");
  const [phone, setPhone] = useState("+504 ");
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [visitType, setVisitType] = useState("Personal");
  const [acompanado, setAcompanado] = useState(false);

  const [hasVehicle, setHasVehicle] = useState(false);
  const [vehicleBrand, setVehicleBrand] = useState("");
  const [vehicleModel, setVehicleModel] = useState("");
  const [vehicleModelCustom, setVehicleModelCustom] = useState("");
  const [vehiclePlate, setVehiclePlate] = useState("");

  const [vehicleBrands, setVehicleBrands] = useState([]);
  const [vehicleModels, setVehicleModels] = useState([]);
  const [loadingBrands, setLoadingBrands] = useState(false);
  const [loadingModels, setLoadingModels] = useState(false);

  const [errors, setErrors] = useState({});

  const firstInputRef = useRef(null);
  const [autoFilledByName, setAutoFilledByName] = useState(false);

  function isWithinBusinessHours(date) {
    if (!(date instanceof Date) || isNaN(date.getTime())) return false;
    return true;
  }

  function businessHoursMessage() {
    return "Modo pruebas: actualmente se permite registrar visitas en cualquier horario.";
  }

  useEffect(() => {
    let mounted = true;

    (async () => {
      setLoadingBrands(true);
      try {
        const res = await fetch(VEHICLE_BRANDS_API_URL, {
          headers: { Accept: "application/json" },
        });
        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
          throw new Error(data?.error || "No se pudieron cargar las marcas");
        }

        const items = normalizeCatalogArray(data)
          .map(normalizeBrandItem)
          .map((x) => String(x || "").trim())
          .filter(Boolean);

        if (!mounted) return;
        setVehicleBrands(items);
      } catch (err) {
        console.warn("[NewVisitorModal] error cargando marcas:", err);
        if (!mounted) return;
        setVehicleBrands([]);
      } finally {
        if (mounted) setLoadingBrands(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;

    if (!vehicleBrand || vehicleBrand === "Otra") {
      setVehicleModels([]);
      return;
    }

    (async () => {
      setLoadingModels(true);
      try {
        const url = `${VEHICLE_MODELS_API_URL}?marca=${encodeURIComponent(
          vehicleBrand
        )}`;

        const res = await fetch(url, {
          headers: { Accept: "application/json" },
        });
        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
          throw new Error(data?.error || "No se pudieron cargar los modelos");
        }

        const items = normalizeCatalogArray(data)
          .map(normalizeModelItem)
          .map((x) => String(x || "").trim())
          .filter(Boolean);

        if (!mounted) return;
        setVehicleModels(items);
      } catch (err) {
        console.warn("[NewVisitorModal] error cargando modelos:", err);
        if (!mounted) return;
        setVehicleModels([]);
      } finally {
        if (mounted) setLoadingModels(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [vehicleBrand]);

  useEffect(() => {
    if (!editingVisitor) return;

    setName(editingVisitor.name || "");
    setDocument(editingVisitor.document || "");
    setCompany(editingVisitor.company || "");
    setEmployee(editingVisitor.employee || "");
    setReason(editingVisitor.reason || "");
    setPhone(editingVisitor.phone || "+504 ");
    setEmail(editingVisitor.email || "");
    setVisitType(editingVisitor.visitType || editingVisitor.kind || "Personal");
    setAcompanado(!!editingVisitor.acompanado);

    const hasVeh =
      !!editingVisitor.vehiclePlate ||
      !!editingVisitor.vehicleBrand ||
      !!editingVisitor.vehicleModel;

    if (hasVeh) {
      setHasVehicle(true);
      setVehicleBrand(editingVisitor.vehicleBrand || "");
      setVehicleModel(editingVisitor.vehicleModel || "");
      setVehicleModelCustom("");
      setVehiclePlate(editingVisitor.vehiclePlate || "");
    } else {
      setHasVehicle(false);
      setVehicleBrand("");
      setVehicleModel("");
      setVehicleModelCustom("");
      setVehiclePlate("");
    }

    setErrors({});
    setAutoFilledByName(false);
  }, [editingVisitor]);

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

  const normalizeDni = (str) => (str || "").replace(/\D/g, "");
  const normalizeName = (str) => (str || "").trim().toLowerCase();

  function autofillFromKnownVisitor(visitor) {
    if (!visitor) return;

    setCompany(visitor.company || "");
    setEmployee(visitor.employee || "");
    setPhone(visitor.phone || "+504 ");
    setEmail(visitor.email || "");
    setAcompanado(!!visitor.acompanado);

    if (visitor.company) {
      setVisitType("Profesional");
    } else {
      setVisitType("Personal");
    }

    const hasVeh =
      !!visitor.vehiclePlate ||
      !!visitor.vehicleBrand ||
      !!visitor.vehicleModel;

    if (hasVeh) {
      setHasVehicle(true);
      setVehicleBrand(visitor.vehicleBrand || "");
      setVehicleModel(visitor.vehicleModel || "");
      setVehicleModelCustom("");
      setVehiclePlate(visitor.vehiclePlate || "");
    } else {
      setHasVehicle(false);
      setVehicleBrand("");
      setVehicleModel("");
      setVehicleModelCustom("");
      setVehiclePlate("");
    }

    setErrors((prev) => ({
      ...prev,
      company: undefined,
      employee: undefined,
      phone: undefined,
      email: undefined,
      vehicleBrand: undefined,
      vehicleModel: undefined,
      vehiclePlate: undefined,
    }));
  }

  const handleNameChange = (e) => {
    let val = e.target.value
      .replace(/[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ\s]/g, "")
      .slice(0, NAME_MAX);

    setName(val);
    setErrors((prev) => ({ ...prev, name: undefined }));

    const trimmed = val.trim();

    if (!trimmed) {
      setAutoFilledByName(false);
      return;
    }

    const words = trimmed.split(/\s+/).filter(Boolean);

    if (!autoFilledByName && words.length >= 2) {
      const first = words[0].toLowerCase();
      const second = words[1].toLowerCase();

      const match = allKnown.find((v) => {
        const vWords = normalizeName(v.name).split(/\s+/).filter(Boolean);
        if (vWords.length < 2) return false;
        return vWords[0] === first && vWords[1] === second;
      });

      if (match) {
        setName(match.name || trimmed);

        if (match.document) {
          setDocument(match.document);
          setErrors((prev) => ({ ...prev, document: undefined }));
        }

        autofillFromKnownVisitor(match);
        setAutoFilledByName(true);
      }
    }
  };

  const handleDocumentChange = (e) => {
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

    if (digits.length === DNI_DIGITS) {
      const match = allKnown.find((v) => normalizeDni(v.document) === digits);
      if (match) {
        if (!name.trim()) {
          setName(match.name || "");
          setErrors((prev) => ({ ...prev, name: undefined }));
        }

        autofillFromKnownVisitor(match);
      }
    }
  };

  const handleCompanyChange = (e) => {
    let val = e.target.value
      .replace(/[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ\s]/g, "")
      .slice(0, COMPANY_MAX);
    setCompany(val);
    setErrors((prev) => ({ ...prev, company: undefined }));
  };

  const handleEmployeeChange = (e) => {
    let val = e.target.value
      .replace(/[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ\s]/g, "")
      .slice(0, EMP_MAX);
    setEmployee(val);
    setErrors((prev) => ({ ...prev, employee: undefined }));
  };

  const handleReasonChange = (e) => {
    let val = e.target.value
      .replace(/[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ\s]/g, "")
      .slice(0, REASON_MAX);
    setReason(val);
    setErrors((prev) => ({ ...prev, reason: undefined }));
  };

  const handlePhoneChange = (e) => {
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
    if (val !== "__custom") {
      setVehicleModelCustom("");
    }
    setErrors((prev) => ({ ...prev, vehicleModel: undefined }));
  };

  const handleVehicleModelCustomChange = (e) => {
    setVehicleModelCustom(e.target.value);
    setErrors((prev) => ({ ...prev, vehicleModel: undefined }));
  };

  const handleVehiclePlateChange = (e) => {
    const val = e.target.value
      .toUpperCase()
      .replace(/[^A-Z0-9-]/g, "")
      .slice(0, 8);
    setVehiclePlate(val);
    setErrors((prev) => ({ ...prev, vehiclePlate: undefined }));
  };

  function validateForm() {
    const newErrors = {};

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

    const dniDigits = document.replace(/\D/g, "");
    if (!dniDigits) {
      newErrors.document = "El DNI es obligatorio.";
    } else if (dniDigits.length !== DNI_DIGITS) {
      newErrors.document = `El DNI debe tener exactamente ${DNI_DIGITS} dígitos.`;
    }

    const trimmedCompany = company.trim();
    if (visitType === "Profesional") {
      if (!trimmedCompany) {
        newErrors.company =
          "La empresa es obligatoria para visitas profesionales.";
      } else if (trimmedCompany.length > COMPANY_MAX) {
        newErrors.company = `La empresa no debe superar ${COMPANY_MAX} caracteres.`;
      }
    } else {
      if (trimmedCompany && trimmedCompany.length > COMPANY_MAX) {
        newErrors.company = `La empresa no debe superar ${COMPANY_MAX} caracteres.`;
      }
    }

    const trimmedEmp = employee.trim();
    if (!trimmedEmp) {
      newErrors.employee = "El empleado anfitrión es obligatorio.";
    } else if (trimmedEmp.length > EMP_MAX) {
      newErrors.employee = `El empleado no debe superar ${EMP_MAX} caracteres.`;
    }

    const trimmedReason = reason.trim();
    if (!trimmedReason) {
      newErrors.reason = "El motivo es obligatorio.";
    } else if (trimmedReason.length > REASON_MAX) {
      newErrors.reason = `El motivo no debe superar ${REASON_MAX} caracteres.`;
    }

    const phoneTrimmed = phone.trim();
    if (phoneTrimmed && phoneTrimmed !== "+504") {
      const digits = phone.replace(/\D/g, "");
      const localDigits = digits.replace(/^504/, "");
      if (localDigits.length < PHONE_MIN_DIGITS) {
        newErrors.phone =
          "El teléfono debe tener 8 dígitos después de +504.";
      }
    }

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

    const finalModel =
      vehicleModel === "__custom"
        ? vehicleModelCustom.trim()
        : vehicleModel.trim();

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

  async function handleSubmit(e) {
    e.preventDefault();
    if (submitting) return;

    if (!validateForm()) return;

    setSubmitting(true);

    try {
      const finalModel =
        vehicleModel === "__custom"
          ? vehicleModelCustom.trim()
          : vehicleModel.trim();

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
        visitType,
        acompanado,
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

  const showCustomModelInput =
    vehicleBrand === "Otra" || vehicleModel === "__custom";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{
        background: "rgba(2, 6, 23, 0.68)",
        backdropFilter: "blur(6px)",
        WebkitBackdropFilter: "blur(6px)",
      }}
      onMouseDown={handleBackdrop}
    >
      <div
        className="w-full max-w-[560px] max-h-[90vh] overflow-y-auto rounded-[24px] p-4 md:p-5"
        style={sxCard()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-visitor-title"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-4">
          <h3
            id="new-visitor-title"
            className="text-lg font-semibold"
            style={{ color: "var(--text)" }}
          >
            {editingVisitor ? "Editar visitante" : "Registrar Visitante"}
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            style={{ color: "var(--text-muted)" }}
          >
            ✕
          </button>
        </div>

        <form
          onSubmit={handleSubmit}
          className="grid grid-cols-1 md:grid-cols-2 gap-3"
        >
          <div className="md:col-span-2">
            <label
              className="text-xs"
              style={{ color: "var(--text-muted)" }}
            >
              Nombre completo
            </label>
            <input
              ref={firstInputRef}
              className="w-full rounded-[14px] px-3 py-2 text-sm outline-none transition"
              style={sxInput()}
              value={name}
              onChange={handleNameChange}
              placeholder="Ej. María Fernanda López Pérez"
              required
            />
            {errors.name && (
              <p className="text-xs mt-1" style={{ color: "#f87171" }}>
                {errors.name}
              </p>
            )}
          </div>

          <div>
            <label
              className="text-xs"
              style={{ color: "var(--text-muted)" }}
            >
              DNI
            </label>
            <input
              className="w-full rounded-[14px] px-3 py-2 text-sm outline-none transition"
              style={sxInput()}
              value={document}
              onChange={handleDocumentChange}
              placeholder="0801-YYYY-XXXXX"
              required
              inputMode="numeric"
            />
            {errors.document && (
              <p className="text-xs mt-1" style={{ color: "#f87171" }}>
                {errors.document}
              </p>
            )}
          </div>

          <div>
            <label
              className="text-xs"
              style={{ color: "var(--text-muted)" }}
            >
              Tipo de visita
            </label>
            <select
              className="w-full rounded-[14px] px-3 py-2 text-sm outline-none transition"
              style={sxInput()}
              value={visitType}
              onChange={(e) => {
                const val = e.target.value;
                setVisitType(val);
                if (val === "Personal") {
                  setCompany("");
                }
                setErrors((prev) => ({ ...prev, company: undefined }));
              }}
            >
              <option value="Personal">Personal</option>
              <option value="Profesional">Profesional</option>
            </select>

            {visitType === "Profesional" && (
              <>
                <label
                  className="text-xs mt-3 block"
                  style={{ color: "var(--text-muted)" }}
                >
                  Empresa
                </label>
                <input
                  className="w-full rounded-[14px] px-3 py-2 text-sm outline-none transition"
                  style={sxInput()}
                  value={company}
                  onChange={handleCompanyChange}
                  placeholder="Nombre de la empresa"
                />
                {errors.company && (
                  <p className="text-xs mt-1" style={{ color: "#f87171" }}>
                    {errors.company}
                  </p>
                )}
              </>
            )}
          </div>

          <div className="md:col-span-2">
            <label
              className="text-xs"
              style={{ color: "var(--text-muted)" }}
            >
              Empleado anfitrión
            </label>
            <input
              className="w-full rounded-[14px] px-3 py-2 text-sm outline-none transition"
              style={sxInput()}
              value={employee}
              onChange={handleEmployeeChange}
              placeholder="Nombre de la persona que visita"
              required
            />
            {errors.employee && (
              <p className="text-xs mt-1" style={{ color: "#f87171" }}>
                {errors.employee}
              </p>
            )}
          </div>

          <div className="md:col-span-2">
            <label
              className="text-xs"
              style={{ color: "var(--text-muted)" }}
            >
              Motivo
            </label>
            <input
              className="w-full rounded-[14px] px-3 py-2 text-sm outline-none transition"
              style={sxInput()}
              value={reason}
              onChange={handleReasonChange}
              placeholder="Reunión / Entrega / Mantenimiento…"
              required
            />
            {errors.reason && (
              <p className="text-xs mt-1" style={{ color: "#f87171" }}>
                {errors.reason}
              </p>
            )}
          </div>

          <div>
            <label
              className="text-xs"
              style={{ color: "var(--text-muted)" }}
            >
              Teléfono
            </label>
            <input
              className="w-full rounded-[14px] px-3 py-2 text-sm outline-none transition"
              style={sxInput()}
              value={phone}
              onChange={handlePhoneChange}
              placeholder="+504 9999-9999"
              type="tel"
              inputMode="tel"
            />
            {errors.phone && (
              <p className="text-xs mt-1" style={{ color: "#f87171" }}>
                {errors.phone}
              </p>
            )}
          </div>

          <div>
            <label
              className="text-xs"
              style={{ color: "var(--text-muted)" }}
            >
              Correo
            </label>
            <input
              type="email"
              className="w-full rounded-[14px] px-3 py-2 text-sm outline-none transition"
              style={sxInput()}
              value={email}
              onChange={handleEmailChange}
              placeholder="correo@empresa.com"
            />
            {errors.email && (
              <p className="text-xs mt-1" style={{ color: "#f87171" }}>
                {errors.email}
              </p>
            )}
          </div>

          <div className="md:col-span-2 mt-1">
            <div className="flex items-center gap-2">
              <input
                id="acompanado"
                type="checkbox"
                className="h-4 w-4"
                checked={acompanado}
                onChange={(e) => setAcompanado(e.target.checked)}
              />
              <label
                htmlFor="acompanado"
                className="text-xs cursor-pointer select-none"
                style={{ color: "var(--text)" }}
              >
                El visitante viene acompañado
              </label>
            </div>
          </div>

          <div
            className="md:col-span-2 mt-1 pt-3"
            style={{ borderTop: "1px solid var(--border)" }}
          >
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
                className="text-xs cursor-pointer select-none"
                style={{ color: "var(--text)" }}
              >
                El visitante llegó en vehículo
              </label>
            </div>

            {hasVehicle && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3">
                <div>
                  <label className="text-xs" style={{ color: "var(--text-muted)" }}>
                    Marca <span style={{ color: "#f87171" }}>*</span>
                  </label>
                  <select
                    className="w-full rounded-[14px] px-3 py-2 text-sm outline-none transition"
                    style={sxInput()}
                    value={vehicleBrand}
                    onChange={handleVehicleBrandChange}
                  >
                    <option value="">
                      {loadingBrands ? "Cargando marcas..." : "Seleccione marca…"}
                    </option>
                    {vehicleBrands.map((b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                    <option value="Otra">Otra</option>
                  </select>
                  {errors.vehicleBrand && (
                    <p className="text-xs mt-1" style={{ color: "#f87171" }}>
                      {errors.vehicleBrand}
                    </p>
                  )}
                </div>

                <div>
                  <label className="text-xs" style={{ color: "var(--text-muted)" }}>
                    Modelo <span style={{ color: "#f87171" }}>*</span>
                  </label>
                  <select
                    className="w-full rounded-[14px] px-3 py-2 text-sm outline-none transition"
                    style={sxInput()}
                    value={vehicleModel}
                    onChange={handleVehicleModelChange}
                    disabled={!vehicleBrand || vehicleBrand === "Otra"}
                  >
                    <option value="">
                      {!vehicleBrand
                        ? "Seleccione marca primero…"
                        : loadingModels
                        ? "Cargando modelos..."
                        : "Seleccione modelo…"}
                    </option>
                    {vehicleModels.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                    <option value="__custom">Otro modelo (escribir)</option>
                  </select>

                  {showCustomModelInput && (
                    <input
                      className="w-full rounded-[14px] px-3 py-2 text-sm outline-none transition mt-2"
                      style={sxInput()}
                      value={vehicleModelCustom}
                      onChange={handleVehicleModelCustomChange}
                      placeholder="Escriba el modelo"
                    />
                  )}
                  {errors.vehicleModel && (
                    <p className="text-xs mt-1" style={{ color: "#f87171" }}>
                      {errors.vehicleModel}
                    </p>
                  )}
                </div>

                <div>
                  <label className="text-xs" style={{ color: "var(--text-muted)" }}>
                    Placa <span style={{ color: "#f87171" }}>*</span>
                  </label>
                  <input
                    className="w-full rounded-[14px] px-3 py-2 text-sm outline-none transition"
                    style={sxInput()}
                    value={vehiclePlate}
                    onChange={handleVehiclePlateChange}
                    placeholder="Ej. HAA-1234"
                  />
                  {errors.vehiclePlate && (
                    <p className="text-xs mt-1" style={{ color: "#f87171" }}>
                      {errors.vehiclePlate}
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="md:col-span-2 flex items-center justify-end gap-2 mt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-2 text-sm rounded-lg transition"
              style={sxGhostBtn()}
              disabled={submitting}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-3 py-2 text-sm rounded-lg font-semibold transition disabled:opacity-60"
              style={sxPrimaryBtn()}
              disabled={submitting}
            >
              {submitting
                ? editingVisitor
                  ? "Guardando…"
                  : "Registrando…"
                : editingVisitor
                ? "Guardar cambios"
                : "Registrar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}