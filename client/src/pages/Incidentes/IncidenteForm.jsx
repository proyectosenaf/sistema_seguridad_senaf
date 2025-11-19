// src/modules/incidentes/IncidenteForm.jsx
import React, { useState, useRef, useEffect } from "react";
import { useLocation, useNavigate, Link } from "react-router-dom";
import CameraCapture from "../../components/CameraCapture.jsx";
import api from "../../lib/api.js";
import iamApi from "../../iam/api/iamApi.js"; // 👈 NUEVO: para traer guardias

export default function IncidenteForm({
  stayOnFinish = false,
  onCancel,
  origin,
  extraData = {},
}) {
  const nav = useNavigate();
  const location = useLocation();

  // 1) prop
  // 2) state
  // 3) query ?from=ronda
  const search = new URLSearchParams(location.search);
  const fromQueryIsRonda = search.get("from") === "ronda";
  const locationStay = location.state?.stayOnFinish ?? false;
  const finalStayOnFinish = stayOnFinish || locationStay || fromQueryIsRonda;

  // soporte opcional para edición si alguien manda location.state.incidente
  const editingIncident = location.state?.incidente || null;
  const editing = !!editingIncident;

  const [form, setForm] = useState({
    type: "Acceso no autorizado",
    description: "",
    reportedBy: "",          // nombre / etiqueta que verá el supervisor
    reportedByGuardId: "",   // 👈 opId/guardId seleccionado en el combo
    zone: "",
    priority: "alta",
    status: "abierto",
  });

  const [photos, setPhotos] = useState([]);
  const [sending, setSending] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const fileInputRef = useRef(null);

  // 🧑‍🏭 Guardias para el select "Reportado por"
  const [guards, setGuards] = useState([]);
  const [loadingGuards, setLoadingGuards] = useState(false);

  /* ================== helpers guardias ================== */
  function getGuardLabel(g) {
    if (!g) return "";
    return g.email
      ? `${g.name || "(Sin nombre)"} — ${g.email}`
      : g.name || "(Sin nombre)";
  }

  // carga catálogo de guardias desde IAM
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoadingGuards(true);
        let items = [];
        if (typeof iamApi.listGuards === "function") {
          const r = await iamApi.listGuards("", true);
          items = r.items || [];
        } else {
          // fallback por si no existe listGuards
          const r = await iamApi.listUsers("");
          const NS = "https://senaf.local/roles";
          items = (r.items || [])
            .filter((u) => {
              const roles = [
                ...(Array.isArray(u.roles) ? u.roles : []),
                ...(Array.isArray(u[NS]) ? u[NS] : []),
              ].map((x) => String(x).toLowerCase());
              return (
                roles.includes("guardia") ||
                roles.includes("guard") ||
                roles.includes("rondasqr.guard")
              );
            })
            .map((u) => ({
              _id: u._id,
              name: u.name,
              email: u.email,
              opId: u.opId || u.sub || u.legacyId || String(u._id),
              active: u.active !== false,
            }));
        }

        const normalized = (items || []).map((u) => ({
          _id: u._id,
          name: u.name,
          email: u.email,
          opId: u.opId || u.sub || u.legacyId || String(u._id),
          active: u.active !== false,
        }));

        if (mounted) setGuards(normalized);
      } catch (e) {
        console.warn("[IncidenteForm] listGuards error:", e);
        if (mounted) setGuards([]);
      } finally {
        if (mounted) setLoadingGuards(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  // si viene en modo edición, precargar datos
  useEffect(() => {
    if (!editingIncident) return;

    setForm((prev) => ({
      ...prev,
      type: editingIncident.type || "Acceso no autorizado",
      description: editingIncident.description || "",
      reportedBy: editingIncident.reportedBy || "",
      // tratamos de recuperar guardId/opId si existiera
      reportedByGuardId:
        editingIncident.reportedByGuardId ||
        editingIncident.guardId ||
        editingIncident.opId ||
        "",
      zone: editingIncident.zone || "",
      priority: editingIncident.priority || "alta",
      status: editingIncident.status || "abierto",
    }));

    if (Array.isArray(editingIncident.photosBase64)) {
      setPhotos(editingIncident.photosBase64);
    } else if (Array.isArray(editingIncident.photos)) {
      setPhotos(editingIncident.photos);
    }
  }, [editingIncident]);

  const handleChange = (e) =>
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));

  // cambio específico del select de guardia
  const handleReporterChange = (e) => {
    const opId = e.target.value;
    const g = guards.find((x) => String(x.opId) === String(opId));
    setForm((prev) => ({
      ...prev,
      reportedByGuardId: opId,
      reportedBy: g ? getGuardLabel(g) : "",
    }));
  };

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const b64 = await fileToBase64(file);
    setPhotos((prev) => [...prev, b64]);
    e.target.value = "";
  };

  const handleCameraCapture = (dataUrl) => {
    setPhotos((prev) => [...prev, dataUrl]);
    setShowCamera(false);
  };

  const resetForm = () => {
    setForm({
      type: "Acceso no autorizado",
      description: "",
      reportedBy: "",
      reportedByGuardId: "",
      zone: "",
      priority: "alta",
      status: "abierto",
    });
    setPhotos([]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!form.description.trim()) {
      alert("Describa el incidente.");
      return;
    }
    if (!form.reportedByGuardId) {
      alert("Seleccione el guardia que reporta el incidente.");
      return;
    }

    try {
      setSending(true);

      // resolvemos guardia seleccionado para mandar datos ricos al backend
      const guard = guards.find(
        (g) => String(g.opId) === String(form.reportedByGuardId)
      );
      const guardLabel = guard ? getGuardLabel(guard) : form.reportedBy;

      const payload = {
        ...form,
        reportedBy: guardLabel,                       // texto visible
        guardId: form.reportedByGuardId || undefined, // 👈 ID opId/guardId
        guardName: guard?.name || undefined,
        guardEmail: guard?.email || undefined,
        photosBase64: photos,
        ...(origin ? { origin } : {}),
        ...extraData,
      };

      // 🔐 Usamos el cliente axios `api` que ya mete Authorization con Auth0
      if (editingIncident) {
        await api.put(`/incidentes/${editingIncident._id}`, payload, {
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
        });
      } else {
        await api.post("/incidentes", payload, {
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
        });
      }

      if (finalStayOnFinish) {
        // usado desde rondas → no navegar
        resetForm();
      } else {
        // usado desde módulo incidentes
        nav("/incidentes/lista");
      }
    } catch (err) {
      console.error(err);
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        "Error al guardar el incidente";
      alert(msg);
    } finally {
      setSending(false);
    }
  };

  const handleCancel = () => {
    if (onCancel) {
      onCancel();
      return;
    }

    if (finalStayOnFinish) {
      // viene de rondas → solo limpiar
      resetForm();
    } else {
      nav("/incidentes/lista");
    }
  };

  return (
    <div className="min-h-screen px-4 py-6 md:p-8 max-w-[1100px] mx-auto space-y-6 transition-colors">
      {/* migas solo si NO venimos de rondas */}
      {!finalStayOnFinish && (
        <div className="text-xs text-gray-500 dark:text-white/60 flex flex-wrap items-center gap-2">
          <Link
            to="/"
            className="hover:text-black dark:hover:text-white hover:underline underline-offset-4"
          >
            Panel principal
          </Link>
          <span className="text-gray-400">/</span>
          <Link
            to="/incidentes/lista"
            className="hover:text-black dark:hover:text-white hover:underline underline-offset-4"
          >
            Gestión de Incidentes
          </Link>
          <span className="text-gray-400">/</span>
          <span className="text-gray-700 dark:text-white/85">
            {editing ? "Editar incidente" : "Reportar Incidente"}
          </span>
        </div>
      )}

      {/* tarjeta principal */}
      <div className="rounded-xl p-6 md:p-8 bg-white/70 dark:bg-black/5 border border-gray-200 dark:border-white/10 shadow-lg dark:shadow-sm backdrop-blur-sm transition-all">
        <h2 className="text-2xl font-semibold text-gray-800 dark:text-white mb-6">
          {editing ? "Editar incidente" : "Reportar Nuevo Incidente"}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-6 text-sm">
          {/* Tipo */}
          <div>
            <label className="block mb-2 text-gray-700 dark:text-white/80 font-medium">
              Tipo de Incidente
            </label>
            <select
              name="type"
              value={form.type}
              onChange={handleChange}
              className="w-full bg-gray-100 dark:bg-black/20 text-gray-800 dark:text-white border border-gray-300 dark:border-white/10 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-cyan-400/60"
            >
              <option>Acceso no autorizado</option>
              <option>Falla técnica</option>
              <option>Objeto perdido</option>
              <option>Otro</option>
            </select>
          </div>

          {/* Descripción */}
          <div>
            <label className="block mb-2 text-gray-700 dark:text-white/80 font-medium">
              Descripción del Incidente
            </label>
            <textarea
              name="description"
              value={form.description}
              onChange={handleChange}
              className="w-full bg-gray-100 dark:bg-black/20 text-gray-800 dark:text-white border border-gray-300 dark:border-white/10 rounded-lg px-3 py-2 min-h-[110px] resize-none focus:outline-none focus:ring-2 focus:ring-cyan-400/60 placeholder:text-gray-400 dark:placeholder:text-white/25"
              placeholder="Describa detalladamente lo ocurrido..."
              required
            />
          </div>

          {/* Reportado / Zona */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Reportado por: SELECT de guardias */}
            <div>
              <label className="block mb-2 text-gray-700 dark:text-white/80 font-medium">
                Reportado por
              </label>
              <select
                name="reportedByGuardId"
                value={form.reportedByGuardId}
                onChange={handleReporterChange}
                className="w-full bg-gray-100 dark:bg-black/20 text-gray-800 dark:text-white border border-gray-300 dark:border-white/10 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-cyan-400/60"
                required
              >
                <option value="">
                  {loadingGuards
                    ? "Cargando guardias..."
                    : "Seleccione el guardia que reporta"}
                </option>
                {guards.map((g) => (
                  <option key={g._id || g.opId} value={g.opId}>
                    {getGuardLabel(g)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block mb-2 text-gray-700 dark:text-white/80 font-medium">
                Zona / Ubicación
              </label>
              <input
                name="zone"
                value={form.zone}
                onChange={handleChange}
                className="w-full bg-gray-100 dark:bg-black/20 text-gray-800 dark:text-white border border-gray-300 dark:border-white/10 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-cyan-400/60 placeholder:text-gray-400 dark:placeholder:text-white/25"
                placeholder="Ej. Entrada Principal / Comayagua / Sala Juntas A"
                required
              />
            </div>
          </div>

          {/* Prioridad */}
          <div>
            <label className="block mb-2 text-gray-700 dark:text-white/80 font-medium">
              Prioridad
            </label>
            <select
              name="priority"
              value={form.priority}
              onChange={handleChange}
              className="w-full bg-gray-100 dark:bg-black/20 text-gray-800 dark:text-white border border-gray-300 dark:border-white/10 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-cyan-400/60"
            >
              <option value="alta">Alta</option>
              <option value="media">Media</option>
              <option value="baja">Baja</option>
            </select>
          </div>

          {/* Evidencias */}
          <div className="space-y-2">
            <label className="block mb-1 text-gray-700 dark:text-white/80 font-medium">
              Evidencias (fotos)
            </label>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="bg-gradient-to-r from-[#0F6CBD] to-[#00A6FB] px-4 py-2 rounded-lg font-semibold text-white shadow-[0_0_14px_rgba(0,166,251,0.25)] hover:brightness-110 transition-all inline-flex items-center gap-2"
              >
                📁 Seleccionar archivo
              </button>
              <button
                type="button"
                onClick={() => setShowCamera(true)}
                className="bg-gradient-to-r from-indigo-600 to-cyan-500 px-4 py-2 rounded-lg font-semibold text-white shadow-[0_0_14px_rgba(99,102,241,0.25)] hover:brightness-110 transition-all inline-flex items-center gap-2"
              >
                📷 Tomar foto
              </button>
              <p className="text-xs text-gray-500 dark:text-white/40 self-center">
                Puede adjuntar varias imágenes como evidencia.
              </p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFile}
              className="hidden"
            />
            {photos.length > 0 && (
              <div className="flex flex-wrap gap-3 mt-2">
                {photos.map((src, idx) => (
                  <div
                    key={idx}
                    className="relative w-24 h-24 rounded-lg overflow-hidden border border-cyan-400/25 bg-black/40"
                  >
                    <img
                      src={src}
                      alt={`evidencia-${idx + 1}`}
                      className="w-full h-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setPhotos((prev) => prev.filter((_, i) => i !== idx))
                      }
                      className="absolute top-1 right-1 bg-black/70 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="pt-4 flex flex-col sm:flex-row gap-3 sm:justify-end">
            <button
              type="button"
              onClick={handleCancel}
              className="text-sm bg-transparent border border-gray-300 dark:border-white/10 text-gray-600 dark:text-white/80 rounded-lg px-4 py-2 hover:text-black dark:hover:text-white hover:border-cyan-400/80 transition-all"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={sending}
              className="text-sm bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-400 hover:to-emerald-500 text-white font-semibold rounded-lg px-4 py-2 shadow-[0_0_14px_rgba(16,185,129,0.35)] transition-all disabled:opacity-70"
            >
              {sending
                ? editing
                  ? "Guardando cambios..."
                  : "Enviando..."
                : editing
                ? "Guardar cambios"
                : "Reportar incidente"}
            </button>
          </div>
        </form>
      </div>

      {showCamera && (
        <CameraCapture
          onCapture={handleCameraCapture}
          onClose={() => setShowCamera(false)}
        />
      )}
    </div>
  );
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}
