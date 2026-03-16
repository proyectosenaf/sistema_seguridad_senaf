// client/src/pages/AgendaPage.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

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
const NAME_MAX = 40;
const COMPANY_MAX = 20;
const EMP_MAX = 20;
const REASON_MAX = 20;
const EMAIL_MAX = 60;

/* ================== Storage local para citas ================== */
const CITA_STORAGE_KEY = "citas_demo";

/* ====== Storage opcional para datos del usuario actual ======
   No rompe si no existe.
   Se usa para:
   - ocultar "Volver a Gestión de Visitantes" cuando el rol es visitante
   - forzar "Mis citas" si podemos inferir documento del usuario
*/
const POSSIBLE_USER_KEYS = [
  "auth_user",
  "user",
  "currentUser",
  "senaf_user",
  "auth",
  "session",
];

function safeJsonParse(value) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function readCurrentUser() {
  try {
    for (const key of POSSIBLE_USER_KEYS) {
      const fromLocal = localStorage.getItem(key);
      if (fromLocal) {
        const parsed = safeJsonParse(fromLocal);
        if (parsed) {
          if (parsed.user && typeof parsed.user === "object") return parsed.user;
          return parsed;
        }
      }

      const fromSession = sessionStorage.getItem(key);
      if (fromSession) {
        const parsed = safeJsonParse(fromSession);
        if (parsed) {
          if (parsed.user && typeof parsed.user === "object") return parsed.user;
          return parsed;
        }
      }
    }
  } catch (err) {
    console.warn("[AgendaPage] No se pudo leer usuario actual:", err);
  }
  return null;
}

function normalizeDocumento(raw) {
  return String(raw || "").replace(/\D/g, "");
}

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
        const temp = new Date(`${it.fecha}T${it.hora}:00`);
        if (!Number.isNaN(temp.getTime())) {
          citaAt = temp.toISOString();
        }
      }

      return {
        ...it,
        _id,
        citaAt,
      };
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

/* ========= Helpers visuales de estado ========= */

function normalizeEstadoValue(value) {
  const raw = String(value || "").trim();

  const map = {
    solicitada: "Programada",
    programada: "Programada",
    "en revisión": "En revisión",
    en_revision: "En revisión",
    autorizada: "Autorizada",
    denegada: "Denegada",
    cancelada: "Cancelada",
    dentro: "Dentro",
    finalizada: "Finalizada",
  };

  return map[raw.toLowerCase()] || raw || "Programada";
}

function prettyCitaEstado(value) {
  const estado = normalizeEstadoValue(value);

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
      return estado.toLowerCase();
  }
}

