import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../../pages/auth/AuthProvider.jsx";
import { QRCodeSVG } from "qrcode.react";

/* ========= ROOT API para backend ========= */
const API_BASE = (
  import.meta.env.VITE_API_BASE_URL ||
  import.meta.env.VITE_API_URL ||
  "http://localhost:8080/api"
).replace(/\/$/, "");

// ⬇️ Endpoint del backend para crear / listar CITA
const CITAS_API_URL = `${API_BASE}/citas`;

// ⬇️ Catálogos backend
const VEHICLE_BRANDS_API_URL =
  import.meta.env.VITE_VEHICLE_BRANDS_API_URL ||
  `${API_BASE}/catalogos/vehiculos/marcas`;

const VEHICLE_MODELS_API_URL =
  import.meta.env.VITE_VEHICLE_MODELS_API_URL ||
  `${API_BASE}/catalogos/vehiculos/modelos`;

/* ====== Límites y reglas de validación ====== */
const DNI_DIGITS = 13;
const PHONE_MIN_DIGITS = 8;
const NAME_MAX = 80;
const COMPANY_MAX = 40;
const EMP_MAX = 40;
const REASON_MAX = 80;
const EMAIL_MAX = 80;

/* ================== Storage local para citas ================== */
const CITA_STORAGE_KEY = "citas_demo";

function loadStoredCitas() {
  try {
    const raw = localStorage.getItem(CITA_STORAGE_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr.map((it) => {
      const _id = it._id || it.id || `local-${Date.now()}-${Math.random()}`;
      let citaAt = it.citaAt;
      if (!citaAt && it.fecha && it.hora) {
        citaAt = new Date(`${it.fecha}T${it.hora}:00`).toISOString();
      }
      return { ...it, _id, citaAt };
    });
  } catch (e) {
    console.warn("[citas] No se pudo leer de localStorage:", e);
    return [];
  }
}

function saveStoredCitas(list) {
  try {
    localStorage.setItem(CITA_STORAGE_KEY, JSON.stringify(list));
  } catch (e) {
    console.warn("[citas] No se pudo guardar en localStorage:", e);
  }
}

/* ================== Helpers auth / visitor ================== */
function normalizeEmail(v) {
  return String(v || "").trim().toLowerCase();
}

function normalizeDoc(v) {
  return String(v || "").replace(/\D/g, "");
}

function resolveAuthPrincipal(auth) {
  const raw = auth?.me || auth?.user || null;
  if (!raw || typeof raw !== "object") return null;

  const roles = Array.isArray(raw.roles)
    ? raw.roles
    : Array.isArray(raw.user?.roles)
    ? raw.user.roles
    : [];

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

  const roleSet = new Set(roles.map((r) => String(r || "").toLowerCase()));

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
    isVisitor: hint || roleSet.has("visita") || roleSet.has("visitor"),
  };
}

function citaBelongsToVisitor(cita, principal) {
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

  const candidateDocs = [cita?.documento, cita?.document, cita?.dni]
    .map(normalizeDoc)
    .filter(Boolean);

  if (email && candidateEmails.includes(email)) return true;
  if (doc && candidateDocs.includes(doc)) return true;

  return false;
}

/* ================== Helpers UI ================== */
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

