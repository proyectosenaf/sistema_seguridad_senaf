// client/src/pages/AgendaPage.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

/* ========= ROOT API para backend ========= */
// 👇 Unificamos con el resto de módulos (usa VITE_API_BASE_URL primero)
const API_BASE = (
  import.meta.env.VITE_API_BASE_URL ||
  import.meta.env.VITE_API_URL ||
  "http://localhost:8080/api"
).replace(/\/$/, "");

// ⬇️ Endpoint del backend para crear / listar CITA (Visitas agendadas)
const CITAS_API_URL = `${API_BASE}/citas`;

/* ================== Vehículos (mismas listas que en NewVisitorModal) ================== */
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
  "Otra",
];

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

/* ====== Límites y reglas de validación (mismas que NewVisitorModal) ====== */
const DNI_DIGITS = 13; // 0801YYYYXXXXX
const PHONE_MIN_DIGITS = 8;
const NAME_MAX = 40;
const COMPANY_MAX = 20;
const EMP_MAX = 20;
const REASON_MAX = 20;
const EMAIL_MAX = 25;

/* ================== Storage local para citas ================== */
const CITA_STORAGE_KEY = "citas_demo"; // reutiliza la misma clave para no perder lo que ya tenías

function loadStoredCitas() {
  try {
    const raw = localStorage.getItem(CITA_STORAGE_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    // Normalizar por si acaso
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

/* ========= Helpers visuales de estado (mismos colores que VisitsPage) ========= */

function prettyCitaEstado(value) {
  if (!value) return "solicitada";
  if (value === "en_revision") return "en revisión";
  if (value === "autorizada") return "ingresada"; // 👈 cambio de texto
  return value;
}

function CitaEstadoPill({ estado }) {
  const val = prettyCitaEstado(estado);
  let cls =
    "px-2 py-1 rounded-full text-xs font-semibold inline-flex items-center justify-center";

  switch (estado) {
    case "autorizada":
      cls +=
        " bg-green-200 text-green-800 dark:bg-green-600/20 dark:text-green-300";
      break;
    case "denegada":
      cls +=
        " bg-red-200 text-red-800 dark:bg-red-600/20 dark:text-red-300";
      break;
    case "cancelada":
      cls +=
        " bg-red-300 text-red-900 dark:bg-red-700/30 dark:text-red-200";
      break;
    case "en_revision":
      cls +=
        " bg-blue-200 text-blue-800 dark:bg-blue-600/20 dark:text-blue-300";
      break;
    default: // solicitada / Programada / etc.
      cls +=
        " bg-yellow-200 text-yellow-800 dark:bg-yellow-500/20 dark:text-yellow-300";
      break;
  }

  return <span className={cls}>{val}</span>;
}

/* ================== Página ================== */

export default function AgendaPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState("agendar"); // "agendar" | "citas"

  /* ===================== FORMULARIO: AGENDAR ===================== */
  const initialFormState = {
    visitante: "",
    documento: "",
    tipoCita: "personal", // tipo de cita
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

  // Cita que se está editando (null si se está creando una nueva)
  const [editingCita, setEditingCita] = useState(null);

  function onChange(e) {
    const { name, value } = e.target;
    let newValue = value;

    // ====== mismas reglas que en NewVisitorModal ======
    if (name === "visitante") {
      // Solo letras (con tildes) y espacios, máx 40
      newValue = value
        .replace(/[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ\s]/g, "")
        .slice(0, NAME_MAX);
    } else if (name === "documento") {
      // DNI con formato 0801-YYYY-XXXXX (13 dígitos)
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
      // Mantener prefijo +504 y formatear +504 9999-9999
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
      // Sin espacios, máx 25
      newValue = value.replace(/\s/g, "").slice(0, EMAIL_MAX);
    } else if (name === "tipoCita") {
      newValue = value;
    }

    setForm((f) => {
      const next = { ...f, [name]: newValue };
      // Si cambia a personal, limpiamos empresa
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

    // Visitante: requerido, máx 40, al menos 3 palabras (2 nombres + 1 apellido)
    const nombre = form.visitante.trim();
    const nombreParts = nombre.split(/\s+/).filter(Boolean);
    if (!nombre) {
      e.visitante = "El nombre es obligatorio.";
    } else if (nombre.length > NAME_MAX) {
      e.visitante = `El nombre no debe superar ${NAME_MAX} caracteres.`;
    } else if (nombreParts.length < 3) {
      e.visitante =
        "Ingrese el nombre completo: dos nombres y al menos un apellido.";
    }

    // Documento: DNI completo (13 dígitos)
    const dniDigits = form.documento.replace(/\D/g, "");
    if (!dniDigits) {
      e.documento = "El DNI es obligatorio.";
    } else if (dniDigits.length !== DNI_DIGITS) {
      e.documento = `El DNI debe tener exactamente ${DNI_DIGITS} dígitos.`;
    }

    // Tipo de cita
    const tipo = form.tipoCita || "personal";
    if (!["personal", "profesional"].includes(tipo)) {
      e.tipoCita = "Seleccione el tipo de cita.";
    }

    // Empresa: requerida SOLO si la cita es profesional
    const empresa = form.empresa.trim();
    if (tipo === "profesional") {
      if (!empresa) {
        e.empresa = "La empresa es obligatoria para citas profesionales.";
      } else if (empresa.length > COMPANY_MAX) {
        e.empresa = `La empresa no debe superar ${COMPANY_MAX} caracteres.`;
      }
    }

    // Empleado a visitar: requerido, solo texto, máx 20
    const empleado = form.empleado.trim();
    if (!empleado) {
      e.empleado = "El empleado a visitar es obligatorio.";
    } else if (empleado.length > EMP_MAX) {
      e.empleado = `El empleado no debe superar ${EMP_MAX} caracteres.`;
    }

    // Motivo: requerido, solo texto, máx 20
    const motivo = form.motivo.trim();
    if (!motivo) {
      e.motivo = "El motivo es obligatorio.";
    } else if (motivo.length > REASON_MAX) {
      e.motivo = `El motivo no debe superar ${REASON_MAX} caracteres.`;
    }

    if (!form.fecha) e.fecha = "Requerido";
    if (!form.hora) e.hora = "Requerido";

    // Teléfono: opcional, pero si se escribe debe tener 8 dígitos después de +504
    const phoneTrimmed = form.telefono.trim();
    if (phoneTrimmed && phoneTrimmed !== "+504") {
      const digits = form.telefono.replace(/\D/g, "");
      const localDigits = digits.replace(/^504/, "");
      if (localDigits.length < PHONE_MIN_DIGITS) {
        e.telefono =
          "El teléfono debe tener 8 dígitos después de +504.";
      }
    }

    // Correo: opcional, máx 25, debe incluir @ y terminar en .com o .org
    const correo = form.correo.trim();
    if (correo) {
      if (correo.length > EMAIL_MAX) {
        e.correo = `El correo no debe superar ${EMAIL_MAX} caracteres.`;
      } else if (!correo.includes("@")) {
        e.correo = "El correo debe incluir el símbolo @.";
      } else {
        const emailRegex = /^[A-Za-z0-9._-]+@[A-Za-z0-9.-]+\.(com|org)$/i;
        if (!emailRegex.test(correo)) {
          e.correo =
            "El correo debe tener un dominio válido y terminar en .com o .org.";
        }
      }
    }

    // Vehículo (si aplica)
    if (hasVehicle) {
      if (!vehicleBrand.trim()) e.vehicleBrand = "Requerido";
      const finalModel = vehicleModelCustom.trim() || vehicleModel.trim();
      if (!finalModel) e.vehicleModel = "Requerido";

      const plate = vehiclePlate.trim();
      if (!plate) {
        e.vehiclePlate = "Requerido";
      } else {
        // Placa: 5–8 caracteres, mayúsculas, al menos una letra y un número
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

    const fecha = form.fecha; // YYYY-MM-DD
    const hora = form.hora; // HH:mm
    const citaAtDate = new Date(`${fecha}T${hora}:00`);

    const finalModel = vehicleModelCustom.trim() || vehicleModel.trim();
    const tipo = form.tipoCita || "personal";

    try {
      // ========== MODO EDICIÓN ==========
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
          citaAt: citaAtDate.toISOString(),
          tieneAcompanante: !!hasCompanion,
          vehiculo: hasVehicle
            ? {
                marca: vehicleBrand.trim(),
                modelo: finalModel,
                placa: vehiclePlate.trim(),
              }
            : null,
        };

        // Actualizar listado actual
        setItems((prev) =>
          prev.map((it) => (it._id === editingCita._id ? updated : it))
        );

        // Actualizar respaldo local (aunque la cita venga del backend)
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

        // Limpiar formulario
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
        citaAt: citaAtDate.toISOString(),
        estado: "solicitada",
        tieneAcompanante: !!hasCompanion,
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
        } else {
          console.warn("[citas] fallo al crear en backend:", data);
          if (data && typeof data.error === "string") {
            serverError = data.error; // ej. horario de atención
          }
        }
      } catch (err) {
        console.warn("[citas] error de red al crear en backend:", err);
      }

      // ⛔ Si el servidor devolvió error (por ejemplo horario fuera de rango),
      // mostramos ese mensaje y NO guardamos como respaldo local.
      if (serverError) {
        setErrorMsg(serverError);
        setOkMsg("");
        setSubmitting(false);
        return;
      }

      // 🔁 Respaldo local (o sincronizado) como antes
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

  /* ===================== LISTADO: CITAS ===================== */
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

  const todayISO = useMemo(
    () => new Date().toISOString().slice(0, 10),
    []
  );
  const thisMonth = useMemo(() => todayISO.slice(0, 7), [todayISO]);

  const [mode, setMode] = useState("day"); // "day" | "month"
  const [month, setMonth] = useState(thisMonth); // YYYY-MM
  const [items, setItems] = useState([]); // citas ya filtradas base
  const [loading, setLoading] = useState(false);

  const [dateFilter, setDateFilter] = useState(""); // YYYY-MM-DD
  const [showMyCitas, setShowMyCitas] = useState(false);
  const [myDocumento, setMyDocumento] = useState("");

  // 🔎 Filtros locales para la vista de citas
  const [citasSearch, setCitasSearch] = useState("");
  const [citasEstado, setCitasEstado] = useState("todos"); // solicitada, en_revision, autorizada, denegada, cancelada

  async function fetchCitas() {
    setLoading(true);
    try {
      // Primero intentamos leer desde el BACKEND
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

      // 👇 Mezclar con datos del localStorage (no solo estado)
      const stored = loadStoredCitas();
      const storedMap = new Map(
        stored.map((c) => [c._id || c.id, c])
      );
      list = list.map((it) => {
        const key = it._id || it.id;
        const local = storedMap.get(key);
        if (local) {
          // local pisa los campos del backend (incluye cambios de edición)
          return { ...it, ...local };
        }
        return it;
      });

      // Filtro por documento ("Mis citas")
      if (showMyCitas && myDocumento.trim()) {
        const doc = myDocumento.trim();
        list = list.filter((it) => (it.documento || "").includes(doc));
      }

      // Si estamos en modo día y no hay dateFilter, mostramos todas;
      // si hay dateFilter, filtramos adicionalmente por día exacto.
      if (mode === "day" && dateFilter) {
        list = list.filter(
          (it) => (it.citaAt || "").slice(0, 10) === dateFilter
        );
      }

      list.sort(
        (a, b) => new Date(a.citaAt || 0) - new Date(b.citaAt || 0)
      );

      setItems(list);
    } catch (e) {
      console.error("[citas] Error leyendo desde backend, usando local:", e);

      // 🔁 Fallback: lo mismo que hacías antes con localStorage
      try {
        const all = loadStoredCitas();
        let list = [...all];

        if (showMyCitas && myDocumento.trim()) {
          const doc = myDocumento.trim();
          list = list.filter((it) => (it.documento || "").includes(doc));
        }

        if (mode === "month") {
          if (month) {
            list = list.filter(
              (it) => (it.citaAt || "").slice(0, 7) === month
            );
          }
        } else {
          if (dateFilter) {
            list = list.filter(
              (it) => (it.citaAt || "").slice(0, 10) === dateFilter
            );
          }
        }

        list.sort(
          (a, b) => new Date(a.citaAt || 0) - new Date(b.citaAt || 0)
        );
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

  // 👉 Editar cita: cargar en el formulario y cambiar a pestaña "agendar"
  function handleEditCita(it) {
    const fechaInput =
      it.fecha || (it.citaAt ? String(it.citaAt).slice(0, 10) : "");
    const horaInput =
      it.hora ||
      (it.citaAt
        ? new Date(it.citaAt).toISOString().slice(11, 16)
        : "");

    const tipo =
      it.tipoCita ||
      (it.empresa ? "profesional" : "personal");

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
      !!it.tieneAcompanante ||
        !!it.conAcompanante ||
        !!it.acompanante
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

  // Cargar citas cuando cambian filtros o pestaña
  useEffect(() => {
    if (tab === "citas") {
      fetchCitas();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, mode, month, dateFilter, showMyCitas, myDocumento]);

  // 🔎 Aplicar búsqueda (nombre/DNI) + filtro de estado sobre items
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

  // Agrupar por día (usando la lista filtrada)
  const grouped = useMemo(() => {
    const map = new Map();
    for (const it of filteredItems) {
      const key = (it.citaAt || "").slice(0, 10) || todayISO;
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(it);
    }
    for (const arr of map.values()) {
      arr.sort(
        (a, b) => new Date(a.citaAt || 0) - new Date(b.citaAt || 0)
      );
    }
    return Array.from(map.entries()).sort(
      (a, b) => new Date(a[0]) - new Date(b[0])
    );
  }, [filteredItems, todayISO]);

  /* ===================== Render ===================== */

  return (
    <div className="layer-content relative z-[1] flex flex-col gap-6 pb-10">
      {/* FX */}
      <div className="mesh mesh--ribbon" />
      <div className="mesh mesh--br" />
      <div className="mesh mesh--lb" />

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-neutral-100">
            Agenda de Citas
          </h1>
          <p className="text-sm text-neutral-400">
            Agendar y consultar citas programadas (pre-registro en línea)
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate("/visitas/control")}
            className="text-xs text-blue-400 hover:underline"
          >
            ← Volver a Gestión de Visitantes
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => {
            setTab("agendar");
            setEditingCita(null);
          }}
          className={`px-3 py-2 rounded-lg text-sm ${
            tab === "agendar"
              ? "bg-blue-600/80 text-white"
              : "bg-neutral-800 text-neutral-300 hover:bg-neutral-700"
          }`}
        >
          Agendar
        </button>
        <button
          onClick={() => setTab("citas")}
          className={`px-3 py-2 rounded-lg text-sm ${
            tab === "citas"
              ? "bg-blue-600/80 text-white"
              : "bg-neutral-800 text-neutral-300 hover:bg-neutral-700"
          }`}
        >
          Citas
        </button>
      </div>

      {/* ===================== Sección: Agendar ===================== */}
      {tab === "agendar" && (
        <section className="card-rich p-4 md:p-6 text-sm">
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

              {/* Tipo de cita */}
              <Field
                label="Tipo de cita *"
                name="tipoCita"
                error={errors.tipoCita}
              >
                <select
                  name="tipoCita"
                  value={form.tipoCita}
                  onChange={onChange}
                  className="w-full rounded-lg bg-neutral-900/50 border border-neutral-700/50 px-3 py-2 text-neutral-100 focus:outline-none focus:ring-2 focus:ring-blue-600/40"
                >
                  <option value="personal">Personal</option>
                  <option value="profesional">Profesional</option>
                </select>
              </Field>

              {/* Empresa solo si es profesional */}
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

            {/* ===== Acompañante ===== */}
            <div className="md:col-span-2 border-t border-neutral-800/60 pt-3 mt-1">
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
                  className="text-xs text-neutral-300 cursor-pointer select-none"
                >
                  El visitante llegará con acompañante
                </label>
              </div>
            </div>

            {/* ===== Vehículo, igual que en Registrar Visitante ===== */}
            <div className="md:col-span-2 border-t border-neutral-800/60 pt-3 mt-1">
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
                  className="text-xs text-neutral-300 cursor-pointer select-none"
                >
                  El visitante llegará en vehículo
                </label>
              </div>

              {hasVehicle && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {/* Marca */}
                  <Field
                    label={
                      <>
                        Marca <span className="text-red-400">*</span>
                      </>
                    }
                    name="vehicleBrand"
                    error={errors.vehicleBrand}
                  >
                    <select
                      className="w-full rounded-lg bg-neutral-900/50 border border-neutral-700/50 px-3 py-2 text-neutral-100 focus:outline-none focus:ring-2 focus:ring-blue-600/40"
                      value={vehicleBrand}
                      onChange={(e) => {
                        const val = e.target.value;
                        setVehicleBrand(val);
                        setVehicleModel("");
                        setVehicleModelCustom("");
                        setErrors((prev) => ({ ...prev, vehicleBrand: "" }));
                      }}
                    >
                      <option value="">Seleccione marca…</option>
                      {VEHICLE_BRANDS.map((b) => (
                        <option key={b} value={b}>
                          {b}
                        </option>
                      ))}
                    </select>
                  </Field>

                  {/* Modelo */}
                  <Field
                    label={
                      <>
                        Modelo <span className="text-red-400">*</span>
                      </>
                    }
                    name="vehicleModel"
                    error={errors.vehicleModel}
                  >
                    <select
                      className="w-full rounded-lg bg-neutral-900/50 border border-neutral-700/50 px-3 py-2 text-neutral-100 focus:outline-none focus:ring-2 focus:ring-blue-600/40"
                      value={vehicleModel}
                      onChange={(e) => {
                        const val = e.target.value;
                        setVehicleModel(val);
                        if (val !== "__customBefore2000") {
                          setVehicleModelCustom("");
                        }
                        setErrors((prev) => ({ ...prev, vehicleModel: "" }));
                      }}
                      disabled={!vehicleBrand || vehicleBrand === "Otra"}
                    >
                      <option value="">
                        Seleccione modelo (año ≥ 2000)…
                      </option>
                      {(
                        vehicleBrand &&
                        VEHICLE_MODELS_BASE_BY_BRAND[vehicleBrand]
                          ? VEHICLE_MODELS_BASE_BY_BRAND[vehicleBrand].flatMap(
                              (base) => {
                                const list = [];
                                for (
                                  let y = START_YEAR;
                                  y <= CURRENT_YEAR;
                                  y++
                                ) {
                                  list.push(`${base} ${y}`);
                                }
                                return list;
                              }
                            )
                          : []
                      ).map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                      <option value="__customBefore2000">
                        Otro modelo / año &lt; 2000 (escribir)
                      </option>
                    </select>

                    {(vehicleBrand === "Otra" ||
                      vehicleModel === "__customBefore2000") && (
                      <input
                        className="mt-2 w-full rounded-lg bg-neutral-900/50 border border-neutral-700/50 px-3 py-2 text-neutral-100 focus:outline-none focus:ring-2 focus:ring-blue-600/40"
                        value={vehicleModelCustom}
                        onChange={(e) => {
                          setVehicleModelCustom(e.target.value);
                          setErrors((prev) => ({
                            ...prev,
                            vehicleModel: "",
                          }));
                        }}
                        placeholder="Escriba modelo y año (ej. Corolla 1998)"
                      />
                    )}
                  </Field>

                  {/* Placa */}
                  <Field
                    label={
                      <>
                        Placa <span className="text-red-400">*</span>
                      </>
                    }
                    name="vehiclePlate"
                    error={errors.vehiclePlate}
                  >
                    <input
                      className="w-full rounded-lg bg-neutral-900/50 border border-neutral-700/50 px-3 py-2 text-neutral-100 focus:outline-none focus:ring-2 focus:ring-blue-600/40"
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
              <div className="text-xs text-neutral-400">
                Los campos con * son obligatorios
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    navigate("/visitas/control");
                  }}
                  className="px-3 py-2 rounded-md text-xs font-semibold bg-neutral-800 text-neutral-300 hover:bg-neutral-700"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-3 py-2 rounded-md text-xs font-semibold bg-blue-600/80 text-blue-50 hover:bg-blue-600 disabled:opacity-60"
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
              <div className="md:col-span-2 text-green-300 text-sm">
                {okMsg}
              </div>
            )}
            {errorMsg && (
              <div className="md:col-span-2 text-red-400 text-sm flex items-center gap-2">
                <span>✖</span>
                <span>{errorMsg}</span>
              </div>
            )}
          </form>
        </section>
      )}

      {/* ===================== Sección: Citas ===================== */}
      {tab === "citas" && (
        <section className="card-rich p-4 md:p-6 text-sm">
          {/* Toggle modo + filtros */}
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3 mb-4">
            <div className="flex items-center gap-2">
              <button
                onClick={handleModeDay}
                className={`px-3 py-2 rounded-lg text-xs ${
                  mode === "day"
                    ? "bg-neutral-700 text-white"
                    : "bg-neutral-900 text-neutral-300 hover:bg-neutral-800"
                }`}
                title="Ver citas (todas las fechas o por día específico)"
              >
                Por día
              </button>
              <button
                onClick={handleModeMonth}
                className={`px-3 py-2 rounded-lg text-xs ${
                  mode === "month"
                    ? "bg-neutral-700 text-white"
                    : "bg-neutral-900 text-neutral-300 hover:bg-neutral-800"
                }`}
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
                    className="rounded-lg bg-neutral-900/50 border border-neutral-700/50 px-3 py-2 text-neutral-100 text-xs md:text-sm"
                    title="Filtrar por fecha (opcional)"
                  />
                  <label className="flex items-center gap-2 text-xs text-neutral-300">
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
                      className="rounded-lg bg-neutral-900/50 border border-neutral-700/50 px-3 py-2 text-neutral-100 text-xs md:text-sm"
                    />
                  )}
                </>
              )}

              {mode === "month" && (
                <input
                  type="month"
                  value={month}
                  onChange={(e) => setMonth(e.target.value)}
                  className="rounded-lg bg-neutral-900/50 border border-neutral-700/50 px-3 py-2 text-neutral-100 text-xs md:text-sm"
                  title="Cambiar mes"
                />
              )}

              {/* 🔎 Buscador de citas (nombre / DNI) */}
              <input
                type="text"
                placeholder="Buscar por nombre o DNI…"
                value={citasSearch}
                onChange={(e) => setCitasSearch(e.target.value)}
                className="rounded-lg bg-neutral-900/50 border border-neutral-700/50 px-3 py-2 text-neutral-100 text-xs md:text-sm min-w-[180px]"
              />

              {/* 🎛️ Filtro por estado */}
              <select
                value={citasEstado}
                onChange={(e) => setCitasEstado(e.target.value)}
                className="rounded-lg bg-neutral-900/50 border border-neutral-700/50 px-3 py-2 text-neutral-100 text-xs md:text-sm"
                title="Filtrar por estado"
              >
                <option value="todos">Todos los estados</option>
                <option value="solicitada">Solicitada</option>
                <option value="en_revision">En revisión</option>
                <option value="autorizada">Ingresada</option>
                <option value="denegada">Denegada</option>
                <option value="cancelada">Cancelada</option>
              </select>

              <button
                onClick={fetchCitas}
                className="px-3 py-2 rounded-md text-xs font-semibold bg-blue-600/80 text-blue-50 hover:bg-blue-600"
              >
                Actualizar
              </button>
            </div>
          </div>

          {loading ? (
            <div className="text-neutral-400">Cargando…</div>
          ) : grouped.length === 0 ? (
            <div className="text-neutral-400">
              {mode === "day"
                ? "Sin citas agendadas."
                : "Sin citas en el mes seleccionado."}
            </div>
          ) : (
            <div className="flex flex-col gap-6">
              {grouped.map(([k, arr]) => (
                <div
                  key={k}
                  className="rounded-xl border border-neutral-800/60 bg-neutral-900/30"
                >
                  <div className="px-4 py-3 text-neutral-300 text-sm border-b border-neutral-800/60">
                    <span className="font-semibold">{fmtDate(k)}</span> —{" "}
                    {arr.length} cita(s)
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse min-w-[900px]">
                      <thead className="text-xs uppercase text-neutral-400 border-b border-neutral-700/40">
                        <tr className="[&>th]:py-2 [&>th]:pr-4">
                          <th>Visitante</th>
                          <th>Empresa</th>
                          <th>Empleado</th>
                          <th>Motivo</th>
                          <th>Hora</th>
                          <th>Estado</th>
                          <th className="text-right">Acciones</th>
                        </tr>
                      </thead>
                      <tbody className="text-neutral-200">
                        {arr.map((it) => (
                          <tr
                            key={it._id}
                            className="border-b border-neutral-800/40 text-sm [&>td]:py-3 [&>td]:pr-4"
                          >
                            <td className="font-medium text-neutral-100">
                              {it.nombre}
                            </td>
                            <td>{it.empresa}</td>
                            <td>{it.empleado}</td>
                            <td className="text-neutral-300">
                              {it.motivo}
                            </td>
                            <td>{fmtTime(it.citaAt)}</td>
                            <td>
                              <CitaEstadoPill estado={it.estado} />
                            </td>
                            <td className="text-right">
                              <button
                                type="button"
                                onClick={() => handleEditCita(it)}
                                className="px-2 py-1 rounded-md text-xs font-semibold bg-blue-500/80 text-neutral-50 hover:bg-blue-400"
                              >
                                Editar
                              </button>
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
        <label className="block text-neutral-300 mb-1 text-xs md:text-sm">
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
          className="w-full rounded-lg bg-neutral-900/50 border border-neutral-700/50 px-3 py-2 text-neutral-100 focus:outline-none focus:ring-2 focus:ring-blue-600/40"
        />
      )}

      {error && <p className="text-red-400 text-xs mt-1">{error}</p>}
    </div>
  );
}
