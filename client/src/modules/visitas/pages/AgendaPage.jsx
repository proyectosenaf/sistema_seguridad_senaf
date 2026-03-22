// client/src/modules/visitas/pages/AgendaPage.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../../lib/api.js";
import {
  DNI_DIGITS,
  PHONE_MIN_DIGITS,
  NAME_MAX,
  COMPANY_MAX,
  EMP_MAX,
  REASON_MAX,
  EMAIL_MAX,
  COMPANION_NAME_MAX,
} from "./agenda/constants.js";
import {
  readCurrentUser,
  normalizeDocumento,
  formatDocumentoInput,
  createEmptyCompanion,
  normalizeCompanionArray,
  loadStoredCitas,
  saveStoredCitas,
} from "./agenda/storage.js";
import {
  normalizeCatalogArray,
  normalizeBrandItem,
  normalizeModelItem,
  normalizeEstadoValue,
  buildISOFromDateAndTime,
  mergeServerAndLocal,
  toDisplayName,
  toDisplayCompany,
} from "./agenda/helpers.js";
import {
  sxCard,
  sxCardSoft,
  sxInput,
  sxGhostBtn,
  sxPrimaryBtn,
  sxSuccessBtn,
  sxDangerBtn,
} from "./agenda/styles.js";
import Field from "./agenda/components/Field.jsx";
import CitaEstadoPill from "./agenda/components/CitaEstadoPill.jsx";
import AgendaHeader from "./agenda/components/AgendaHeader.jsx";
import AgendaTabs from "./agenda/components/AgendaTabs.jsx";
import AgendaQrModal from "./agenda/components/AgendaQrModal.jsx";

/* ================== Helpers de rol ================== */

function normalizeRoleName(role) {
  if (!role) return "";

  if (typeof role === "string") {
    return role.trim().toLowerCase();
  }

  if (typeof role === "object") {
    return String(
      role.key ||
        role.code ||
        role.slug ||
        role.name ||
        role.nombre ||
        role.label ||
        role.rol ||
        role.role ||
        role.tipo ||
        ""
    )
      .trim()
      .toLowerCase();
  }

  return String(role).trim().toLowerCase();
}

function extractRoleNames(user) {
  if (!user || typeof user !== "object") return [];

  const candidates = [
    user.role,
    user.rol,
    user.userRole,
    user.tipo,
    user.roles,
    user.authorities,
    user.perfiles,
    user.profile,
    user.perfil,
    user.user?.role,
    user.user?.rol,
    user.user?.userRole,
    user.user?.tipo,
    user.user?.roles,
  ];

  const list = [];

  for (const item of candidates) {
    if (Array.isArray(item)) {
      item.forEach((x) => {
        const r = normalizeRoleName(x);
        if (r) list.push(r);
      });
      continue;
    }

    const r = normalizeRoleName(item);
    if (r) list.push(r);
  }

  return Array.from(new Set(list));
}

function isVisitorUser(user) {
  const roles = extractRoleNames(user);
  return roles.some((r) =>
    ["visita", "visitante", "visitor", "visitors"].includes(r)
  );
}

function readUserEmail(user) {
  return String(
    user?.email ||
      user?.correo ||
      user?.mail ||
      user?.user?.email ||
      user?.user?.correo ||
      user?.user?.mail ||
      ""
  ).trim();
}

function readUserName(user) {
  return String(
    user?.nombre ||
      user?.name ||
      user?.fullName ||
      user?.displayName ||
      user?.user?.nombre ||
      user?.user?.name ||
      user?.user?.fullName ||
      user?.user?.displayName ||
      ""
  ).trim();
}

function canShowQrForCita(cita) {
  const estado = normalizeEstadoValue(cita?.estado || "Programada");
  return (
    estado === "Autorizada" &&
    (!!cita?.qrDataUrl || !!cita?.qrPayload || !!cita?.qrToken)
  );
}

function getQrPendingMessage(cita) {
  const estado = normalizeEstadoValue(cita?.estado || "Programada");

  if (estado === "Autorizada") {
    return "La cita está autorizada, pero aún no se encontró el código QR.";
  }

  if (estado === "Denegada") {
    return "La cita fue denegada. No se generará código QR.";
  }

  if (estado === "Cancelada") {
    return "La cita fue cancelada. No se generará código QR.";
  }

  if (estado === "Finalizada") {
    return "La cita ya finalizó.";
  }

  if (estado === "Dentro") {
    return "La visita ya fue registrada como ingresada.";
  }

  return "Una vez autorizada esta agenda, se generará el código QR.";
}

