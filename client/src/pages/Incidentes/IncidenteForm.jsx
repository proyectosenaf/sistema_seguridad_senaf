// client/src/modules/incidentes/IncidenteForm.jsx
import React, { useState, useRef, useEffect } from "react";
import { useLocation, useNavigate, Link } from "react-router-dom";
import CameraCapture from "../../components/CameraCapture.jsx";
import VideoRecorder from "../../components/VideoRecorder.jsx";
import AudioRecorder from "../../components/AudioRecorder.jsx";
import api from "../../lib/api.js";
import iamApi from "../../iam/api/iamApi.js";

// ✅ Dictado por voz
import useSpeechToText from "../../hooks/useSpeechToText.js";

export default function IncidenteForm({
  stayOnFinish = false,
  onCancel,
  origin,
  extraData = {},
}) {
  const nav = useNavigate();
  const location = useLocation();

  const search = new URLSearchParams(location.search);
  const fromQueryIsRonda = search.get("from") === "ronda";
  const locationStay = location.state?.stayOnFinish ?? false;
  const finalStayOnFinish = stayOnFinish || locationStay || fromQueryIsRonda;

  const editingIncident = location.state?.incidente || null;
  const editing = !!editingIncident;

  const [form, setForm] = useState({
    type: "Acceso no autorizado",
    description: "",
    reportedBy: "",
    reportedByGuardId: "",
    zone: "",
    priority: "alta",
    status: "abierto",
  });

  // media = [{ type: "image"|"video"|"audio", src: dataUrl }]
  const [media, setMedia] = useState([]);
  const [sending, setSending] = useState(false);

  const [showCamera, setShowCamera] = useState(false);
  const [showVideoRecorder, setShowVideoRecorder] = useState(false);
  const [showAudioRecorder, setShowAudioRecorder] = useState(false);

  const fileInputRef = useRef(null);

  // Guardias IAM
  const [guards, setGuards] = useState([]);
  const [loadingGuards, setLoadingGuards] = useState(false);

  /* ================== Dictado por voz ================== */
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
    continuous: false,
    interimResults: false,
  });

  // Evita insertar lo mismo 2+ veces
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

  // ✅ Al detener, insertamos 1 vez automáticamente
  async function stopAndInsert() {
    try {
      await sttStop();
    } finally {
      setTimeout(() => appendTranscriptToDescription(), 50);
    }
  }

  /* ================== helpers guardias ================== */
  function getGuardLabel(g) {
    if (!g) return "";
    return g.email
      ? `${g.name || "(Sin nombre)"} — ${g.email}`
      : g.name || "(Sin nombre)";
  }

  // ---- Extractores para editar (ahora incluye video/audio) ----
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

  // ✅ Cargar guardias (SAFE)
  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        setLoadingGuards(true);

        let items = [];

        // ✅ endpoint safe (PROD)
        if (typeof iamApi.listGuardsPicker === "function") {
          const r = await iamApi.listGuardsPicker("", true);
          items = r?.items || r?.guards || r?.users || r || [];
        }
        // fallback: endpoint admin (solo si el usuario lo tiene)
        else if (typeof iamApi.listGuards === "function") {
          const r = await iamApi.listGuards("", true);
          items = r?.items || r?.guards || r?.users || [];
        } else {
          items = [];
        }

        const normalized = (items || [])
          .filter(Boolean)
          .map((u) => ({
            _id: u._id,
            name: u.name,
            email: u.email,
            opId: u.opId || u.sub || u.legacyId || String(u._id),
            active: u.active !== false,
          }))
          .filter((u) => u.active !== false);

        if (mounted) setGuards(normalized);
      } catch (e) {
        console.warn("[IncidenteForm] listGuardsPicker error:", e);
        if (mounted) setGuards([]);
      } finally {
        if (mounted) setLoadingGuards(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  // Modo edición: cargar campos + media
  useEffect(() => {
    if (!editingIncident) return;

    setForm((prev) => ({
      ...prev,
      type: editingIncident.type || "Acceso no autorizado",
      description: editingIncident.description || "",
      reportedBy: editingIncident.reportedBy || "",
      reportedByGuardId:
        editingIncident.reportedByGuardId ||
        editingIncident.guardId ||
        editingIncident.opId ||
        "",
      zone: editingIncident.zone || "",
      priority: editingIncident.priority || "alta",
      status: editingIncident.status || "abierto",
    }));

    const prevPhotos = extractPhotos(editingIncident);
    const prevVideos = extractVideos(editingIncident);
    const prevAudios = extractAudios(editingIncident);

    setMedia([
      ...prevPhotos.map((src) => ({ type: "image", src })),
      ...prevVideos.map((src) => ({ type: "video", src })),
      ...prevAudios.map((src) => ({ type: "audio", src })),
    ]);
  }, [editingIncident]);

  const handleChange = (e) =>
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));

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

    const base64 = await fileToBase64(file);
    const isVideo = file.type?.startsWith("video/");
    const isAudio = file.type?.startsWith("audio/");

    const item = {
      type: isVideo ? "video" : isAudio ? "audio" : "image",
      src: base64,
    };

    setMedia((prev) => [...prev, item]);
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
    lastInsertedRef.current = "";
    sttReset();
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

      const guard = guards.find(
        (g) => String(g.opId) === String(form.reportedByGuardId)
      );
      const label = guard ? getGuardLabel(guard) : form.reportedBy;

      const photosBase64 = media.filter((m) => m.type === "image").map((m) => m.src);
      const videosBase64 = media.filter((m) => m.type === "video").map((m) => m.src);
      const audiosBase64 = media.filter((m) => m.type === "audio").map((m) => m.src);

      const payload = {
        ...form,
        reportedBy: label,
        guardId: form.reportedByGuardId || undefined,
        guardName: guard?.name || undefined,
        guardEmail: guard?.email || undefined,
        photosBase64,
        videosBase64,
        audiosBase64,
        ...(origin ? { origin } : {}),
        ...extraData,
      };

      if (editingIncident?._id) {
        await api.put(`/incidentes/${editingIncident._id}`, payload, {
          headers: { "Content-Type": "application/json", Accept: "application/json" },
        });
      } else {
        await api.post("/incidentes", payload, {
          headers: { "Content-Type": "application/json", Accept: "application/json" },
        });
      }

      if (finalStayOnFinish) resetForm();
      else nav("/incidentes/lista");
    } catch (err) {
      console.error(err);
      const msg =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        err?.message ||
        "Error al guardar el incidente";
      alert(msg);
    } finally {
      setSending(false);
    }
  };

  const handleCancel = () => {
    if (onCancel) return onCancel();
    if (finalStayOnFinish) resetForm();
    else nav("/incidentes/lista");
  };

  return (
    <div className="min-h-screen px-4 py-6 md:p-8 max-w-[1100px] mx-auto space-y-6 transition-colors">
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

          {/* Descripción + dictado */}
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
                      onClick={() => {
                        sttReset();
                        lastInsertedRef.current = "";
                      }}
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
              onChange={handleChange}
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

          {/* Reportado / Zona */}
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
                Adjunta evidencias desde archivos o graba en tiempo real.
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
                    className="relative w-24 h-24 rounded-lg overflow-hidden border border-cyan-400/25 bg-black/40"
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
                      <audio src={item.src} controls className="w-full h-full" />
                    )}

                    <button
                      type="button"
                      onClick={() =>
                        setMedia((prev) => prev.filter((_, i) => i !== idx))
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