function CitaEstadoPill({ estado }) {
  const normalized = normalizeEstadoValue(estado);
  const val = prettyCitaEstado(normalized);

  let style = {
    background: "color-mix(in srgb, #f59e0b 12%, transparent)",
    color: "#fde68a",
    border: "1px solid color-mix(in srgb, #f59e0b 36%, transparent)",
  };

  switch (normalized) {
    case "Programada":
      style = {
        background: "color-mix(in srgb, #f59e0b 12%, transparent)",
        color: "#fde68a",
        border: "1px solid color-mix(in srgb, #f59e0b 36%, transparent)",
      };
      break;
    case "En revisión":
      style = {
        background: "color-mix(in srgb, #3b82f6 12%, transparent)",
        color: "#93c5fd",
        border: "1px solid color-mix(in srgb, #3b82f6 36%, transparent)",
      };
      break;
    case "Autorizada":
      style = {
        background: "color-mix(in srgb, #22c55e 12%, transparent)",
        color: "#86efac",
        border: "1px solid color-mix(in srgb, #22c55e 36%, transparent)",
      };
      break;
    case "Dentro":
      style = {
        background: "color-mix(in srgb, #16a34a 14%, transparent)",
        color: "#86efac",
        border: "1px solid color-mix(in srgb, #16a34a 36%, transparent)",
      };
      break;
    case "Finalizada":
      style = {
        background: "color-mix(in srgb, #64748b 18%, transparent)",
        color: "#cbd5e1",
        border: "1px solid color-mix(in srgb, #64748b 36%, transparent)",
      };
      break;
    case "Denegada":
      style = {
        background: "color-mix(in srgb, #ef4444 12%, transparent)",
        color: "#fca5a5",
        border: "1px solid color-mix(in srgb, #ef4444 36%, transparent)",
      };
      break;
    case "Cancelada":
      style = {
        background: "color-mix(in srgb, #64748b 18%, transparent)",
        color: "#cbd5e1",
        border: "1px solid color-mix(in srgb, #64748b 36%, transparent)",
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

function buildISOFromDateAndTime(fecha, hora) {
  const temp = new Date(`${fecha}T${hora}:00`);
  if (Number.isNaN(temp.getTime())) return null;
  return temp.toISOString();
}

function mergeServerAndLocal(serverList, localList) {
  const map = new Map();

  for (const it of serverList || []) {
    const key = it?._id || it?.id;
    if (!key) continue;
    map.set(key, { ...it });
  }

  for (const local of localList || []) {
    const key = local?._id || local?.id;
    if (!key) continue;

    if (map.has(key)) {
      map.set(key, {
        ...local,
        ...map.get(key),
        // preservamos QR si vino del backend
        qrDataUrl: map.get(key)?.qrDataUrl || local?.qrDataUrl || "",
        qrPayload: map.get(key)?.qrPayload || local?.qrPayload || "",
        qrToken: map.get(key)?.qrToken || local?.qrToken || "",
      });
    } else {
      map.set(key, { ...local });
    }
  }

  return Array.from(map.values());
}

function toDisplayName(it) {
  return it?.nombre || it?.visitante || "";
}

function toDisplayCompany(it) {
  return it?.empresa || "";
}

/* ================== Página ================== */

export default function AgendaPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState("agendar");

  const currentUser = useMemo(() => readCurrentUser(), []);
  const currentRole = String(
    currentUser?.role ||
      currentUser?.rol ||
      currentUser?.userRole ||
      currentUser?.tipo ||
      ""
  )
    .trim()
    .toLowerCase();

  const currentDocumento = useMemo(() => {
    return normalizeDocumento(
      currentUser?.documento ||
        currentUser?.dni ||
        currentUser?.identityNumber ||
        ""
    );
  }, [currentUser]);

  const isVisitante = currentRole === "visitante";

  /* ===================== FORMULARIO: AGENDAR ===================== */
  const initialFormState = {
    visitante: "",
    documento: currentDocumento || "",
    tipoCita: "personal",
    empresa: "",
    empleado: "",
    motivo: "",
    fecha: "",
    hora: "",
    telefono: "+504 ",
    correo: "",
  };

  const [form, setForm] = useState(initialFormState);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [okMsg, setOkMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  // Acompañante
  const [hasCompanion, setHasCompanion] = useState(false);

  // Vehículo
  const [hasVehicle, setHasVehicle] = useState(false);
  const [vehicleBrand, setVehicleBrand] = useState("");
  const [vehicleModel, setVehicleModel] = useState("");
  const [vehicleModelCustom, setVehicleModelCustom] = useState("");
  const [vehiclePlate, setVehiclePlate] = useState("");

  // Catálogos backend
  const [vehicleBrands, setVehicleBrands] = useState([]);
  const [vehicleModels, setVehicleModels] = useState([]);
  const [loadingBrands, setLoadingBrands] = useState(false);
  const [loadingModels, setLoadingModels] = useState(false);

  // Cita que se está editando
  const [editingCita, setEditingCita] = useState(null);

  // Modal QR
  const [qrModal, setQrModal] = useState({
    open: false,
    qrDataUrl: "",
    qrPayload: "",
    qrToken: "",
    cita: null,
  });

  // 🔹 CARGAR MARCAS DESDE BACKEND
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

  // 🔹 CARGAR MODELOS DESDE BACKEND
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

  function resetFormState() {
    setForm({
      ...initialFormState,
      documento: currentDocumento || "",
    });
    setHasCompanion(false);
    setHasVehicle(false);
    setVehicleBrand("");
    setVehicleModel("");
    setVehicleModelCustom("");
    setVehiclePlate("");
    setEditingCita(null);
    setErrors({});
  }

  function onChange(e) {
    const { name, value } = e.target;
    let newValue = value;

    if (name === "visitante") {
      newValue = value
        .replace(/[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ\s]/g, "")
        .slice(0, NAME_MAX);
    } else if (name === "documento") {
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
      newValue = value
        .replace(/[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ\s]/g, "")
        .slice(0, COMPANY_MAX);
    } else if (name === "empleado") {
      newValue = value
        .replace(/[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ\s]/g, "")
        .slice(0, EMP_MAX);
    } else if (name === "motivo") {
      newValue = value
        .replace(/[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ\s]/g, "")
        .slice(0, REASON_MAX);
    } else if (name === "telefono") {
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

  function validate() {
    const e = {};

    const nombre = form.visitante.trim();
    const nombreParts = nombre.split(/\s+/).filter(Boolean);
    if (!nombre) {
      e.visitante = "El nombre es obligatorio.";
    } else if (nombre.length > NAME_MAX) {
      e.visitante = `El nombre no debe superar ${NAME_MAX} caracteres.`;
    } else if (nombreParts.length < 2) {
      e.visitante = "Ingrese el nombre completo del visitante.";
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

    if (form.fecha && form.hora) {
      const citaDate = new Date(`${form.fecha}T${form.hora}:00`);
      if (Number.isNaN(citaDate.getTime())) {
        e.fecha = "Fecha inválida";
        e.hora = "Hora inválida";
      }
    }

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
      } else {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;
        if (!emailRegex.test(correo)) {
          e.correo = "Ingrese un correo válido.";
        }
      }
    }

    if (hasVehicle) {
      if (!vehicleBrand.trim()) e.vehicleBrand = "Requerido";

      const finalModel =
        vehicleModel === "__custom"
          ? vehicleModelCustom.trim()
          : vehicleBrand === "Otra"
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

  function openQrModal({ cita, qrDataUrl, qrPayload, qrToken }) {
    setQrModal({
      open: true,
      qrDataUrl: qrDataUrl || "",
      qrPayload: qrPayload || "",
      qrToken: qrToken || "",
      cita: cita || null,
    });
  }

  function closeQrModal() {
    setQrModal({
      open: false,
      qrDataUrl: "",
      qrPayload: "",
      qrToken: "",
      cita: null,
    });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!validate()) return;

    setSubmitting(true);
    setOkMsg("");
    setErrorMsg("");

    const fecha = form.fecha;
    const hora = form.hora;
    const citaAtISO = buildISOFromDateAndTime(fecha, hora);

    if (!citaAtISO) {
      setErrorMsg("La fecha u hora de la cita no es válida.");
      setSubmitting(false);
      return;
    }

    const finalModel =
      vehicleModel === "__custom"
        ? vehicleModelCustom.trim()
        : vehicleBrand === "Otra"
        ? vehicleModelCustom.trim()
        : vehicleModel.trim();

    const tipo = form.tipoCita || "personal";

    try {
      // ========== MODO EDICIÓN ==========
      // Tu backend actual no expone endpoint de edición de cita desde esta vista,
      // por eso mantenemos edición local sin romper tu flujo existente.
      if (editingCita) {
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
          citaAt: citaAtISO,
          tieneAcompanante: !!hasCompanion,
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

        setOkMsg(
          "✅ Cita actualizada en respaldo local. Si deseas editar también en servidor, habría que agregar endpoint PATCH/PUT."
        );
        setErrorMsg("");
        resetFormState();
        setSubmitting(false);
        return;
      }

      // ========== CREAR NUEVA CITA ==========
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
        citaAt: citaAtISO,
        estado: "Programada",
        tieneAcompanante: !!hasCompanion,
        vehiculo: hasVehicle
          ? {
              marca: vehicleBrand.trim(),
              modelo: finalModel,
              placa: vehiclePlate.trim(),
            }
          : null,
        qrDataUrl: "",
        qrPayload: "",
        qrToken: "",
      };

      const payload = {
        nombre: nuevaCita.nombre,
        documento: nuevaCita.documento,
        empresa: nuevaCita.empresa || null,
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
      };

      let syncedWithServer = false;
      let serverError = "";
      let createdFromServer = null;
      let qrDataUrl = "";
      let qrPayload = "";
      let qrToken = "";

      try {
        const res = await fetch(CITAS_API_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        const data = await res.json().catch(() => null);

        if (res.ok && data?.ok) {
          createdFromServer = data?.item || null;
          qrDataUrl = data?.qrDataUrl || "";
          qrPayload = data?.qrPayload || data?.item?.qrPayload || "";
          qrToken = data?.qrToken || data?.item?.qrToken || "";

          if (createdFromServer) {
            syncedWithServer = true;
            nuevaCita._id = createdFromServer._id || nuevaCita._id;
            nuevaCita.citaAt = createdFromServer.citaAt || nuevaCita.citaAt;
            nuevaCita.estado =
              normalizeEstadoValue(createdFromServer.estado) || nuevaCita.estado;
            nuevaCita.qrDataUrl = qrDataUrl;
            nuevaCita.qrPayload = qrPayload;
            nuevaCita.qrToken = qrToken;
            nuevaCita.nombre =
              createdFromServer.nombre || nuevaCita.nombre;
            nuevaCita.documento =
              createdFromServer.documento || nuevaCita.documento;
            nuevaCita.empresa =
              createdFromServer.empresa || nuevaCita.empresa;
            nuevaCita.empleado =
              createdFromServer.empleado || nuevaCita.empleado;
            nuevaCita.motivo =
              createdFromServer.motivo || nuevaCita.motivo;
            nuevaCita.telefono =
              createdFromServer.telefono || nuevaCita.telefono;
            nuevaCita.correo =
              createdFromServer.correo || nuevaCita.correo;
            nuevaCita.vehiculo =
              createdFromServer.vehiculo || nuevaCita.vehiculo;
          }
        } else {
          console.warn("[citas] fallo al crear en backend:", data);
          if (data && typeof data.error === "string") {
            serverError = data.error;
          } else if (data && typeof data.message === "string") {
            serverError = data.message;
          } else {
            serverError = "No se pudo crear la cita en el servidor.";
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

      setItems((prev) => [...prev, nuevaCita]);

      if (syncedWithServer) {
        setOkMsg("✅ Cita agendada correctamente.");
        setErrorMsg("");

        if (qrDataUrl || qrPayload || qrToken) {
          openQrModal({
            cita: nuevaCita,
            qrDataUrl,
            qrPayload,
            qrToken,
          });
        }
      } else {
        setOkMsg(
          "✅ La cita se guardó solo como respaldo local. (No se pudo contactar al servidor)"
        );
        setErrorMsg("");
      }

      resetFormState();

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

  /* ===================== LISTADO: CITAS ===================== */
  function fmtDate(d) {
    const dt = new Date(d);
    if (Number.isNaN(dt.getTime())) return "";
    return dt.toLocaleDateString("es-HN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
  }

  function fmtTime(d) {
    const dt = new Date(d);
    if (Number.isNaN(dt.getTime())) return "";
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
  const [showMyCitas, setShowMyCitas] = useState(!!(isVisitante && currentDocumento));
  const [myDocumento, setMyDocumento] = useState(currentDocumento || "");

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

      const qs = params.toString();
      const url = qs ? `${CITAS_API_URL}?${qs}` : CITAS_API_URL;

      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = await res.json();
      let list = Array.isArray(data?.items) ? data.items : [];

      const stored = loadStoredCitas();
      list = mergeServerAndLocal(list, stored);

      if ((showMyCitas || isVisitante) && myDocumento.trim()) {
        const doc = normalizeDocumento(myDocumento.trim());
        list = list.filter(
          (it) => normalizeDocumento(it.documento || "") === doc
        );
      }

      if (mode === "day" && dateFilter) {
        list = list.filter(
          (it) => String(it.citaAt || "").slice(0, 10) === dateFilter
        );
      }

      list.sort((a, b) => new Date(a.citaAt || 0) - new Date(b.citaAt || 0));
      setItems(list);
    } catch (e) {
      console.error("[citas] Error leyendo desde backend, usando local:", e);

      try {
        const all = loadStoredCitas();
        let list = [...all];

        if ((showMyCitas || isVisitante) && myDocumento.trim()) {
          const doc = normalizeDocumento(myDocumento.trim());
          list = list.filter(
            (it) => normalizeDocumento(it.documento || "") === doc
          );
        }

        if (mode === "month") {
          if (month) {
            list = list.filter((it) => String(it.citaAt || "").slice(0, 7) === month);
          }
        } else if (dateFilter) {
          list = list.filter(
            (it) => String(it.citaAt || "").slice(0, 10) === dateFilter
          );
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
    if (isVisitante && currentDocumento) {
      setShowMyCitas(true);
      setMyDocumento(currentDocumento);
    }
  }, [isVisitante, currentDocumento]);

  useEffect(() => {
    if (tab === "citas") {
      fetchCitas();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, mode, month, dateFilter, showMyCitas, myDocumento]);

  const filteredItems = useMemo(() => {
    const search = citasSearch.trim().toLowerCase();
    const hasSearch = search.length > 0;

    return items.filter((it) => {
      let ok = true;

      if (hasSearch) {
        const full = `${toDisplayName(it)} ${it.documento || ""}`
          .toString()
          .toLowerCase();
        ok = full.includes(search);
      }

      if (ok && citasEstado !== "todos") {
        const estadoBase = normalizeEstadoValue(it.estado || "Programada");
        ok = estadoBase === citasEstado;
      }

      return ok;
    });
  }, [items, citasSearch, citasEstado]);

  const grouped = useMemo(() => {
    const map = new Map();

    for (const it of filteredItems) {
      const key = String(it.citaAt || "").slice(0, 10) || todayISO;
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

  return (
    <div className="layer-content relative z-[1] flex flex-col gap-6 pb-10">
      <div className="mesh mesh--ribbon" />
      <div className="mesh mesh--br" />
      <div className="mesh mesh--lb" />

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
        <div>
          <h1
            className="text-xl md:text-2xl font-bold"
            style={{ color: "var(--text)" }}
          >
            Agenda de Citas
          </h1>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            Agendar y consultar citas programadas (pre-registro en línea)
          </p>
        </div>

        <div className="flex items-center gap-2">
          {!isVisitante && (
            <button
              onClick={() => navigate("/visitas/control")}
              className="text-xs hover:underline"
              style={{ color: "#60a5fa" }}
            >
              ← Volver a Gestión de Visitantes
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
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
          Citas
        </button>
      </div>

      {/* ===================== Sección: Agendar ===================== */}
      {tab === "agendar" && (
        <section className="p-4 md:p-6 text-sm rounded-[24px]" style={sxCard()}>
          <form
            onSubmit={handleSubmit}
            className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6"
          >
            {/* Columna izquierda */}
            <div className="flex flex-col gap-4">
              <Field
                label="Visitante *"
                name="visitante"
                value={form.visitante}
                onChange={onChange}
                error={errors.visitante}
                placeholder="Nombre y apellido"
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

            {/* Columna derecha */}
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

            {/* Acompañante */}
            <div
              className="md:col-span-2 pt-3 mt-1"
              style={{ borderTop: "1px solid var(--border)" }}
            >
              <div className="flex items-center gap-2 mb-1">
                <input
                  id="has-companion-agenda"
                  type="checkbox"
                  className="h-4 w-4"
                  checked={hasCompanion}
                  onChange={(e) => setHasCompanion(e.target.checked)}
                />
                <label
                  htmlFor="has-companion-agenda"
                  className="text-xs cursor-pointer select-none"
                  style={{ color: "var(--text)" }}
                >
                  El visitante llegará con acompañante
                </label>
              </div>
            </div>

            {/* Vehículo */}
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
                    {vehicleBrand === "Otra" ? (
                      <input
                        className="w-full rounded-lg px-3 py-2 focus:outline-none"
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
                    ) : (
                      <>
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
                          disabled={!vehicleBrand}
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
                      </>
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

            {/* Acciones */}
            <div className="md:col-span-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
              <div className="text-xs" style={{ color: "var(--text-muted)" }}>
                Los campos con * son obligatorios
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    if (isVisitante) {
                      resetFormState();
                      return;
                    }
                    navigate("/visitas/control");
                  }}
                  className="px-3 py-2 rounded-md text-xs font-semibold transition"
                  style={sxGhostBtn()}
                >
                  {isVisitante ? "Limpiar" : "Cancelar"}
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-3 py-2 rounded-md text-xs font-semibold transition disabled:opacity-60"
                  style={sxPrimaryBtn()}
                >
                  {submitting
                    ? editingCita
                      ? "Actualizando..."
                      : "Agendando..."
                    : editingCita
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

      {/* ===================== Sección: Citas ===================== */}
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
              {mode === "day" && (
                <>
                  <input
                    type="date"
                    value={dateFilter}
                    onChange={(e) => setDateFilter(e.target.value)}
                    className="rounded-lg px-3 py-2 text-xs md:text-sm"
                    style={sxInput()}
                    title="Filtrar por fecha (opcional)"
                  />

                  {!isVisitante && (
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
                  )}

                  {(showMyCitas || isVisitante) && (
                    <input
                      type="text"
                      placeholder="Documento (ej: 0801...)"
                      value={myDocumento}
                      onChange={(e) => setMyDocumento(e.target.value)}
                      className="rounded-lg px-3 py-2 text-xs md:text-sm"
                      style={sxInput()}
                      readOnly={isVisitante && !!currentDocumento}
                    />
                  )}
                </>
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
                placeholder="Buscar por nombre o DNI…"
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
                <option value="Programada">Programada</option>
                <option value="En revisión">En revisión</option>
                <option value="Autorizada">Autorizada</option>
                <option value="Dentro">Ingresada</option>
                <option value="Denegada">Denegada</option>
                <option value="Cancelada">Cancelada</option>
                <option value="Finalizada">Finalizada</option>
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
              {mode === "day"
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
                        {arr.map((it) => {
                          const canShowQr =
                            !!it.qrDataUrl || !!it.qrPayload || !!it.qrToken;

                          return (
                            <tr
                              key={it._id}
                              className="text-sm [&>td]:py-3 [&>td]:pr-4"
                              style={{ borderBottom: "1px solid var(--border)" }}
                            >
                              <td className="font-medium">{toDisplayName(it)}</td>
                              <td>{toDisplayCompany(it)}</td>
                              <td>{it.empleado}</td>
                              <td style={{ color: "var(--text-muted)" }}>
                                {it.motivo}
                              </td>
                              <td>{fmtTime(it.citaAt)}</td>
                              <td>
                                <CitaEstadoPill estado={it.estado} />
                              </td>
                              <td className="text-right">
                                <div className="flex items-center justify-end gap-2">
                                  {canShowQr && (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        openQrModal({
                                          cita: it,
                                          qrDataUrl: it.qrDataUrl,
                                          qrPayload: it.qrPayload,
                                          qrToken: it.qrToken,
                                        })
                                      }
                                      className="px-2 py-1 rounded-md text-xs font-semibold transition"
                                      style={sxSuccessBtn()}
                                    >
                                      Ver QR
                                    </button>
                                  )}

                                  <button
                                    type="button"
                                    onClick={() => handleEditCita(it)}
                                    className="px-2 py-1 rounded-md text-xs font-semibold transition"
                                    style={sxPrimaryBtn()}
                                  >
                                    Editar
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* ===================== Modal QR ===================== */}
      {qrModal.open && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 p-4">
          <div
            className="w-full max-w-md rounded-[24px] p-5 md:p-6"
            style={sxCard({
              background:
                "color-mix(in srgb, var(--card-solid) 96%, rgba(2,6,23,.88))",
            })}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3
                  className="text-lg md:text-xl font-bold"
                  style={{ color: "var(--text)" }}
                >
                  Cita agendada
                </h3>
                <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
                  Presente este código QR al guardia para validar su ingreso.
                </p>
              </div>

              <button
                type="button"
                onClick={closeQrModal}
                className="rounded-lg px-2 py-1 text-sm"
                style={sxGhostBtn()}
              >
                ✕
              </button>
            </div>

            <div className="mt-5 flex justify-center">
              {qrModal.qrDataUrl ? (
                <img
                  src={qrModal.qrDataUrl}
                  alt="QR de la cita"
                  className="h-64 w-64 rounded-xl bg-white p-3 object-contain"
                />
              ) : (
                <div
                  className="h-64 w-64 rounded-xl flex items-center justify-center text-center text-sm p-4"
                  style={sxCardSoft({ color: "var(--text-muted)" })}
                >
                  No se recibió imagen QR del servidor.
                </div>
              )}
            </div>

            <div
              className="mt-4 rounded-xl p-4 text-sm"
              style={sxCardSoft({ background: "var(--input-bg)" })}
            >
              <div style={{ color: "var(--text)" }}>
                <strong>Visitante:</strong> {qrModal.cita?.nombre || ""}
              </div>
              <div style={{ color: "var(--text)" }}>
                <strong>Documento:</strong> {qrModal.cita?.documento || ""}
              </div>
              <div style={{ color: "var(--text)" }}>
                <strong>Empleado:</strong> {qrModal.cita?.empleado || ""}
              </div>
              <div style={{ color: "var(--text)" }}>
                <strong>Motivo:</strong> {qrModal.cita?.motivo || ""}
              </div>
              <div style={{ color: "var(--text)" }}>
                <strong>Fecha:</strong> {fmtDate(qrModal.cita?.citaAt)}
              </div>
              <div style={{ color: "var(--text)" }}>
                <strong>Hora:</strong> {fmtTime(qrModal.cita?.citaAt)}
              </div>

              {qrModal.qrPayload && (
                <div
                  className="mt-2 break-all text-xs"
                  style={{ color: "var(--text-muted)" }}
                >
                  <strong>Payload QR:</strong> {qrModal.qrPayload}
                </div>
              )}
            </div>

            <div className="mt-5 flex flex-col sm:flex-row gap-3 sm:justify-end">
              {qrModal.qrDataUrl && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      const w = window.open("", "_blank", "width=700,height=800");
                      if (!w) return;

                      w.document.write(`
                        <html>
                          <head>
                            <title>QR de cita</title>
                            <style>
                              body {
                                font-family: Arial, sans-serif;
                                padding: 24px;
                                text-align: center;
                              }
                              img {
                                max-width: 320px;
                                width: 100%;
                                height: auto;
                              }
                            </style>
                          </head>
                          <body>
                            <h2>QR de cita</h2>
                            <p><strong>Visitante:</strong> ${qrModal.cita?.nombre || ""}</p>
                            <p><strong>Documento:</strong> ${qrModal.cita?.documento || ""}</p>
                            <p><strong>Empleado:</strong> ${qrModal.cita?.empleado || ""}</p>
                            <p><strong>Motivo:</strong> ${qrModal.cita?.motivo || ""}</p>
                            <img src="${qrModal.qrDataUrl}" alt="QR" />
                          </body>
                        </html>
                      `);
                      w.document.close();
                    }}
                    className="px-3 py-2 rounded-md text-xs font-semibold transition"
                    style={sxGhostBtn()}
                  >
                    Abrir QR
                  </button>

                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="px-3 py-2 rounded-md text-xs font-semibold transition"
                    style={sxGhostBtn()}
                  >
                    Imprimir
                  </button>
                </>
              )}

              <button
                type="button"
                onClick={closeQrModal}
                className="px-3 py-2 rounded-md text-xs font-semibold transition"
                style={sxPrimaryBtn()}
              >
                Cerrar
              </button>
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