function sxCardSoft(extra = {}) {
  return {
    background: "color-mix(in srgb, var(--card-solid) 88%, transparent)",
    border: "1px solid var(--border)",
    boxShadow: "var(--shadow-sm)",
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

function sxSuccessBtn(extra = {}) {
  return {
    background: "linear-gradient(135deg, #16a34a, #22c55e)",
    color: "#fff",
    border: "1px solid transparent",
    boxShadow: "0 10px 20px color-mix(in srgb, #16a34a 22%, transparent)",
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

function normalizeNameInput(value, max = NAME_MAX) {
  return String(value || "")
    .replace(/[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ' -]/g, "")
    .replace(/\s{2,}/g, " ")
    .slice(0, max);
}

function validatePersonName(value, label = "nombre") {
  const name = String(value || "").trim().replace(/\s+/g, " ");

  if (!name) return `El ${label} es obligatorio.`;
  if (name.length < 2) return `El ${label} es demasiado corto.`;
  if (name.length > NAME_MAX) {
    return `El ${label} no debe superar ${NAME_MAX} caracteres.`;
  }

  const validNameRegex = /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ' -]+$/;
  if (!validNameRegex.test(name)) {
    return `El ${label} contiene caracteres no válidos.`;
  }

  return "";
}

function stripDiacritics(str) {
  if (!str) return str;
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function safeJsonParse(value) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function prettyCitaEstado(value) {
  if (!value) return "solicitada";
  if (value === "en_revision") return "en revisión";
  if (value === "autorizada") return "autorizada";
  return value;
}

function buildQrPayloadForCita(cita) {
  if (!cita) return null;

  const citaDate = cita?.citaAt ? new Date(cita.citaAt) : null;

  const fecha =
    citaDate instanceof Date && !isNaN(citaDate.getTime())
      ? citaDate.toISOString().slice(0, 10)
      : cita?.fecha || "";

  const hora =
    citaDate instanceof Date && !isNaN(citaDate.getTime())
      ? citaDate.toISOString().slice(11, 16)
      : cita?.hora || "";

  return {
    kind: "senaf.cita.qr",
    version: 2,
    citaId: cita?._id || cita?.id || "",
    estado: cita?.estado || "solicitada",
    generatedAt: new Date().toISOString(),
    visitante: {
      nombre: cita?.nombre || cita?.visitante || "",
      documento: cita?.documento || "",
      telefono: cita?.telefono || "",
      correo: cita?.correo || cita?.email || "",
    },
    cita: {
      tipoCita: cita?.tipoCita || (cita?.empresa ? "profesional" : "personal"),
      empresa: cita?.empresa || "",
      empleado: cita?.empleado || "",
      motivo: cita?.motivo || "",
      fecha,
      hora,
      citaAt:
        citaDate instanceof Date && !isNaN(citaDate.getTime())
          ? citaDate.toISOString()
          : cita?.citaAt || "",
    },
    acompanante: cita?.acompanante
      ? {
          nombre: cita?.acompanante?.nombre || "",
          documento: cita?.acompanante?.documento || "",
          telefono: cita?.acompanante?.telefono || "",
        }
      : null,
    vehiculo: cita?.vehiculo
      ? {
          marca: cita?.vehiculo?.marca || "",
          modelo: cita?.vehiculo?.modelo || "",
          placa: cita?.vehiculo?.placa || "",
        }
      : null,
  };
}

function buildQrValueForCita(cita) {
  const payload = buildQrPayloadForCita(cita);
  if (payload) {
    return JSON.stringify(payload);
  }

  const nombre = cita?.nombre || cita?.visitante || "Visitante";
  const documento = cita?.documento || "No especificado";
  const empresa = cita?.empresa || "—";
  const empleado = cita?.empleado || "—";
  const motivo = cita?.motivo || "—";

  const citaDate = cita?.citaAt ? new Date(cita.citaAt) : null;

  let fecha = "—";
  let hora = "—";

  if (citaDate instanceof Date && !isNaN(citaDate.getTime())) {
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
    if (cita?.fecha) fecha = cita.fecha;
    if (cita?.hora) hora = cita.hora;
  }

  const estadoLegible = prettyCitaEstado(cita?.estado);

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

function getQrPayloadForDisplay(cita) {
  const raw = buildQrValueForCita(cita);
  const parsed = safeJsonParse(raw);
  return parsed || null;
}

function CitaEstadoPill({ estado }) {
  const val = prettyCitaEstado(estado);

  let style = {
    background: "color-mix(in srgb, #f59e0b 12%, transparent)",
    color: "#fde68a",
    border: "1px solid color-mix(in srgb, #f59e0b 36%, transparent)",
  };

  switch (estado) {
    case "autorizada":
      style = {
        background: "color-mix(in srgb, #22c55e 12%, transparent)",
        color: "#86efac",
        border: "1px solid color-mix(in srgb, #22c55e 36%, transparent)",
      };
      break;
    case "denegada":
      style = {
        background: "color-mix(in srgb, #ef4444 12%, transparent)",
        color: "#fca5a5",
        border: "1px solid color-mix(in srgb, #ef4444 36%, transparent)",
      };
      break;
    case "cancelada":
      style = {
        background: "color-mix(in srgb, #64748b 18%, transparent)",
        color: "#cbd5e1",
        border: "1px solid color-mix(in srgb, #64748b 36%, transparent)",
      };
      break;
    case "en_revision":
      style = {
        background: "color-mix(in srgb, #3b82f6 12%, transparent)",
        color: "#93c5fd",
        border: "1px solid color-mix(in srgb, #3b82f6 36%, transparent)",
      };
      break;
    default:
      break;
  }

  return (
    <span
      className="px-2 py-1 rounded-full text-xs font-semibold inline-flex items-center justify-center"
      style={style}
    >
      {val}
    </span>
  );
}

/* ================== Página ================== */
export default function AgendaPage() {
  const navigate = useNavigate();
  const auth = useAuth();

  const principal = useMemo(() => resolveAuthPrincipal(auth), [auth]);
  const isVisitor = !!principal?.isVisitor;

  const [tab, setTab] = useState("agendar");

  /* ===================== FORMULARIO: AGENDAR ===================== */
  const initialFormState = {
    visitante: "",
    documento: "",
    tipoCita: "personal",
    empresa: "",
    empleado: "",
    motivo: "",
    fecha: "",
    hora: "",
    telefono: "+504 ",
    correo: "",
    companionNombre: "",
    companionDocumento: "",
    companionTelefono: "+504 ",
  };

  const [form, setForm] = useState(initialFormState);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [okMsg, setOkMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [qrCita, setQrCita] = useState(null);
  const shownAuthorizedQrIds = useRef(new Set());

  const [hasCompanion, setHasCompanion] = useState(false);

  const [hasVehicle, setHasVehicle] = useState(false);
  const [vehicleBrand, setVehicleBrand] = useState("");
  const [vehicleModel, setVehicleModel] = useState("");
  const [vehicleModelCustom, setVehicleModelCustom] = useState("");
  const [vehiclePlate, setVehiclePlate] = useState("");

  const [vehicleBrands, setVehicleBrands] = useState([]);
  const [vehicleModels, setVehicleModels] = useState([]);
  const [loadingBrands, setLoadingBrands] = useState(false);
  const [loadingModels, setLoadingModels] = useState(false);

  const [editingCita, setEditingCita] = useState(null);

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
        console.warn("[AgendaPage] error cargando marcas:", err);
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
        console.warn("[AgendaPage] error cargando modelos:", err);
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

  function onChange(e) {
    const { name, value } = e.target;
    let newValue = value;

    if (
      name === "visitante" ||
      name === "empleado" ||
      name === "companionNombre"
    ) {
      newValue = normalizeNameInput(value);
    } else if (name === "documento" || name === "companionDocumento") {
      const digits = value.replace(/\D/g, "").slice(0, DNI_DIGITS);
      if (digits.length <= 4) {
        newValue = digits;
      } else if (digits.length <= 8) {
        newValue = `${digits.slice(0, 4)}-${digits.slice(4)}`;
      } else {
        newValue = `${digits.slice(0, 4)}-${digits.slice(
          4,
          8
        )}-${digits.slice(8)}`;
      }
    } else if (name === "empresa") {
      newValue = normalizeNameInput(value, COMPANY_MAX);
    } else if (name === "motivo") {
      newValue = normalizeNameInput(value, REASON_MAX);
    } else if (name === "telefono" || name === "companionTelefono") {
      let input = value;
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
      newValue = `+504 ${localFormatted}`;
    } else if (name === "correo") {
      newValue = value.replace(/\s/g, "").slice(0, EMAIL_MAX);
    } else if (name === "tipoCita") {
      newValue = value;
    }

    setForm((f) => {
      const next = { ...f, [name]: newValue };
      if (name === "tipoCita" && newValue === "personal") {
        next.empresa = "";
      }
      return next;
    });

    setErrors((err) => {
      const next = { ...err, [name]: "" };
      if (name === "tipoCita" && newValue === "personal") {
        delete next.empresa;
      }
      return next;
    });

    setOkMsg("");
    setErrorMsg("");
  }

  function resetCompanionFields() {
    setForm((prev) => ({
      ...prev,
      companionNombre: "",
      companionDocumento: "",
      companionTelefono: "+504 ",
    }));
    setErrors((prev) => ({
      ...prev,
      companionNombre: "",
      companionDocumento: "",
      companionTelefono: "",
    }));
  }

  function validate() {
    const e = {};

    const visitanteError = validatePersonName(
      form.visitante,
      "nombre del visitante"
    );
    if (visitanteError) {
      e.visitante = visitanteError;
    }

    const dniDigits = form.documento.replace(/\D/g, "");
    if (!dniDigits) {
      e.documento = "El documento es obligatorio.";
    } else if (dniDigits.length !== DNI_DIGITS) {
      e.documento = `El documento debe tener exactamente ${DNI_DIGITS} dígitos.`;
    }

    const tipo = form.tipoCita || "personal";
    if (!["personal", "profesional"].includes(tipo)) {
      e.tipoCita = "Seleccione el tipo de cita.";
    }

    const empresa = form.empresa.trim();
    if (tipo === "profesional") {
      if (!empresa) {
        e.empresa = "La empresa es obligatoria para citas profesionales.";
      } else if (empresa.length > COMPANY_MAX) {
        e.empresa = `La empresa no debe superar ${COMPANY_MAX} caracteres.`;
      }
    }

    const empleado = form.empleado.trim();
    if (!empleado) {
      e.empleado = "El empleado a visitar es obligatorio.";
    } else if (empleado.length > EMP_MAX) {
      e.empleado = `El empleado no debe superar ${EMP_MAX} caracteres.`;
    }

    const motivo = form.motivo.trim();
    if (!motivo) {
      e.motivo = "El motivo es obligatorio.";
    } else if (motivo.length > REASON_MAX) {
      e.motivo = `El motivo no debe superar ${REASON_MAX} caracteres.`;
    }

    if (!form.fecha) e.fecha = "Requerido";
    if (!form.hora) e.hora = "Requerido";

    const phoneTrimmed = form.telefono.trim();
    if (phoneTrimmed && phoneTrimmed !== "+504") {
      const digits = form.telefono.replace(/\D/g, "");
      const localDigits = digits.replace(/^504/, "");
      if (localDigits.length < PHONE_MIN_DIGITS) {
        e.telefono = "El teléfono debe tener 8 dígitos después de +504.";
      }
    }

    const correo = form.correo.trim();
    if (correo) {
      if (correo.length > EMAIL_MAX) {
        e.correo = `El correo no debe superar ${EMAIL_MAX} caracteres.`;
      } else if (!correo.includes("@")) {
        e.correo = "El correo debe incluir el símbolo @.";
      } else {
        const emailRegex =
          /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/i;
        if (!emailRegex.test(correo)) {
          e.correo = "Ingrese un correo válido.";
        }
      }
    }

    if (hasCompanion) {
      const companionNameError = validatePersonName(
        form.companionNombre,
        "nombre del acompañante"
      );
      if (companionNameError) {
        e.companionNombre = companionNameError;
      }

      const companionDocDigits = form.companionDocumento.replace(/\D/g, "");
      if (
        form.companionDocumento.trim() &&
        companionDocDigits.length !== DNI_DIGITS
      ) {
        e.companionDocumento = `El documento del acompañante debe tener ${DNI_DIGITS} dígitos o quedar vacío.`;
      }

      const companionPhoneTrimmed = form.companionTelefono.trim();
      if (companionPhoneTrimmed && companionPhoneTrimmed !== "+504") {
        const digits = form.companionTelefono.replace(/\D/g, "");
        const localDigits = digits.replace(/^504/, "");
        if (localDigits.length < PHONE_MIN_DIGITS) {
          e.companionTelefono =
            "El teléfono del acompañante debe tener 8 dígitos después de +504.";
        }
      }
    }

    if (hasVehicle) {
      if (!vehicleBrand.trim()) e.vehicleBrand = "Requerido";

      const finalModel =
        vehicleModel === "__custom"
          ? vehicleModelCustom.trim()
          : vehicleModel.trim();

      if (!finalModel) e.vehicleModel = "Requerido";

      const plate = vehiclePlate.trim();
      if (!plate) {
        e.vehiclePlate = "Requerido";
      } else {
        const plateRegex = /^(?=.*[A-Z])(?=.*\d)[A-Z0-9-]{5,8}$/;
        if (!plateRegex.test(plate)) {
          e.vehiclePlate =
            "Placa inválida. Use letras mayúsculas, números y guion (5 a 8 caracteres).";
        }
      }
    }

    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!validate()) return;

    setSubmitting(true);
    setOkMsg("");
    setErrorMsg("");

    const fecha = form.fecha;
    const hora = form.hora;
    const citaAtDate = new Date(`${fecha}T${hora}:00`);

    const finalModel =
      vehicleModel === "__custom"
        ? vehicleModelCustom.trim()
        : vehicleModel.trim();

    const tipo = form.tipoCita || "personal";

    const companionData = hasCompanion
      ? {
          nombre: form.companionNombre.trim(),
          documento: form.companionDocumento.trim() || null,
          telefono: form.companionTelefono.trim() || null,
        }
      : null;

    try {
      if (editingCita && !isVisitor) {
        const updated = {
          ...editingCita,
          nombre: form.visitante.trim(),
          documento: form.documento.trim(),
          tipoCita: tipo,
          empresa: form.empresa.trim(),
          empleado: form.empleado.trim(),
          motivo: form.motivo.trim(),
          telefono: form.telefono.trim() || undefined,
          correo: form.correo.trim() || undefined,
          fecha,
          hora,
          citaAt: citaAtDate.toISOString(),
          tieneAcompanante: !!hasCompanion,
          acompanante: companionData,
          vehiculo: hasVehicle
            ? {
                marca: vehicleBrand.trim(),
                modelo: finalModel,
                placa: vehiclePlate.trim(),
              }
            : null,
        };

        setItems((prev) =>
          prev.map((it) => (it._id === editingCita._id ? updated : it))
        );

        const stored = loadStoredCitas();
        let found = false;
        const storedUpdated = stored.map((it) => {
          const key = it._id || it.id;
          if (key === editingCita._id) {
            found = true;
            return { ...it, ...updated };
          }
          return it;
        });
        if (!found) {
          storedUpdated.push(updated);
        }
        saveStoredCitas(storedUpdated);

        setOkMsg("✅ Cita actualizada correctamente.");
        setErrorMsg("");
        setEditingCita(null);

        setForm(initialFormState);
        setHasCompanion(false);
        setHasVehicle(false);
        setVehicleBrand("");
        setVehicleModel("");
        setVehicleModelCustom("");
        setVehiclePlate("");

        setSubmitting(false);
        return;
      }

      const nuevaCita = {
        _id: `local-${Date.now()}`,
        nombre: form.visitante.trim(),
        documento: form.documento.trim(),
        tipoCita: tipo,
        empresa: form.empresa.trim(),
        empleado: form.empleado.trim(),
        motivo: form.motivo.trim(),
        telefono: form.telefono.trim() || undefined,
        correo: form.correo.trim() || undefined,
        fecha,
        hora,
        citaAt: citaAtDate.toISOString(),
        estado: "solicitada",
        tieneAcompanante: !!hasCompanion,
        acompanante: companionData,
        vehiculo: hasVehicle
          ? {
              marca: vehicleBrand.trim(),
              modelo: finalModel,
              placa: vehiclePlate.trim(),
            }
          : null,
      };

      const payload = {
        nombre: nuevaCita.nombre,
        documento: nuevaCita.documento,
        empresa: nuevaCita.empresa,
        empleado: nuevaCita.empleado,
        motivo: nuevaCita.motivo,
        telefono: nuevaCita.telefono || null,
        correo: nuevaCita.correo || null,
        citaAt: nuevaCita.citaAt,
        llegoEnVehiculo: !!nuevaCita.vehiculo,
        vehiculo: nuevaCita.vehiculo
          ? {
              marca: nuevaCita.vehiculo.marca,
              modelo: nuevaCita.vehiculo.modelo,
              placa: nuevaCita.vehiculo.placa,
            }
          : null,
        tipoCita: tipo,
        tieneAcompanante: !!hasCompanion,
        acompanante: companionData,
      };

      let syncedWithServer = false;
      let serverError = "";

      try {
        const params = new URLSearchParams();
        const url = `${CITAS_API_URL}${
          params.toString() ? `?${params.toString()}` : ""
        }`;

        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        const data = await res.json().catch(() => null);

        if (res.ok && data?.ok && data.item) {
          syncedWithServer = true;
          nuevaCita._id = data.item._id || nuevaCita._id;
          nuevaCita.citaAt = data.item.citaAt || nuevaCita.citaAt;
          nuevaCita.estado = data.item.estado || nuevaCita.estado;
          nuevaCita.acompanante = data.item.acompanante || nuevaCita.acompanante;
          nuevaCita.vehiculo = data.item.vehiculo || nuevaCita.vehiculo;
        } else {
          console.warn("[citas] fallo al crear en backend:", data);
          if (data && typeof data.error === "string") {
            serverError = data.error;
          }
        }
      } catch (err) {
        console.warn("[citas] error de red al crear en backend:", err);
      }

      if (serverError) {
        setErrorMsg(serverError);
        setOkMsg("");
        setSubmitting(false);
        return;
      }

      const current = loadStoredCitas();
      const next = [...current, nuevaCita];
      saveStoredCitas(next);

      if (syncedWithServer) {
        setOkMsg("✅ Cita agendada correctamente.");
        setErrorMsg("");
      } else {
        setOkMsg(
          "✅ La cita se guardó solo como respaldo local. (No se pudo contactar al servidor)"
        );
        setErrorMsg("");
      }

      setForm(initialFormState);
      setHasCompanion(false);
      setHasVehicle(false);
      setVehicleBrand("");
      setVehicleModel("");
      setVehicleModelCustom("");
      setVehiclePlate("");

      if (tab === "citas") {
        fetchCitas();
      }
    } catch (err) {
      console.error("[citas] Error agendando:", err);
      setErrorMsg("No se pudo agendar la cita (error inesperado).");
    } finally {
      setSubmitting(false);
    }
  }

  function fmtDate(d) {
    const dt = new Date(d);
    return dt.toLocaleDateString("es-HN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
  }

  function fmtTime(d) {
    const dt = new Date(d);
    return dt.toLocaleTimeString("es-HN", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  const todayISO = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const thisMonth = useMemo(() => todayISO.slice(0, 7), [todayISO]);

  const [mode, setMode] = useState("day");
  const [month, setMonth] = useState(thisMonth);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  const [dateFilter, setDateFilter] = useState("");
  const [showMyCitas, setShowMyCitas] = useState(false);
  const [myDocumento, setMyDocumento] = useState("");

  const [citasSearch, setCitasSearch] = useState("");
  const [citasEstado, setCitasEstado] = useState("todos");

  async function fetchCitas() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (mode === "month" && month) {
        params.set("month", month);
      } else if (mode === "day" && dateFilter) {
        params.set("day", dateFilter);
      }

      let url = CITAS_API_URL;
      const qs = params.toString();
      if (qs) url += `?${qs}`;

      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      let list = Array.isArray(data.items) ? data.items : [];

      const stored = loadStoredCitas();
      const storedMap = new Map(stored.map((c) => [c._id || c.id, c]));
      list = list.map((it) => {
        const key = it._id || it.id;
        const local = storedMap.get(key);
        if (local) return { ...it, ...local };
        return it;
      });

      if (isVisitor) {
        list = list.filter((it) => citaBelongsToVisitor(it, principal));
      } else if (showMyCitas && myDocumento.trim()) {
        const doc = myDocumento.trim();
        list = list.filter((it) => (it.documento || "").includes(doc));
      }

      if (mode === "day" && dateFilter) {
        list = list.filter(
          (it) => (it.citaAt || "").slice(0, 10) === dateFilter
        );
      }

      list.sort((a, b) => new Date(a.citaAt || 0) - new Date(b.citaAt || 0));
      setItems(list);
    } catch (e) {
      console.error("[citas] Error leyendo desde backend, usando local:", e);

      try {
        const all = loadStoredCitas();
        let list = [...all];

        if (isVisitor) {
          list = list.filter((it) => citaBelongsToVisitor(it, principal));
        } else if (showMyCitas && myDocumento.trim()) {
          const doc = myDocumento.trim();
          list = list.filter((it) => (it.documento || "").includes(doc));
        }

        if (mode === "month") {
          if (month) {
            list = list.filter((it) => (it.citaAt || "").slice(0, 7) === month);
          }
        } else {
          if (dateFilter) {
            list = list.filter(
              (it) => (it.citaAt || "").slice(0, 10) === dateFilter
            );
          }
        }

        list.sort((a, b) => new Date(a.citaAt || 0) - new Date(b.citaAt || 0));
        setItems(list);
      } catch (e2) {
        console.error("[citas] Error leyendo citas local:", e2);
        setItems([]);
      }
    } finally {
      setLoading(false);
    }
  }

  function handleModeDay() {
    setMode("day");
  }

  function handleModeMonth() {
    const now = new Date();
    const ym = now.toISOString().slice(0, 7);
    setMode("month");
    setMonth(ym);
    setDateFilter("");
  }

  function handleEditCita(it) {
    if (isVisitor) return;

    const fechaInput =
      it.fecha || (it.citaAt ? String(it.citaAt).slice(0, 10) : "");
    const horaInput =
      it.hora ||
      (it.citaAt ? new Date(it.citaAt).toISOString().slice(11, 16) : "");

    const tipo = it.tipoCita || (it.empresa ? "profesional" : "personal");

    setForm({
      visitante: it.nombre || it.visitante || "",
      documento: it.documento || "",
      tipoCita: tipo,
      empresa: it.empresa || "",
      empleado: it.empleado || "",
      motivo: it.motivo || "",
      fecha: fechaInput || "",
      hora: horaInput || "",
      telefono: it.telefono || "+504 ",
      correo: it.correo || "",
      companionNombre: it.acompanante?.nombre || "",
      companionDocumento: it.acompanante?.documento || "",
      companionTelefono: it.acompanante?.telefono || "+504 ",
    });

    setHasCompanion(
      !!it.tieneAcompanante || !!it.conAcompanante || !!it.acompanante
    );

    const hasVeh = !!it.vehiculo;
    setHasVehicle(hasVeh);
    if (hasVeh) {
      setVehicleBrand(it.vehiculo.marca || "");
      setVehicleModel(it.vehiculo.modelo || "");
      setVehicleModelCustom("");
      setVehiclePlate(it.vehiculo.placa || "");
    } else {
      setVehicleBrand("");
      setVehicleModel("");
      setVehicleModelCustom("");
      setVehiclePlate("");
    }

    setErrors({});
    setOkMsg("");
    setErrorMsg("");
    setEditingCita(it);
    setTab("agendar");
  }

  useEffect(() => {
    if (tab === "citas") {
      fetchCitas();
    }
  }, [
    tab,
    mode,
    month,
    dateFilter,
    showMyCitas,
    myDocumento,
    isVisitor,
    principal?.email,
    principal?.document,
  ]);

  useEffect(() => {
    if (!(isVisitor && tab === "citas")) return;

    const id = setInterval(() => {
      fetchCitas();
    }, 15000);

    return () => clearInterval(id);
  }, [isVisitor, tab, mode, month, dateFilter, principal?.email, principal?.document]);

  useEffect(() => {
    if (!isVisitor || tab !== "citas" || !items.length) return;

    const firstAuthorized = items.find(
      (it) =>
        it.estado === "autorizada" &&
        !shownAuthorizedQrIds.current.has(String(it._id || it.id))
    );

    if (firstAuthorized) {
      shownAuthorizedQrIds.current.add(String(firstAuthorized._id || firstAuthorized.id));
      setQrCita(firstAuthorized);
    }
  }, [items, isVisitor, tab]);

  const filteredItems = useMemo(() => {
    const search = citasSearch.trim().toLowerCase();
    const hasSearch = search.length > 0;

    return items.filter((it) => {
      let ok = true;

      if (hasSearch) {
        const full = `${it.nombre || ""} ${it.documento || ""}`
          .toString()
          .toLowerCase();
        ok = full.includes(search);
      }

      if (ok && citasEstado !== "todos") {
        const estadoBase = it.estado || "solicitada";
        ok = estadoBase === citasEstado;
      }

      return ok;
    });
  }, [items, citasSearch, citasEstado]);

  const grouped = useMemo(() => {
    const map = new Map();
    for (const it of filteredItems) {
      const key = (it.citaAt || "").slice(0, 10) || todayISO;
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(it);
    }
    for (const arr of map.values()) {
      arr.sort((a, b) => new Date(a.citaAt || 0) - new Date(b.citaAt || 0));
    }
    return Array.from(map.entries()).sort(
      (a, b) => new Date(a[0]) - new Date(b[0])
    );
  }, [filteredItems, todayISO]);

  const showCustomModelInput =
    vehicleBrand === "Otra" || vehicleModel === "__custom";

  const qrPayload = useMemo(() => getQrPayloadForDisplay(qrCita), [qrCita]);

  return (
    <div className="layer-content relative z-[1] flex flex-col gap-6 pb-10">
      <div className="mesh mesh--ribbon" />
      <div className="mesh mesh--br" />
      <div className="mesh mesh--lb" />

      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-bold" style={{ color: "var(--text)" }}>
            {isVisitor ? "Mis Citas" : "Agenda de Citas"}
          </h1>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            {isVisitor
              ? "Aquí solo puedes consultar el estado de tus propias citas."
              : "Agendar y consultar citas programadas (pre-registro en línea)"}
          </p>
        </div>

        {!isVisitor && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate("/visitas/control")}
              className="text-xs hover:underline"
              style={{ color: "#60a5fa" }}
            >
              ← Volver a Gestión de Visitantes
            </button>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={() => {
            setTab("agendar");
            setEditingCita(null);
          }}
          className="px-3 py-2 rounded-lg text-sm transition"
          style={tab === "agendar" ? sxPrimaryBtn() : sxGhostBtn()}
        >
          Agendar
        </button>
        <button
          onClick={() => setTab("citas")}
          className="px-3 py-2 rounded-lg text-sm transition"
          style={tab === "citas" ? sxPrimaryBtn() : sxGhostBtn()}
        >
          {isVisitor ? "Mis citas" : "Citas"}
        </button>
      </div>

      {tab === "agendar" && (
        <section className="p-4 md:p-6 text-sm rounded-[24px]" style={sxCard()}>
          <form
            onSubmit={handleSubmit}
            className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6"
          >
            <div className="flex flex-col gap-4">
              <Field
                label="Visitante *"
                name="visitante"
                value={form.visitante}
                onChange={onChange}
                error={errors.visitante}
                placeholder="Nombre del visitante"
              />
              <Field
                label="Documento *"
                name="documento"
                value={form.documento}
                onChange={onChange}
                error={errors.documento}
                placeholder="DNI / Pasaporte"
              />

              <Field label="Tipo de cita *" name="tipoCita" error={errors.tipoCita}>
                <select
                  name="tipoCita"
                  value={form.tipoCita}
                  onChange={onChange}
                  className="w-full rounded-lg px-3 py-2 focus:outline-none"
                  style={sxInput()}
                >
                  <option value="personal">Personal</option>
                  <option value="profesional">Profesional</option>
                </select>
              </Field>

              {form.tipoCita === "profesional" && (
                <Field
                  label="Empresa *"
                  name="empresa"
                  value={form.empresa}
                  onChange={onChange}
                  error={errors.empresa}
                  placeholder="Empresa"
                />
              )}

              <Field
                label="Empleado a visitar *"
                name="empleado"
                value={form.empleado}
                onChange={onChange}
                error={errors.empleado}
                placeholder="Persona de contacto"
              />
            </div>

            <div className="flex flex-col gap-4">
              <Field
                label="Motivo *"
                name="motivo"
                value={form.motivo}
                onChange={onChange}
                error={errors.motivo}
                placeholder="Motivo de la visita"
              />
              <div className="grid grid-cols-2 gap-4">
                <Field
                  type="date"
                  label="Fecha *"
                  name="fecha"
                  value={form.fecha}
                  onChange={onChange}
                  error={errors.fecha}
                />
                <Field
                  type="time"
                  label="Hora *"
                  name="hora"
                  value={form.hora}
                  onChange={onChange}
                  error={errors.hora}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Field
                  label="Teléfono"
                  name="telefono"
                  value={form.telefono}
                  onChange={onChange}
                  error={errors.telefono}
                  placeholder="+504 9999-9999"
                />
                <Field
                  type="email"
                  label="Correo"
                  name="correo"
                  value={form.correo}
                  onChange={onChange}
                  error={errors.correo}
                  placeholder="correo@dominio.com"
                />
              </div>
            </div>

            <div
              className="md:col-span-2 pt-3 mt-1"
              style={{ borderTop: "1px solid var(--border)" }}
            >
              <div className="flex items-center gap-2 mb-3">
                <input
                  id="has-companion-agenda"
                  type="checkbox"
                  className="h-4 w-4"
                  checked={hasCompanion}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setHasCompanion(checked);
                    if (!checked) {
                      resetCompanionFields();
                    }
                  }}
                />
                <label
                  htmlFor="has-companion-agenda"
                  className="text-xs cursor-pointer select-none"
                  style={{ color: "var(--text)" }}
                >
                  El visitante llegará con acompañante
                </label>
              </div>

              {hasCompanion && (
                <div
                  className="grid grid-cols-1 md:grid-cols-3 gap-3 rounded-2xl p-4"
                  style={sxCardSoft()}
                >
                  <Field
                    label="Nombre del acompañante *"
                    name="companionNombre"
                    value={form.companionNombre}
                    onChange={onChange}
                    error={errors.companionNombre}
                    placeholder="Nombre del acompañante"
                  />
                  <Field
                    label="Documento del acompañante"
                    name="companionDocumento"
                    value={form.companionDocumento}
                    onChange={onChange}
                    error={errors.companionDocumento}
                    placeholder="DNI / Pasaporte"
                  />
                  <Field
                    label="Teléfono del acompañante"
                    name="companionTelefono"
                    value={form.companionTelefono}
                    onChange={onChange}
                    error={errors.companionTelefono}
                    placeholder="+504 9999-9999"
                  />
                </div>
              )}
            </div>

            <div
              className="md:col-span-2 pt-3 mt-1"
              style={{ borderTop: "1px solid var(--border)" }}
            >
              <div className="flex items-center gap-2 mb-3">
                <input
                  id="has-vehicle-agenda"
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
                        vehicleBrand: "",
                        vehicleModel: "",
                        vehiclePlate: "",
                      }));
                    }
                  }}
                />
                <label
                  htmlFor="has-vehicle-agenda"
                  className="text-xs cursor-pointer select-none"
                  style={{ color: "var(--text)" }}
                >
                  El visitante llegará en vehículo
                </label>
              </div>

              {hasVehicle && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <Field
                    label={
                      <>
                        Marca <span style={{ color: "#f87171" }}>*</span>
                      </>
                    }
                    name="vehicleBrand"
                    error={errors.vehicleBrand}
                  >
                    <select
                      className="w-full rounded-lg px-3 py-2 focus:outline-none"
                      style={sxInput()}
                      value={vehicleBrand}
                      onChange={(e) => {
                        const val = e.target.value;
                        setVehicleBrand(val);
                        setVehicleModel("");
                        setVehicleModelCustom("");
                        setErrors((prev) => ({ ...prev, vehicleBrand: "" }));
                      }}
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
                  </Field>

                  <Field
                    label={
                      <>
                        Modelo <span style={{ color: "#f87171" }}>*</span>
                      </>
                    }
                    name="vehicleModel"
                    error={errors.vehicleModel}
                  >
                    <select
                      className="w-full rounded-lg px-3 py-2 focus:outline-none"
                      style={sxInput()}
                      value={vehicleModel}
                      onChange={(e) => {
                        const val = e.target.value;
                        setVehicleModel(val);
                        if (val !== "__custom") {
                          setVehicleModelCustom("");
                        }
                        setErrors((prev) => ({ ...prev, vehicleModel: "" }));
                      }}
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
                        className="mt-2 w-full rounded-lg px-3 py-2 focus:outline-none"
                        style={sxInput()}
                        value={vehicleModelCustom}
                        onChange={(e) => {
                          setVehicleModelCustom(e.target.value);
                          setErrors((prev) => ({
                            ...prev,
                            vehicleModel: "",
                          }));
                        }}
                        placeholder="Escriba el modelo"
                      />
                    )}
                  </Field>

                  <Field
                    label={
                      <>
                        Placa <span style={{ color: "#f87171" }}>*</span>
                      </>
                    }
                    name="vehiclePlate"
                    error={errors.vehiclePlate}
                  >
                    <input
                      className="w-full rounded-lg px-3 py-2 focus:outline-none"
                      style={sxInput()}
                      value={vehiclePlate}
                      onChange={(e) => {
                        const val = e.target.value
                          .toUpperCase()
                          .replace(/[^A-Z0-9-]/g, "")
                          .slice(0, 8);
                        setVehiclePlate(val);
                        setErrors((prev) => ({ ...prev, vehiclePlate: "" }));
                      }}
                      placeholder="Ej. HAA-1234"
                    />
                  </Field>
                </div>
              )}
            </div>

            <div className="md:col-span-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
              <div className="text-xs" style={{ color: "var(--text-muted)" }}>
                Los campos con * son obligatorios
              </div>
              <div className="flex items-center gap-3">
                {!isVisitor && (
                  <button
                    type="button"
                    onClick={() => {
                      navigate("/visitas/control");
                    }}
                    className="px-3 py-2 rounded-md text-xs font-semibold transition"
                    style={sxGhostBtn()}
                  >
                    Cancelar
                  </button>
                )}

                {isVisitor && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingCita(null);
                      setForm(initialFormState);
                      setHasCompanion(false);
                      setHasVehicle(false);
                      setVehicleBrand("");
                      setVehicleModel("");
                      setVehicleModelCustom("");
                      setVehiclePlate("");
                      setErrors({});
                      setOkMsg("");
                      setErrorMsg("");
                    }}
                    className="px-3 py-2 rounded-md text-xs font-semibold transition"
                    style={sxGhostBtn()}
                  >
                    Limpiar
                  </button>
                )}

                <button
                  type="submit"
                  disabled={submitting}
                  className="px-3 py-2 rounded-md text-xs font-semibold transition disabled:opacity-60"
                  style={sxPrimaryBtn()}
                >
                  {submitting
                    ? editingCita && !isVisitor
                      ? "Actualizando..."
                      : "Agendando..."
                    : editingCita && !isVisitor
                    ? "Guardar cambios"
                    : "Agendar cita"}
                </button>
              </div>
            </div>

            {okMsg && (
              <div className="md:col-span-2 text-sm" style={{ color: "#86efac" }}>
                {okMsg}
              </div>
            )}
            {errorMsg && (
              <div
                className="md:col-span-2 text-sm flex items-center gap-2"
                style={{ color: "#f87171" }}
              >
                <span>✖</span>
                <span>{errorMsg}</span>
              </div>
            )}
          </form>
        </section>
      )}

      {tab === "citas" && (
        <section className="p-4 md:p-6 text-sm rounded-[24px]" style={sxCard()}>
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3 mb-4">
            <div className="flex items-center gap-2">
              <button
                onClick={handleModeDay}
                className="px-3 py-2 rounded-lg text-xs transition"
                style={mode === "day" ? sxPrimaryBtn() : sxGhostBtn()}
                title="Ver citas (todas las fechas o por día específico)"
              >
                Por día
              </button>
              <button
                onClick={handleModeMonth}
                className="px-3 py-2 rounded-lg text-xs transition"
                style={mode === "month" ? sxPrimaryBtn() : sxGhostBtn()}
                title="Ver todas las citas de un mes"
              >
                Por mes
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {mode === "day" && !isVisitor && (
                <>
                  <input
                    type="date"
                    value={dateFilter}
                    onChange={(e) => setDateFilter(e.target.value)}
                    className="rounded-lg px-3 py-2 text-xs md:text-sm"
                    style={sxInput()}
                    title="Filtrar por fecha (opcional)"
                  />
                  <label
                    className="flex items-center gap-2 text-xs"
                    style={{ color: "var(--text)" }}
                  >
                    <input
                      type="checkbox"
                      checked={showMyCitas}
                      onChange={(e) => {
                        setShowMyCitas(e.target.checked);
                        if (!e.target.checked) setMyDocumento("");
                      }}
                    />
                    Mis citas
                  </label>
                  {showMyCitas && (
                    <input
                      type="text"
                      placeholder="Documento (ej: 0801...)"
                      value={myDocumento}
                      onChange={(e) => setMyDocumento(e.target.value)}
                      className="rounded-lg px-3 py-2 text-xs md:text-sm"
                      style={sxInput()}
                    />
                  )}
                </>
              )}

              {mode === "day" && isVisitor && (
                <input
                  type="date"
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value)}
                  className="rounded-lg px-3 py-2 text-xs md:text-sm"
                  style={sxInput()}
                  title="Filtrar por fecha (opcional)"
                />
              )}

              {mode === "month" && (
                <input
                  type="month"
                  value={month}
                  onChange={(e) => setMonth(e.target.value)}
                  className="rounded-lg px-3 py-2 text-xs md:text-sm"
                  style={sxInput()}
                  title="Cambiar mes"
                />
              )}

              <input
                type="text"
                placeholder={
                  isVisitor
                    ? "Buscar mis citas por nombre o DNI…"
                    : "Buscar por nombre o DNI…"
                }
                value={citasSearch}
                onChange={(e) => setCitasSearch(e.target.value)}
                className="rounded-lg px-3 py-2 text-xs md:text-sm min-w-[180px]"
                style={sxInput()}
              />

              <select
                value={citasEstado}
                onChange={(e) => setCitasEstado(e.target.value)}
                className="rounded-lg px-3 py-2 text-xs md:text-sm"
                style={sxInput()}
                title="Filtrar por estado"
              >
                <option value="todos">Todos los estados</option>
                <option value="solicitada">Solicitada</option>
                <option value="en_revision">En revisión</option>
                <option value="autorizada">Autorizada</option>
                <option value="denegada">Denegada</option>
                <option value="cancelada">Cancelada</option>
              </select>

              <button
                onClick={fetchCitas}
                className="px-3 py-2 rounded-md text-xs font-semibold transition"
                style={sxPrimaryBtn()}
              >
                Actualizar
              </button>
            </div>
          </div>

          {loading ? (
            <div style={{ color: "var(--text-muted)" }}>Cargando…</div>
          ) : grouped.length === 0 ? (
            <div style={{ color: "var(--text-muted)" }}>
              {isVisitor
                ? "No tienes citas registradas."
                : mode === "day"
                ? "Sin citas agendadas."
                : "Sin citas en el mes seleccionado."}
            </div>
          ) : (
            <div className="flex flex-col gap-6">
              {grouped.map(([k, arr]) => (
                <div key={k} className="rounded-xl" style={sxCardSoft()}>
                  <div
                    className="px-4 py-3 text-sm"
                    style={{
                      color: "var(--text)",
                      borderBottom: "1px solid var(--border)",
                    }}
                  >
                    <span className="font-semibold">{fmtDate(k)}</span> —{" "}
                    {arr.length} cita(s)
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse min-w-[980px]">
                      <thead
                        className="text-xs uppercase"
                        style={{ color: "var(--text-muted)" }}
                      >
                        <tr
                          className="[&>th]:py-2 [&>th]:pr-4"
                          style={{ borderBottom: "1px solid var(--border)" }}
                        >
                          <th>Visitante</th>
                          <th>Empresa</th>
                          <th>Empleado</th>
                          <th>Motivo</th>
                          <th>Hora</th>
                          <th>Estado</th>
                          <th className="text-right">Acciones</th>
                        </tr>
                      </thead>
                      <tbody style={{ color: "var(--text)" }}>
                        {arr.map((it) => (
                          <tr
                            key={it._id}
                            className="text-sm [&>td]:py-3 [&>td]:pr-4"
                            style={{ borderBottom: "1px solid var(--border)" }}
                          >
                            <td className="font-medium">{it.nombre}</td>
                            <td>{it.empresa}</td>
                            <td>{it.empleado}</td>
                            <td style={{ color: "var(--text-muted)" }}>
                              {it.motivo}
                            </td>
                            <td>{fmtTime(it.citaAt)}</td>
                            <td>
                              <CitaEstadoPill estado={it.estado} />
                            </td>
                            <td className="text-right">
                              <div className="flex flex-wrap gap-2 justify-end">
                                {isVisitor && it.estado === "autorizada" && (
                                  <button
                                    type="button"
                                    onClick={() => setQrCita(it)}
                                    className="px-2 py-1 rounded-md text-xs font-semibold transition"
                                    style={sxSuccessBtn()}
                                  >
                                    Ver QR
                                  </button>
                                )}

                                {!isVisitor && (
                                  <button
                                    type="button"
                                    onClick={() => handleEditCita(it)}
                                    className="px-2 py-1 rounded-md text-xs font-semibold transition"
                                    style={sxPrimaryBtn()}
                                  >
                                    Editar
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {qrCita && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{
            background: "rgba(2, 6, 23, 0.62)",
            backdropFilter: "blur(6px)",
            WebkitBackdropFilter: "blur(6px)",
          }}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setQrCita(null);
          }}
        >
          <div
            className="p-4 md:p-6 w-[95%] max-w-[420px] rounded-[24px]"
            style={sxCard()}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3
                  className="text-lg font-semibold"
                  style={{ color: "var(--text)" }}
                >
                  Invitación / QR de cita
                </h3>
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                  Muestre este código en la guardia para validar su ingreso.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setQrCita(null)}
                style={{ color: "var(--text-muted)" }}
              >
                ✕
              </button>
            </div>

            <div className="flex flex-col items-center gap-3">
              <div
                className="rounded-[18px] p-4"
                style={sxCardSoft({ background: "#ffffff" })}
              >
                <QRCodeSVG
                  value={buildQrValueForCita(qrCita)}
                  size={200}
                  includeMargin
                />
              </div>

              <div
                className="text-xs text-center"
                style={{ color: "var(--text)" }}
              >
                <div className="font-semibold">
                  {qrPayload?.visitante?.nombre || qrCita.nombre || qrCita.visitante}
                </div>
                <div>
                  {qrPayload?.visitante?.documento ||
                    qrCita.documento ||
                    "Documento no especificado"}
                </div>
                <div>
                  {qrPayload?.cita?.fecha
                    ? new Date(
                        qrPayload.cita.citaAt || `${qrPayload.cita.fecha}T${qrPayload.cita.hora || "00:00"}:00`
                      ).toLocaleDateString("es-ES", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                      })
                    : qrCita.citaAt
                    ? new Date(qrCita.citaAt).toLocaleDateString("es-ES", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                      })
                    : qrCita.fecha}{" "}
                  {" · "}
                  {qrPayload?.cita?.hora ||
                    (qrCita.citaAt
                      ? new Date(qrCita.citaAt).toLocaleTimeString("es-ES", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : qrCita.hora)}
                </div>
                <div className="mt-1">
                  Estado: <CitaEstadoPill estado={qrCita.estado} />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ============== Input reutilizable ============== */
function Field({
  label,
  name,
  value,
  onChange,
  error,
  placeholder,
  type = "text",
  children,
}) {
  return (
    <div>
      {label && (
        <label
          className="block mb-1 text-xs md:text-sm"
          style={{ color: "var(--text)" }}
        >
          {label}
        </label>
      )}

      {children ? (
        children
      ) : (
        <input
          type={type}
          name={name}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          className="w-full rounded-lg px-3 py-2 focus:outline-none"
          style={sxInput()}
        />
      )}

      {error && (
        <p className="text-xs mt-1" style={{ color: "#f87171" }}>
          {error}
        </p>
      )}
    </div>
  );
}