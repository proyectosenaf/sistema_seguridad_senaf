// client/src/modules/incidentes/IncidentesList.jsx
import React, { useEffect, useState, useRef, useMemo } from "react";
import { Link } from "react-router-dom";
import { useAuth0 } from "@auth0/auth0-react";

import CameraCapture from "../../components/CameraCapture.jsx";
import VideoRecorder from "../../components/VideoRecorder.jsx";
import AudioRecorder from "../../components/AudioRecorder.jsx";

import api, { API } from "../../lib/api.js";
import iamApi from "../../iam/api/iamApi.js";

// ✅ Dictado por voz
import useSpeechToText from "../../hooks/useSpeechToText.js";

// 👉 librerías para exportar
import jsPDF from "jspdf";
import "jspdf-autotable";
import * as XLSX from "xlsx";

// helper para mostrar bonito el nombre del guardia
function guardLabel(g) {
  const name = g?.name || "(Sin nombre)";
  return g?.email ? `${name} — ${g.email}` : name;
}

export default function IncidentesList() {
  const { getAccessTokenSilently, isAuthenticated } = useAuth0();

  const [incidentes, setIncidentes] = useState([]);
  const [stats, setStats] = useState({
    abiertos: 0,
    enProceso: 0,
    resueltos: 0,
    alta: 0,
  });

  const [showForm, setShowForm] = useState(false);

  // form inline (crear / editar)
  const [form, setForm] = useState({
    type: "Acceso no autorizado",
    description: "",
    reportedBy: "",
    reportedByGuardId: "",
    zone: "",
    priority: "alta",
    status: "abierto",
  });

  // media = [{ type: "image" | "video" | "audio", src }]
  const [media, setMedia] = useState([]);
  const [showCamera, setShowCamera] = useState(false);
  const [showVideoRecorder, setShowVideoRecorder] = useState(false);
  const [showAudioRecorder, setShowAudioRecorder] = useState(false);

  const fileInputRef = useRef(null);
  const [editingId, setEditingId] = useState(null);

  // ========= BASE para assets (solo host, sin /api) =========
  const API_HOST = useMemo(() => String(API || "").replace(/\/api$/, ""), []);

  // 👇 catálogo de guardias (IAM)
  const [guards, setGuards] = useState([]);

  /* ================== Dictado por voz (INLINE) ================== */
  const {
    supported: sttSupported,
    listening: sttListening,
    transcript: sttTranscript,
    error: sttError,
    start: sttStart,
    stop: sttStop,
    reset: sttReset,
  } = useSpeechToText({
    lang: "es-ES",
    continuous: false, // ✅ evita repetición
    interimResults: false,
  });

  const lastInsertedRef = useRef("");

  function normalizeSpeechText(t) {
    return String(t || "").replace(/\s+/g, " ").trim();
  }

  function appendTranscriptToDescription(forceText) {
    const raw = forceText != null ? forceText : sttTranscript;
    const t = normalizeSpeechText(raw);
    if (!t) return;

    // ✅ no insertar duplicado
    if (t === lastInsertedRef.current) {
      sttReset();
      return;
    }

    setForm((prev) => ({
      ...prev,
      description: prev.description ? `${prev.description}\n${t}` : t,
    }));

    lastInsertedRef.current = t;
    sttReset();
  }

  async function stopAndInsert() {
    try {
      await sttStop();
    } finally {
      setTimeout(() => appendTranscriptToDescription(), 50);
    }
  }

  function clearDictation() {
    sttReset();
    lastInsertedRef.current = "";
  }
  /* ============================================================ */

  function recomputeStats(list) {
    const abiertos = list.filter((i) => i.status === "abierto").length;
    const enProceso = list.filter((i) => i.status === "en_proceso").length;
    const resueltos = list.filter((i) => i.status === "resuelto").length;
    const alta = list.filter((i) => i.priority === "alta").length;
    setStats({ abiertos, enProceso, resueltos, alta });
  }

  // ───────── cargar incidentes ─────────
  useEffect(() => {
    (async () => {
      try {
        const res = await api.get("/incidentes", { params: { limit: 500 } });

        const data = Array.isArray(res.data)
          ? res.data
          : Array.isArray(res.data?.items)
          ? res.data.items
          : [];

        setIncidentes(data);
        recomputeStats(data);
      } catch (err) {
        console.error("Error cargando incidentes", err);
      }
    })();
  }, []);

  // ───────── cargar guardias desde IAM (con token si aplica) ─────────
  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        let items = [];

        if (typeof iamApi.listGuards === "function") {
          let token;

          try {
            if (isAuthenticated) {
              token = await getAccessTokenSilently({
                authorizationParams: {
                  audience: import.meta.env.VITE_AUTH0_AUDIENCE,
                },
              });
            }
          } catch (e) {
            console.warn(
              "[IncidentesList] no se pudo obtener access token para IAM:",
              e?.message || e
            );
          }

          const r = await iamApi.listGuards("", true, token);
          items = r.items || r.guards || r.users || [];
        } else if (typeof iamApi.listUsers === "function") {
          const r = await iamApi.listUsers("");
          const NS = "https://senaf.local/roles";
          items = (r.items || []).filter((u) => {
            const roles = [
              ...(Array.isArray(u.roles) ? u.roles : []),
              ...(Array.isArray(u[NS]) ? u[NS] : []),
            ].map((x) => String(x).toLowerCase());
            return (
              roles.includes("guardia") ||
              roles.includes("guard") ||
              roles.includes("rondasqr.guard")
            );
          });
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
        console.error("[IncidentesList] listGuards error:", e);
        if (mounted) setGuards([]);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [getAccessTokenSilently, isAuthenticated]);

  const actualizarEstado = async (id, nuevoEstado) => {
    try {
      const res = await api.put(`/incidentes/${id}`, { status: nuevoEstado });

      const serverItem = res.data?.item || res.data || {};
      const patch =
        serverItem && Object.keys(serverItem).length > 0
          ? serverItem
          : { status: nuevoEstado };

      setIncidentes((prev) => {
        const next = prev.map((inc) =>
          inc._id === id ? { ...inc, ...patch } : inc
        );
        recomputeStats(next);
        return next;
      });
    } catch (err) {
      console.error("Error actualizando incidente", err);
      alert("No se pudo actualizar el estado");
    }
  };

  // ----- extractores -----
  function extractPhotos(inc) {
    if (Array.isArray(inc.photosBase64)) return inc.photosBase64;
    if (Array.isArray(inc.photos)) return inc.photos;
    return [];
  }
  function extractVideos(inc) {
    if (Array.isArray(inc.videosBase64)) return inc.videosBase64;
    if (Array.isArray(inc.videos)) return inc.videos;
    return [];
  }
  function extractAudios(inc) {
    if (Array.isArray(inc.audiosBase64)) return inc.audiosBase64;
    if (Array.isArray(inc.audios)) return inc.audios;
    return [];
  }

  const handleFormChange = (e) =>
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));

  const handleReporterChange = (e) => {
    const opId = e.target.value;
    const g = guards.find((x) => String(x.opId) === String(opId));
    setForm((prev) => ({
      ...prev,
      reportedByGuardId: opId,
      reportedBy: g ? guardLabel(g) : "",
    }));
  };

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const b64 = await fileToBase64(file);
    const isVideo = file.type?.startsWith("video/");
    const isAudio = file.type?.startsWith("audio/");

    setMedia((prev) => [
      ...prev,
      { type: isVideo ? "video" : isAudio ? "audio" : "image", src: b64 },
    ]);

    e.target.value = "";
  };

  const handleCameraCapture = (dataUrl) => {
    setMedia((prev) => [...prev, { type: "image", src: dataUrl }]);
    setShowCamera(false);
  };

  const handleVideoCapture = (dataUrl) => {
    setMedia((prev) => [...prev, { type: "video", src: dataUrl }]);
    setShowVideoRecorder(false);
  };

  const handleAudioCapture = ({ base64 }) => {
    setMedia((prev) => [...prev, { type: "audio", src: base64 }]);
    setShowAudioRecorder(false);
  };

  const removeMedia = (idx) =>
    setMedia((prev) => prev.filter((_, i) => i !== idx));

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
    setMedia([]);
    setEditingId(null);
    clearDictation();
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
      const guard = guards.find(
        (g) => String(g.opId) === String(form.reportedByGuardId)
      );
      const label = guard ? guardLabel(guard) : form.reportedBy;

      const photosBase64 = media
        .filter((m) => m.type === "image")
        .map((m) => m.src);
      const videosBase64 = media
        .filter((m) => m.type === "video")
        .map((m) => m.src);
      const audiosBase64 = media
        .filter((m) => m.type === "audio")
        .map((m) => m.src);

      const payload = {
        type: form.type,
        description: form.description,
        zone: form.zone,
        priority: form.priority,
        status: form.status,
        reportedBy: label,
        guardId: form.reportedByGuardId || undefined,
        guardName: guard?.name || undefined,
        guardEmail: guard?.email || undefined,
        photosBase64,
        videosBase64,
        audiosBase64,
      };

      if (editingId) {
        const res = await api.put(`/incidentes/${editingId}`, payload);
        const actualizado = res.data?.item || res.data || {};
        setIncidentes((prev) => {
          const next = prev.map((i) =>
            i._id === editingId ? { ...i, ...actualizado } : i
          );
          recomputeStats(next);
          return next;
        });
      } else {
        const res = await api.post("/incidentes", payload);
        const creado = res.data?.item || res.data;
        setIncidentes((prev) => {
          const next = [creado, ...prev];
          recomputeStats(next);
          return next;
        });
      }

      resetForm();
      setShowForm(false);
    } catch (err) {
      console.error("Error guardando incidente", err);
      alert("No se pudo guardar el incidente");
    }
  };

  const startCreate = () => {
    resetForm();
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    resetForm();
  };

  const startEdit = (incidente) => {
    setShowForm(true);
    setEditingId(incidente._id);
    clearDictation(); // ✅ para que no se mezcle con dictado anterior

    let guardId =
      incidente.guardId || incidente.opId || incidente.reportedByGuardId || "";
    let reportedByLabel = incidente.reportedBy || "";

    if (!guardId && incidente.reportedBy && guards.length) {
      const match = guards.find((g) => guardLabel(g) === incidente.reportedBy);
      if (match) {
        guardId = match.opId;
        reportedByLabel = guardLabel(match);
      }
    }

    setForm({
      type: incidente.type || "Acceso no autorizado",
      description: incidente.description || "",
      reportedBy: reportedByLabel,
      reportedByGuardId: guardId,
      zone: incidente.zone || "",
      priority: incidente.priority || "alta",
      status: incidente.status || "abierto",
    });

    const oldPhotos = extractPhotos(incidente);
    const oldVideos = extractVideos(incidente);
    const oldAudios = extractAudios(incidente);

    setMedia([
      ...oldPhotos.map((src) => ({ type: "image", src })),
      ...oldVideos.map((src) => ({ type: "video", src })),
      ...oldAudios.map((src) => ({ type: "audio", src })),
    ]);
  };

  const handleDelete = async (id) => {
    const ok = window.confirm(
      "¿Seguro que deseas eliminar este incidente? Esta acción no se puede deshacer."
    );
    if (!ok) return;

    try {
      await api.delete(`/incidentes/${id}`);
      setIncidentes((prev) => {
        const next = prev.filter((i) => i._id !== id);
        recomputeStats(next);
        return next;
      });
    } catch (err) {
      console.error("Error eliminando incidente", err);
      alert("No se pudo eliminar el incidente");
    }
  };

  const handleExportPDF = () => {
    if (!incidentes.length) {
      alert("No hay incidentes para exportar.");
      return;
    }

    const doc = new jsPDF("l", "pt", "a4");

    const columns = [
      "#",
      "Tipo",
      "Descripción",
      "Reportado por",
      "Zona",
      "Fecha",
      "Prioridad",
      "Estado",
    ];

    const rows = incidentes.map((i, idx) => {
      const fecha =
        i.date || i.createdAt
          ? new Date(i.date || i.createdAt).toLocaleString()
          : "";
      let estadoLegible = "Abierto";
      if (i.status === "en_proceso") estadoLegible = "En proceso";
      else if (i.status === "resuelto") estadoLegible = "Resuelto";

      return [
        idx + 1,
        i.type || "",
        i.description || "",
        i.reportedBy || "",
        i.zone || "",
        fecha,
        i.priority || "",
        estadoLegible,
      ];
    });

    doc.setFontSize(14);
    doc.text("Reporte de Incidentes", 40, 30);

    doc.autoTable({
      head: [columns],
      body: rows,
      startY: 50,
      styles: { fontSize: 8, cellPadding: 4 },
      headStyles: { fillColor: [15, 27, 45] },
    });

    doc.save("incidentes.pdf");
  };

  const handleExportExcel = () => {
    if (!incidentes.length) {
      alert("No hay incidentes para exportar.");
      return;
    }

    const data = incidentes.map((i, idx) => {
      const fecha =
        i.date || i.createdAt
          ? new Date(i.date || i.createdAt).toLocaleString()
          : "";
      let estadoLegible = "Abierto";
      if (i.status === "en_proceso") estadoLegible = "En proceso";
      else if (i.status === "resuelto") estadoLegible = "Resuelto";

      return {
        "#": idx + 1,
        Tipo: i.type || "",
        Descripción: i.description || "",
        "Reportado por": i.reportedBy || "",
        Zona: i.zone || "",
        Fecha: fecha,
        Prioridad: i.priority || "",
        Estado: estadoLegible,
      };
    });

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Incidentes");
    XLSX.writeFile(wb, "incidentes.xlsx");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#001a12] via-[#00172a] to-[#000000] text-white p-6 max-w-[1400px] mx-auto space-y-8">
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-white">
            Gestión de Incidentes
          </h1>
          <p className="text-sm text-gray-400">
            Registra y da seguimiento a incidentes de seguridad
          </p>
        </div>

        <button
          onClick={showForm ? closeForm : startCreate}
          className="self-start bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded px-4 py-2 
                     border border-red-400/40 
                     shadow-[0_0_20px_rgba(255,0,0,0.4)] 
                     hover:shadow-[0_0_40px_rgba(255,0,0,0.8)] 
                     transition-all duration-300"
        >
          {showForm
            ? "Cerrar formulario"
            : editingId
            ? "Editar incidente"
            : "+ Reportar Incidente"}
        </button>
      </div>

      {showForm && (
        <div className="rounded-xl p-6 md:p-8 bg-white/70 dark:bg-white/5 border border-gray-200 dark:border-white/10 shadow-lg backdrop-blur-sm transition-all">
          <h2 className="text-xl font-semibold mb-6 text-gray-900 dark:text-white">
            {editingId ? "Editar incidente" : "Reportar Nuevo Incidente"}
          </h2>

          <form onSubmit={handleSubmit} className="space-y-6 text-sm">
            <div>
              <label className="block mb-2 text-gray-700 dark:text-white/80 font-medium">
                Tipo de Incidente
              </label>
              <select
                name="type"
                value={form.type}
                onChange={handleFormChange}
                className="w-full bg-gray-100 dark:bg-black/20 text-gray-800 dark:text-white border border-gray-300 dark:border-white/10 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-cyan-400/60"
              >
                <option>Acceso no autorizado</option>
                <option>Falla técnica</option>
                <option>Objeto perdido</option>
                <option>Otro</option>
              </select>
            </div>

            {/* ✅ Descripción + dictado (INLINE) */}
            <div>
              <div className="flex items-center justify-between gap-3 mb-2">
                <label className="block text-gray-700 dark:text-white/80 font-medium">
                  Descripción del Incidente
                </label>

                <div className="flex flex-wrap items-center gap-2">
                  {!sttSupported ? (
                    <span className="text-xs text-gray-500 dark:text-white/45">
                      🎙️ Dictado no disponible en este navegador
                    </span>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={sttListening ? stopAndInsert : sttStart}
                        className={
                          "px-3 py-1.5 rounded-lg text-xs font-semibold border transition " +
                          (sttListening
                            ? "bg-rose-600 text-white border-rose-500/40 hover:bg-rose-500"
                            : "bg-white/60 dark:bg-white/10 text-gray-800 dark:text-white border-gray-300 dark:border-white/10 hover:bg-white/80 dark:hover:bg-white/15")
                        }
                        title="Iniciar / detener dictado"
                      >
                        {sttListening ? "⏹ Detener" : "🎙 Grabar"}
                      </button>

                      <button
                        type="button"
                        onClick={() => appendTranscriptToDescription()}
                        disabled={!String(sttTranscript || "").trim()}
                        className={
                          "px-3 py-1.5 rounded-lg text-xs font-semibold border transition " +
                          (!String(sttTranscript || "").trim()
                            ? "opacity-50 cursor-not-allowed bg-white/40 dark:bg-white/5 text-gray-600 dark:text-white/60 border-gray-300 dark:border-white/10"
                            : "bg-emerald-600 text-white border-emerald-500/40 hover:bg-emerald-500")
                        }
                        title="Insertar lo dictado"
                      >
                        ➕ Insertar
                      </button>

                      <button
                        type="button"
                        onClick={clearDictation}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-gray-300 dark:border-white/10 bg-transparent text-gray-600 dark:text-white/70 hover:text-black dark:hover:text-white hover:border-cyan-400/80 transition-all"
                        title="Limpiar dictado"
                      >
                        🧹 Limpiar dictado
                      </button>
                    </>
                  )}
                </div>
              </div>

              <textarea
                name="description"
                value={form.description}
                onChange={handleFormChange}
                className="w-full bg-gray-100 dark:bg-black/20 text-gray-800 dark:text-white border border-gray-300 dark:border-white/10 rounded-lg px-3 py-2 min-h-[110px] resize-none focus:outline-none focus:ring-2 focus:ring-cyan-400/60 placeholder:text-gray-400 dark:placeholder:text-white/25"
                placeholder="Describa detalladamente lo ocurrido..."
                required
              />

              {sttSupported && (sttError || sttTranscript) ? (
                <div className="mt-2 rounded-lg border border-white/10 bg-black/10 dark:bg-white/5 p-3">
                  {sttError ? (
                    <div className="text-xs text-rose-600 dark:text-rose-300">
                      ⚠️ {sttError}
                    </div>
                  ) : null}
                  {sttTranscript ? (
                    <div className="mt-1 text-xs text-gray-700 dark:text-white/80 whitespace-pre-wrap">
                      <span className="opacity-70">Dictado:</span> {sttTranscript}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                  <option value="">Seleccione un guardia…</option>
                  {guards.map((g) => (
                    <option key={g._id || g.opId} value={g.opId}>
                      {guardLabel(g)}
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
                  onChange={handleFormChange}
                  className="w-full bg-gray-100 dark:bg-black/20 text-gray-800 dark:text-white border border-gray-300 dark:border-white/10 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-cyan-400/60 placeholder:text-gray-400 dark:placeholder:text-white/25"
                  placeholder="Ej. Entrada Principal / Comayagua / Sala Juntas A"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block mb-2 text-gray-700 dark:text-white/80 font-medium">
                Prioridad
              </label>
              <select
                name="priority"
                value={form.priority}
                onChange={handleFormChange}
                className="w-full bg-gray-100 dark:bg-black/20 text-gray-800 dark:text-white border border-gray-300 dark:border-white/10 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-cyan-400/60"
              >
                <option value="alta">Alta</option>
                <option value="media">Media</option>
                <option value="baja">Baja</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="block mb-1 text-gray-700 dark:text-white/80 font-medium">
                Evidencias (fotos / videos / audio)
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

                <button
                  type="button"
                  onClick={() => setShowVideoRecorder(true)}
                  className="bg-gradient-to-r from-purple-600 to-pink-500 px-4 py-2 rounded-lg font-semibold text-white shadow-[0_0_14px_rgba(236,72,153,0.35)] hover:brightness-110 transition-all inline-flex items-center gap-2"
                >
                  🎥 Grabar video
                </button>

                <button
                  type="button"
                  onClick={() => setShowAudioRecorder(true)}
                  className="bg-gradient-to-r from-amber-600 to-orange-500 px-4 py-2 rounded-lg font-semibold text-white shadow-[0_0_14px_rgba(245,158,11,0.25)] hover:brightness-110 transition-all inline-flex items-center gap-2"
                >
                  🎙️ Grabar audio
                </button>

                <p className="text-xs text-gray-500 dark:text-white/40 self-center">
                  Puede adjuntar evidencias desde archivos o grabarlas en tiempo real.
                </p>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,video/*,audio/*"
                onChange={handleFile}
                className="hidden"
              />

              {media.length > 0 && (
                <div className="flex flex-wrap gap-3 mt-2">
                  {media.map((item, idx) => (
                    <div
                      key={idx}
                      className={
                        "relative rounded-lg overflow-hidden border border-cyan-400/25 bg-black/40 " +
                        (item.type === "audio" ? "w-64 h-12 p-2 flex items-center" : "w-24 h-24")
                      }
                    >
                      {item.type === "image" ? (
                        <img
                          src={item.src}
                          alt={`evidencia-${idx + 1}`}
                          className="w-full h-full object-cover"
                        />
                      ) : item.type === "video" ? (
                        <video
                          src={item.src}
                          className="w-full h-full object-cover"
                          controls
                        />
                      ) : (
                        <audio src={item.src} controls className="w-full" />
                      )}

                      <button
                        type="button"
                        onClick={() => removeMedia(idx)}
                        className="absolute top-1 right-1 bg-black/70 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center"
                        title="Quitar"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="pt-2 flex flex-col sm:flex-row gap-3 sm:justify-end">
              <button
                type="button"
                onClick={closeForm}
                className="text-sm bg-transparent border border-gray-300 dark:border-white/10 text-gray-600 dark:text-white/80 rounded-lg px-4 py-2 hover:border-cyan-400/80 hover:text-black dark:hover:text-white transition-all"
              >
                Cancelar
              </button>

              <button
                type="submit"
                className="text-sm bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-400 hover:to-emerald-500 text-white font-semibold rounded-lg px-4 py-2 shadow-[0_0_14px_rgba(16,185,129,0.35)] transition-all duration-300"
              >
                {editingId ? "Guardar cambios" : "Guardar incidente"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ----- stats ----- */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="rounded-lg bg-[#0f1b2d] border border-red-400/40 p-4">
          <div className="text-xs uppercase text-red-300 font-medium flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-red-500" />
            Incidentes Abiertos
          </div>
          <div className="text-3xl font-semibold text-red-400">
            {stats.abiertos}
          </div>
        </div>

        <div className="rounded-lg bg-[#0f1b2d] border border-blue-400/40 p-4">
          <div className="text-xs uppercase text-blue-300 font-medium flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-blue-500" />
            En Proceso
          </div>
          <div className="text-3xl font-semibold text-blue-400">
            {stats.enProceso}
          </div>
        </div>

        <div className="rounded-lg bg-[#0f1b2d] border border-green-400/40 p-4">
          <div className="text-xs uppercase text-green-300 font-medium flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-500" />
            Resueltos
          </div>
          <div className="text-3xl font-semibold text-green-400">
            {stats.resueltos}
          </div>
        </div>

        <div className="rounded-lg bg-[#0f1b2d] border border-yellow-400/40 p-4">
          <div className="text-xs uppercase text-yellow-300 font-medium flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-yellow-400" />
            Alta prioridad
          </div>
          <div className="text-3xl font-semibold text-yellow-300">
            {stats.alta}
          </div>
        </div>
      </div>

      {/* ----- tabla ----- */}
      <div className="bg-white/5 border border-purple-500/40 rounded-2xl shadow-[0_0_30px_rgba(168,85,247,0.45)] overflow-hidden backdrop-blur-md">
        <div className="flex flex-col md:flex-row justify-between items-center p-4 border-b border-white/10 gap-3 bg-black/10">
          <div>
            <h2 className="font-semibold text-lg text-white">Lista de Incidentes</h2>
            <p className="text-xs text-gray-300">
              Historial de reportes registrados en el sistema
            </p>
          </div>

          <div className="w-full md:w-1/3 flex flex-col gap-2">
            <input
              className="w-full bg-black/30 text-white text-sm rounded-md px-3 py-2 
                         border border-purple-400/40 placeholder-gray-500 
                         focus:outline-none focus:ring-2 focus:ring-purple-400/60 
                         transition-all duration-200"
              placeholder="Buscar por tipo, descripción o zona..."
              onChange={() => {}}
            />

            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={handleExportPDF}
                className="text-xs bg-indigo-600/90 hover:bg-indigo-700 text-white font-medium rounded px-3 py-2 transition-all duration-200"
              >
                Exportar PDF
              </button>

              <button
                type="button"
                onClick={handleExportExcel}
                className="text-xs bg-emerald-600/90 hover:bg-emerald-700 text-white font-medium rounded px-3 py-2 transition-all duration-200"
              >
                Exportar Excel
              </button>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left text-gray-200">
            <thead className="bg-white/5 text-gray-300 uppercase text-xs border-b border-white/10">
              <tr>
                <th className="px-4 py-3 font-medium">TIPO</th>
                <th className="px-4 py-3 font-medium">DESCRIPCIÓN</th>
                <th className="px-4 py-3 font-medium">REPORTADO POR</th>
                <th className="px-4 py-3 font-medium">ZONA</th>
                <th className="px-4 py-3 font-medium">FECHA</th>
                <th className="px-4 py-3 font-medium">PRIORIDAD</th>
                <th className="px-4 py-3 font-medium">ESTADO</th>
                <th className="px-4 py-3 font-medium">EVIDENCIAS</th>
                <th className="px-4 py-3 font-medium text-right">ACCIONES</th>
              </tr>
            </thead>

            <tbody>
              {incidentes.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center text-gray-400 py-10 text-sm">
                    No hay incidentes registrados.
                  </td>
                </tr>
              ) : (
                incidentes.map((i) => {
                  const photos = extractPhotos(i);
                  const videos = extractVideos(i);
                  const audios = extractAudios(i);
                  const total = photos.length + videos.length + audios.length;

                  return (
                    <tr
                      key={i._id}
                      className="border-b border-white/5 hover:bg-white/5 transition-colors"
                    >
                      <td className="px-4 py-3 text-white font-medium">{i.type}</td>

                      <td className="px-4 py-3 text-gray-200 max-w-[320px] truncate">
                        {i.description}
                      </td>

                      <td className="px-4 py-3 text-gray-200">{i.reportedBy}</td>
                      <td className="px-4 py-3 text-gray-200">{i.zone}</td>

                      <td className="px-4 py-3 whitespace-nowrap text-gray-300 text-xs">
                        {i.date || i.createdAt
                          ? new Date(i.date || i.createdAt).toLocaleString()
                          : "—"}
                      </td>

                      <td className="px-4 py-3">
                        <span
                          className={
                            "px-2 py-1 rounded text-[11px] font-semibold uppercase tracking-wide " +
                            (i.priority === "alta"
                              ? "bg-red-600/25 text-red-300 border border-red-400/60"
                              : i.priority === "media"
                              ? "bg-yellow-400/20 text-yellow-200 border border-yellow-300/60"
                              : "bg-green-600/20 text-green-300 border border-green-400/60")
                          }
                        >
                          {i.priority}
                        </span>
                      </td>

                      <td className="px-4 py-3">
                        <span
                          className={
                            "px-2 py-1 rounded text-[11px] font-semibold uppercase tracking-wide " +
                            (i.status === "resuelto"
                              ? "bg-green-600/20 text-green-300 border border-green-400/60"
                              : i.status === "en_proceso"
                              ? "bg-blue-600/20 text-blue-300 border border-blue-400/60"
                              : "bg-red-600/20 text-red-300 border border-red-400/60")
                          }
                        >
                          {i.status === "en_proceso"
                            ? "En proceso"
                            : i.status === "resuelto"
                            ? "Resuelto"
                            : "Abierto"}
                        </span>
                      </td>

                      <td className="px-4 py-3">
                        {total ? (
                          <div className="flex items-center gap-2">
                            {photos.length ? (
                              <span className="text-xs text-gray-200">📷 {photos.length}</span>
                            ) : null}
                            {videos.length ? (
                              <span className="text-xs text-gray-200">🎥 {videos.length}</span>
                            ) : null}
                            {audios.length ? (
                              <span className="text-xs text-gray-200">🎙️ {audios.length}</span>
                            ) : null}
                          </div>
                        ) : (
                          <span className="text-xs text-gray-500">—</span>
                        )}
                      </td>

                      <td className="px-4 py-3 text-right whitespace-nowrap space-x-2">
                        {i.status === "abierto" && (
                          <button
                            onClick={() => actualizarEstado(i._id, "en_proceso")}
                            className="text-[11px] bg-blue-600 hover:bg-blue-700 text-white rounded px-3 py-1 transition-all duration-300"
                          >
                            Procesar
                          </button>
                        )}

                        {i.status === "en_proceso" && (
                          <button
                            onClick={() => actualizarEstado(i._id, "resuelto")}
                            className="text-[11px] bg-green-600 hover:bg-green-700 text-white rounded px-3 py-1 transition-all duration-300"
                          >
                            Resolver
                          </button>
                        )}

                        <button
                          onClick={() => startEdit(i)}
                          className="text-[11px] bg-indigo-600 hover:bg-indigo-700 text-white rounded px-3 py-1 transition-all duration-300"
                        >
                          Editar
                        </button>

                        <button
                          onClick={() => handleDelete(i._id)}
                          className="text-[11px] bg-rose-600 hover:bg-rose-700 text-white rounded px-3 py-1 transition-all duration-300"
                        >
                          Eliminar
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="text-xs text-gray-500">
        <Link
          to="/"
          className="hover:text-white hover:underline underline-offset-4 transition-colors"
        >
          ← Volver al panel principal
        </Link>
      </div>

      {showCamera && (
        <CameraCapture
          onCapture={handleCameraCapture}
          onClose={() => setShowCamera(false)}
        />
      )}

      {showVideoRecorder && (
        <VideoRecorder
          onCapture={handleVideoCapture}
          onClose={() => setShowVideoRecorder(false)}
        />
      )}

      {showAudioRecorder && (
        <AudioRecorder
          onCapture={handleAudioCapture}
          onClose={() => setShowAudioRecorder(false)}
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