/* ================== Página ================== */

export default function AgendaPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState("agendar");

  const currentUser = useMemo(() => readCurrentUser(), []);

  const currentRoles = useMemo(
    () => extractRoleNames(currentUser),
    [currentUser]
  );

  const currentRole = useMemo(() => currentRoles[0] || "", [currentRoles]);

  const currentDocumento = useMemo(() => {
    return normalizeDocumento(
      currentUser?.documento ||
        currentUser?.dni ||
        currentUser?.identityNumber ||
        currentUser?.user?.documento ||
        currentUser?.user?.dni ||
        currentUser?.user?.identityNumber ||
        ""
    );
  }, [currentUser]);

  const currentEmail = useMemo(() => readUserEmail(currentUser), [currentUser]);

  const currentVisitorName = useMemo(
    () => readUserName(currentUser),
    [currentUser]
  );

  const isVisitante = useMemo(() => isVisitorUser(currentUser), [currentUser]);

  /* ===================== FORMULARIO: AGENDAR ===================== */
  const initialFormState = useMemo(
    () => ({
      visitante: isVisitante ? currentVisitorName || "" : "",
      documento: currentDocumento || "",
      tipoCita: "personal",
      empresa: "",
      empleado: "",
      motivo: "",
      fecha: "",
      hora: "",
      telefono: "+504 ",
      correo: currentEmail || "",
    }),
    [currentDocumento, currentEmail, currentVisitorName, isVisitante]
  );

  const [form, setForm] = useState(initialFormState);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [okMsg, setOkMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  // Acompañante
  const [hasCompanion, setHasCompanion] = useState(false);
  const [companions, setCompanions] = useState([]);

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

  // Listado
  const [mode, setMode] = useState("day");
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  const [dateFilter, setDateFilter] = useState("");
  const [showMyCitas, setShowMyCitas] = useState(
    !!(isVisitante && currentDocumento)
  );
  const [myDocumento, setMyDocumento] = useState(currentDocumento || "");
  const [citasSearch, setCitasSearch] = useState("");
  const [citasEstado, setCitasEstado] = useState("todos");

  // Modal QR
  const [qrModal, setQrModal] = useState({
    open: false,
    qrDataUrl: "",
    qrPayload: "",
    qrToken: "",
    cita: null,
  });

  useEffect(() => {
    setForm(initialFormState);
  }, [initialFormState]);

  /* ===================== Catálogos ===================== */

  useEffect(() => {
    let mounted = true;

    (async () => {
      setLoadingBrands(true);
      try {
        const { data } = await api.get("/catalogos/vehiculos/marcas", {
          headers: { Accept: "application/json" },
        });

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
        const { data } = await api.get("/catalogos/vehiculos/modelos", {
          params: { marca: vehicleBrand },
          headers: { Accept: "application/json" },
        });

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
      visitante: isVisitante ? currentVisitorName || "" : "",
      documento: currentDocumento || "",
      correo: currentEmail || "",
    });
    setHasCompanion(false);
    setCompanions([]);
    setHasVehicle(false);
    setVehicleBrand("");
    setVehicleModel("");
    setVehicleModelCustom("");
    setVehiclePlate("");
    setEditingCita(null);
    setErrors({});
  }

  function addCompanion() {
    setCompanions((prev) => [...prev, createEmptyCompanion()]);
  }

  function removeCompanion(index) {
    setCompanions((prev) => prev.filter((_, i) => i !== index));
    setErrors((prev) => {
      const next = { ...prev };
      delete next[`companionNombre_${index}`];
      delete next[`companionDocumento_${index}`];
      return next;
    });
  }

  function updateCompanion(index, field, rawValue) {
    setCompanions((prev) =>
      prev.map((item, i) => {
        if (i !== index) return item;

        let value = rawValue;

        if (field === "nombre") {
          value = rawValue
            .replace(/[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ\s]/g, "")
            .slice(0, COMPANION_NAME_MAX);
        }

        if (field === "documento") {
          value = formatDocumentoInput(rawValue);
        }

        return {
          ...item,
          [field]: value,
        };
      })
    );

    setErrors((prev) => ({
      ...prev,
      [`companion${field === "nombre" ? "Nombre" : "Documento"}_${index}`]: "",
      companions: "",
    }));

    setOkMsg("");
    setErrorMsg("");
  }

  function onChange(e) {
    const { name, value } = e.target;
    let newValue = value;

    if (name === "visitante") {
      newValue = value
        .replace(/[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ\s]/g, "")
        .slice(0, NAME_MAX);
    } else if (name === "documento") {
      newValue = formatDocumentoInput(value);
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

    if (hasCompanion) {
      if (!companions.length) {
        e.companions = "Debe registrar al menos un acompañante.";
      } else {
        companions.forEach((comp, index) => {
          const compNombre = String(comp?.nombre || "").trim();
          const compNombreParts = compNombre.split(/\s+/).filter(Boolean);
          const compDocumentoDigits = String(comp?.documento || "").replace(
            /\D/g,
            ""
          );

          if (!compNombre) {
            e[`companionNombre_${index}`] =
              "El nombre del acompañante es obligatorio.";
          } else if (compNombre.length > COMPANION_NAME_MAX) {
            e[`companionNombre_${index}`] =
              `El nombre no debe superar ${COMPANION_NAME_MAX} caracteres.`;
          } else if (compNombreParts.length < 2) {
            e[`companionNombre_${index}`] =
              "Ingrese el nombre completo del acompañante.";
          }

          if (!comp.documento?.trim()) {
            e[`companionDocumento_${index}`] =
              "El documento del acompañante es obligatorio.";
          } else if (compDocumentoDigits.length !== DNI_DIGITS) {
            e[`companionDocumento_${index}`] =
              `El documento debe tener exactamente ${DNI_DIGITS} dígitos.`;
          }
        });
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

  async function fetchCitas() {
    setLoading(true);

    try {
      const params = {};

      if (mode === "month" && month) {
        params.month = month;
      } else if (mode === "day" && dateFilter) {
        params.day = dateFilter;
      }

      const { data } = await api.get("/citas", { params });

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
            list = list.filter(
              (it) => String(it.citaAt || "").slice(0, 7) === month
            );
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

    const companionsPayload = hasCompanion
      ? companions
          .map((comp) => ({
            nombre: String(comp?.nombre || "").trim(),
            documento: String(comp?.documento || "").trim(),
          }))
          .filter((comp) => comp.nombre && comp.documento)
      : [];

    try {
      if (editingCita) {
        const updated = {
          ...editingCita,
          nombre: form.visitante.trim(),
          documento: form.documento.trim(),
          tipoCita: tipo,
          empresa: form.empresa.trim(),
          empleado: form.empleado.trim(),
          motivo: form.motivo.trim(),
          telefono: form.telefono.trim() || null,
          correo: form.correo.trim() || null,
          fecha,
          hora,
          citaAt: citaAtISO,
          acompanado: !!hasCompanion,
          acompanantes: companionsPayload,
          llegoEnVehiculo: !!hasVehicle,
          vehiculo: hasVehicle
            ? {
                marca: vehicleBrand.trim(),
                modelo: finalModel,
                placa: vehiclePlate.trim(),
              }
            : null,
        };

        const payload = {
          nombre: updated.nombre,
          documento: updated.documento,
          empresa: updated.empresa || null,
          empleado: updated.empleado || null,
          motivo: updated.motivo,
          telefono: updated.telefono || null,
          correo: updated.correo || null,
          citaAt: updated.citaAt,
          llegoEnVehiculo: updated.llegoEnVehiculo,
          vehiculo: updated.vehiculo,
          acompanado: updated.acompanado,
          acompanantes: updated.acompanantes,
          tipoCita: updated.tipoCita,
        };

        let serverError = "";
        let itemFromServer = null;
        let serverMessage = "";

        try {
          const { data } = await api.patch(`/citas/${editingCita._id}`, payload);
          if (data?.ok) {
            itemFromServer = data?.item || null;
            serverMessage = data?.message || "";
          } else {
            serverError =
              data?.error ||
              data?.message ||
              "No se pudo actualizar la cita en el servidor.";
          }
        } catch (err) {
          console.warn("[citas] error de red al actualizar en backend:", err);
          serverError =
            err?.response?.data?.error ||
            err?.response?.data?.message ||
            err?.message ||
            "No se pudo conectar con el servidor para actualizar la cita.";
        }

        if (serverError) {
          setErrorMsg(serverError);
          setOkMsg("");
          setSubmitting(false);
          return;
        }

        const finalItem = itemFromServer
          ? {
              ...updated,
              ...itemFromServer,
              qrDataUrl:
                itemFromServer.estado === "Autorizada"
                  ? itemFromServer.qrDataUrl || updated.qrDataUrl || ""
                  : "",
              qrPayload:
                itemFromServer.estado === "Autorizada"
                  ? itemFromServer.qrPayload || updated.qrPayload || ""
                  : "",
              qrToken:
                itemFromServer.estado === "Autorizada"
                  ? itemFromServer.qrToken || updated.qrToken || ""
                  : "",
              acompanado:
                typeof itemFromServer.acompanado === "boolean"
                  ? itemFromServer.acompanado
                  : updated.acompanado,
              acompanantes: normalizeCompanionArray(
                itemFromServer.acompanantes?.length
                  ? itemFromServer.acompanantes
                  : updated.acompanantes
              ),
            }
          : updated;

        setItems((prev) =>
          prev.map((it) => (it._id === editingCita._id ? finalItem : it))
        );

        const stored = loadStoredCitas();
        let found = false;

        const storedUpdated = stored.map((it) => {
          const key = it._id || it.id;
          if (key === editingCita._id) {
            found = true;
            return { ...it, ...finalItem };
          }
          return it;
        });

        if (!found) {
          storedUpdated.push(finalItem);
        }

        saveStoredCitas(storedUpdated);

        setOkMsg(
          serverMessage ||
            "✅ Cita actualizada correctamente. Si debe aprobarse nuevamente, el código QR se generará al autorizar."
        );
        setErrorMsg("");
        resetFormState();

        if (tab === "citas") {
          fetchCitas();
        }
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
        citaAt: citaAtISO,
        estado: "Programada",
        acompanado: !!hasCompanion,
        acompanantes: companionsPayload,
        llegoEnVehiculo: !!hasVehicle,
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
        acompanado: !!hasCompanion,
        acompanantes: companionsPayload,
      };

      let syncedWithServer = false;
      let serverError = "";
      let createdFromServer = null;
      let serverMessage = "";

      try {
        const { data } = await api.post("/citas", payload);

        if (data?.ok) {
          createdFromServer = data?.item || null;
          serverMessage = data?.message || "";

          if (createdFromServer) {
            syncedWithServer = true;
            nuevaCita._id = createdFromServer._id || nuevaCita._id;
            nuevaCita.citaAt = createdFromServer.citaAt || nuevaCita.citaAt;
            nuevaCita.estado =
              normalizeEstadoValue(createdFromServer.estado) || nuevaCita.estado;
            nuevaCita.qrDataUrl = "";
            nuevaCita.qrPayload = "";
            nuevaCita.qrToken = "";
            nuevaCita.nombre = createdFromServer.nombre || nuevaCita.nombre;
            nuevaCita.documento =
              createdFromServer.documento || nuevaCita.documento;
            nuevaCita.empresa = createdFromServer.empresa || nuevaCita.empresa;
            nuevaCita.empleado =
              createdFromServer.empleado || nuevaCita.empleado;
            nuevaCita.motivo = createdFromServer.motivo || nuevaCita.motivo;
            nuevaCita.telefono =
              createdFromServer.telefono || nuevaCita.telefono;
            nuevaCita.correo = createdFromServer.correo || nuevaCita.correo;
            nuevaCita.vehiculo =
              createdFromServer.vehiculo || nuevaCita.vehiculo;
            nuevaCita.llegoEnVehiculo =
              typeof createdFromServer.llegoEnVehiculo === "boolean"
                ? createdFromServer.llegoEnVehiculo
                : nuevaCita.llegoEnVehiculo;
            nuevaCita.acompanado =
              typeof createdFromServer.acompanado === "boolean"
                ? createdFromServer.acompanado
                : nuevaCita.acompanado;
            nuevaCita.acompanantes = normalizeCompanionArray(
              createdFromServer.acompanantes?.length
                ? createdFromServer.acompanantes
                : nuevaCita.acompanantes
            );
          }
        } else {
          serverError =
            data?.error ||
            data?.message ||
            "No se pudo crear la cita en el servidor.";
        }
      } catch (err) {
        console.warn("[citas] error de red al crear en backend:", err);
        serverError =
          err?.response?.data?.error ||
          err?.response?.data?.message ||
          err?.message ||
          "No se pudo crear la cita en el servidor.";
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
        setOkMsg(
          serverMessage ||
            "✅ Cita agendada correctamente. Una vez autorizada esta agenda, se generará el código QR."
        );
        setErrorMsg("");
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

  function handleEditCita(it) {
    const fechaInput =
      it.fecha || (it.citaAt ? String(it.citaAt).slice(0, 10) : "");
    const horaInput =
      it.hora ||
      (it.citaAt ? new Date(it.citaAt).toISOString().slice(11, 16) : "");

    const tipo = it.tipoCita || (it.empresa ? "profesional" : "personal");
    const companionsFromItem = normalizeCompanionArray(it.acompanantes);

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

    const hasComp =
      typeof it.acompanado === "boolean"
        ? it.acompanado
        : !!it.tieneAcompanante ||
          !!it.conAcompanante ||
          companionsFromItem.length > 0;

    setHasCompanion(hasComp);
    setCompanions(hasComp ? companionsFromItem : []);

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
        const companionText = Array.isArray(it?.acompanantes)
          ? it.acompanantes
              .map((a) => `${a?.nombre || ""} ${a?.documento || ""}`)
              .join(" ")
          : "";

        const full = `${toDisplayName(it)} ${it.documento || ""} ${
          it.empresa || ""
        } ${it.empleado || ""} ${it.motivo || ""} ${companionText}`
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
      const key = String(it.citaAt || "").slice(0, 10) || "";
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(it);
    }

    for (const arr of map.values()) {
      arr.sort((a, b) => new Date(a.citaAt || 0) - new Date(b.citaAt || 0));
    }

    return Array.from(map.entries()).sort(
      (a, b) => new Date(a[0]) - new Date(b[0])
    );
  }, [filteredItems]);

  return (
    <div className="layer-content relative z-[1] flex flex-col gap-6 pb-10">
      <div className="mesh mesh--ribbon" />
      <div className="mesh mesh--br" />
      <div className="mesh mesh--lb" />

      <AgendaHeader
        isVisitante={isVisitante}
        onBack={() => navigate("/visitas/control")}
      />

      <AgendaTabs
        tab={tab}
        onAgendar={() => {
          setTab("agendar");
          setEditingCita(null);
        }}
        onCitas={() => setTab("citas")}
      />

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
                  onChange={isVisitante ? undefined : onChange}
                  error={errors.correo}
                  placeholder="correo@dominio.com"
                  readOnly={isVisitante}
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

                    if (checked) {
                      setCompanions((prev) =>
                        prev.length ? prev : [createEmptyCompanion()]
                      );
                    } else {
                      setCompanions([]);
                      setErrors((prev) => {
                        const next = { ...prev };
                        delete next.companions;
                        Object.keys(next).forEach((key) => {
                          if (
                            key.startsWith("companionNombre_") ||
                            key.startsWith("companionDocumento_")
                          ) {
                            delete next[key];
                          }
                        });
                        return next;
                      });
                    }
                  }}
                />
                <label
                  htmlFor="has-companion-agenda"
                  className="text-xs cursor-pointer select-none"
                  style={{ color: "var(--text)" }}
                >
                  El visitante llegará acompañado
                </label>
              </div>

              {hasCompanion && (
                <div className="flex flex-col gap-3">
                  {errors.companions && (
                    <p className="text-xs" style={{ color: "#f87171" }}>
                      {errors.companions}
                    </p>
                  )}

                  {companions.map((companion, index) => (
                    <div
                      key={`companion-${index}`}
                      className="rounded-2xl p-4"
                      style={sxCardSoft()}
                    >
                      <div className="flex flex-col md:flex-row md:items-end gap-3">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 flex-1">
                          <Field
                            label={`Acompañante ${index + 1} *`}
                            name={`companionNombre_${index}`}
                            value={companion.nombre}
                            onChange={(e) =>
                              updateCompanion(index, "nombre", e.target.value)
                            }
                            error={errors[`companionNombre_${index}`]}
                            placeholder="Nombre y apellido"
                          />

                          <Field
                            label="Documento *"
                            name={`companionDocumento_${index}`}
                            value={companion.documento}
                            onChange={(e) =>
                              updateCompanion(index, "documento", e.target.value)
                            }
                            error={errors[`companionDocumento_${index}`]}
                            placeholder="DNI / Pasaporte"
                          />
                        </div>

                        <div className="flex items-center justify-end">
                          <button
                            type="button"
                            onClick={() => removeCompanion(index)}
                            className="px-3 py-2 rounded-md text-xs font-semibold transition"
                            style={sxDangerBtn()}
                            disabled={companions.length === 1}
                          >
                            Eliminar
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}

                  <div>
                    <button
                      type="button"
                      onClick={addCompanion}
                      className="px-3 py-2 rounded-md text-xs font-semibold transition"
                      style={sxSuccessBtn()}
                    >
                      + Agregar acompañante
                    </button>
                  </div>
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
                  <Field label="Marca *" name="vehicleBrand" error={errors.vehicleBrand}>
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

                  <Field label="Modelo *" name="vehicleModel" error={errors.vehicleModel}>
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

                        {(vehicleBrand === "Otra" || vehicleModel === "__custom") && (
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

                  <Field label="Placa *" name="vehiclePlate" error={errors.vehiclePlate}>
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

      {tab === "citas" && (
        <section className="p-4 md:p-6 text-sm rounded-[24px]" style={sxCard()}>
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3 mb-4">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setMode("day")}
                className="px-3 py-2 rounded-lg text-xs transition"
                style={mode === "day" ? sxPrimaryBtn() : sxGhostBtn()}
              >
                Por día
              </button>
              <button
                onClick={() => {
                  setMode("month");
                  setDateFilter("");
                }}
                className="px-3 py-2 rounded-lg text-xs transition"
                style={mode === "month" ? sxPrimaryBtn() : sxGhostBtn()}
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
                      placeholder="Documento"
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
                />
              )}

              <input
                type="text"
                placeholder="Buscar por nombre, DNI o acompañante…"
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
                    <span className="font-semibold">{k}</span> — {arr.length} cita(s)
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse min-w-[1120px]">
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
                          <th>Acompañantes</th>
                          <th>Hora</th>
                          <th>Estado</th>
                          <th className="text-right">Acciones</th>
                        </tr>
                      </thead>

                      <tbody style={{ color: "var(--text)" }}>
                        {arr.map((it) => {
                          const showQr = canShowQrForCita(it);
                          const qrMessage = getQrPendingMessage(it);

                          return (
                            <tr
                              key={it._id}
                              className="text-sm [&>td]:py-3 [&>td]:pr-4"
                              style={{ borderBottom: "1px solid var(--border)" }}
                            >
                              <td className="font-medium">{toDisplayName(it)}</td>
                              <td>{toDisplayCompany(it)}</td>
                              <td>{it.empleado}</td>
                              <td style={{ color: "var(--text-muted)" }}>{it.motivo}</td>
                              <td>
                                {it.acompanado && Array.isArray(it.acompanantes)
                                  ? `${it.acompanantes.length} acompañante(s)`
                                  : "No"}
                              </td>
                              <td>
                                {it.citaAt
                                  ? new Date(it.citaAt).toLocaleTimeString("es-HN", {
                                      hour: "2-digit",
                                      minute: "2-digit",
                                    })
                                  : ""}
                              </td>
                              <td>
                                <CitaEstadoPill estado={it.estado} />
                              </td>
                              <td className="text-right">
                                <div className="flex flex-col items-end gap-2">
                                  <div className="flex items-center justify-end gap-2">
                                    {showQr && (
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

                                  {!showQr && (
                                    <span
                                      className="text-[11px] leading-4 text-right max-w-[240px]"
                                      style={{ color: "var(--text-muted)" }}
                                    >
                                      {qrMessage}
                                    </span>
                                  )}
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

      <AgendaQrModal
        open={qrModal.open}
        qrModal={qrModal}
        onClose={closeQrModal}
      />
    </div>
  );
}