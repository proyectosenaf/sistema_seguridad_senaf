// client/src/modules/incidentes/IncidenteForm.jsx
import React, { useState, useRef, useEffect } from "react";
import { useLocation, useNavigate, Link } from "react-router-dom";
import CameraCapture from "../../components/CameraCapture.jsx";
import VideoRecorder from "../../components/VideoRecorder.jsx";
import AudioRecorder from "../../components/AudioRecorder.jsx";
import api from "../../lib/api.js";
import iamApi from "../../iam/api/iamApi.js";

// ✅ Dictado por voz
import useSpeechToText from "../../iam/hooks/useSpeechToText";

const USER_KEY = "senaf_user";

function safeJSONParse(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function readLocalUser() {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return safeJSONParse(raw);
  } catch {
    return null;
  }
}

function normRole(x) {
  return String(x || "").trim().toLowerCase();
}

function extractRoles(u) {
  const roles = Array.isArray(u?.roles) ? u.roles : u?.roles ? [u.roles] : [];
  const NS = "https://senaf.local/roles";
  const nsRoles = Array.isArray(u?.[NS]) ? u[NS] : [];
  return [...roles, ...nsRoles].map(normRole).filter(Boolean);
}

function normalizeMediaType(kind) {
  if (kind === "photo" || kind === "image") return "image";
  if (kind === "video") return "video";
  if (kind === "audio") return "audio";
  return "image";
}

function normalizeEvidenceKind(type) {
  if (type === "image") return "photo";
  if (type === "video") return "video";
  if (type === "audio") return "audio";
  return "photo";
}

function normalizeIncidentMedia(inc) {
  if (!inc || typeof inc !== "object") return [];

  // ✅ Nuevo formato normalizado
  if (Array.isArray(inc.evidences) && inc.evidences.length > 0) {
    return inc.evidences
      .filter(Boolean)
      .map((e) => {
        const src = e?.url || e?.src || e?.base64 || e?.path || "";
        if (!src) return null;

        return {
          type: normalizeMediaType(e?.kind),
          src,
        };
      })
      .filter(Boolean);
  }

  // ✅ Compatibilidad legacy
  const photos = [
    ...(Array.isArray(inc.photosBase64) ? inc.photosBase64 : []),
    ...(Array.isArray(inc.photos) ? inc.photos : []),
  ];

  const videos = [
    ...(Array.isArray(inc.videosBase64) ? inc.videosBase64 : []),
    ...(Array.isArray(inc.videos) ? inc.videos : []),
  ];

  const audios = [
    ...(Array.isArray(inc.audiosBase64) ? inc.audiosBase64 : []),
    ...(Array.isArray(inc.audios) ? inc.audios : []),
  ];

  return [
    ...photos.filter(Boolean).map((src) => ({ type: "image", src })),
    ...videos.filter(Boolean).map((src) => ({ type: "video", src })),
    ...audios.filter(Boolean).map((src) => ({ type: "audio", src })),
  ];
}

/* =========================
   UI styles
========================= */
const UI = {
  page: "min-h-screen max-w-[1100px] mx-auto space-y-6 px-4 py-6 md:p-8 transition-colors layer-content",
  shell: "rounded-[24px] p-6 md:p-8 transition-all",
  title: "text-2xl font-semibold mb-6",
  label: "block mb-2 font-medium text-sm",
  input: "w-full rounded-[14px] px-3 py-2 text-sm outline-none transition",
  select: "w-full rounded-[14px] px-3 py-2 text-sm outline-none transition",
  textarea: "w-full rounded-[14px] px-3 py-2 text-sm outline-none transition min-h-[110px] resize-none",
  btn: "inline-flex items-center justify-center rounded-[14px] px-4 py-2 text-sm font-medium transition-all duration-150",
  btnSm: "inline-flex items-center justify-center rounded-[12px] px-3 py-1.5 text-xs font-semibold transition-all duration-150",
};

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

function sxDangerBtn(extra = {}) {
  return {
    background: "linear-gradient(135deg, #dc2626, #ef4444)",
    color: "#fff",
    border: "1px solid transparent",
    boxShadow: "0 10px 20px color-mix(in srgb, #dc2626 22%, transparent)",
    ...extra,
  };
}

function sxInfoBtn(extra = {}) {
  return {
    background: "linear-gradient(135deg, #0891b2, #06b6d4)",
    color: "#fff",
    border: "1px solid transparent",
    boxShadow: "0 10px 20px color-mix(in srgb, #0891b2 22%, transparent)",
    ...extra,
  };
}

function sxPurpleBtn(extra = {}) {
  return {
    background: "linear-gradient(135deg, #7c3aed, #ec4899)",
    color: "#fff",
    border: "1px solid transparent",
    boxShadow: "0 10px 20px color-mix(in srgb, #ec4899 22%, transparent)",
    ...extra,
  };
}

function sxOrangeBtn(extra = {}) {
  return {
    background: "linear-gradient(135deg, #d97706, #f97316)",
    color: "#fff",
    border: "1px solid transparent",
    boxShadow: "0 10px 20px color-mix(in srgb, #f59e0b 22%, transparent)",
    ...extra,
  };
}

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

  // media = [{ type: "image"|"video"|"audio", src: dataUrl|url }]
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

  const lastInsertedRef = useRef("");

  function normalizeSpeechText(t) {
    return String(t || "").replace(/\s+/g, " ").trim();
  }

  function appendTranscriptToDescription(forceText) {
    const raw = forceText != null ? forceText : sttTranscript;
    const t = normalizeSpeechText(raw);
    if (!t) return;

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

  /* ================== helpers guardias ================== */
  function getGuardLabel(g) {
    if (!g) return "";
    return g.email
      ? `${g.name || "(Sin nombre)"} — ${g.email}`
      : g.name || "(Sin nombre)";
  }

  function normalizeGuards(items) {
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

    const seen = new Set();
    return normalized.filter((g) => {
      const k = String(g.opId || g.email || g._id || "");
      if (!k) return true;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  }

  // ✅ Cargar guardias
  useEffect(() => {
    let mounted = true;

    (async () => {
      setLoadingGuards(true);

      try {
        let items = [];

        if (typeof iamApi.listGuardsPicker === "function") {
          const r = await iamApi.listGuardsPicker("", true);
          items = Array.isArray(r?.items) ? r.items : [];
        } else if (typeof iamApi.listGuards === "function") {
          const r = await iamApi.listGuards("", true, undefined);
          items = r?.items || r?.guards || r?.users || [];
        } else if (typeof iamApi.listUsers === "function") {
          const r = await iamApi.listUsers("");
          const raw = Array.isArray(r?.items) ? r.items : [];
          items = raw.filter((u) => {
            const roles = extractRoles(u);
            return (
              roles.includes("guardia") ||
              roles.includes("guard") ||
              roles.includes("rondasqr.guard")
            );
          });
        } else {
          throw new Error(
            "No hay método para listar guardias en iamApi (picker/listGuards/listUsers)."
          );
        }

        const normalized = normalizeGuards(items);

        if (!mounted) return;
        setGuards(normalized);

        if (fromQueryIsRonda) {
          const lu = readLocalUser();
          const myEmail = String(lu?.email || "").trim().toLowerCase();
          const myId = String(lu?._id || lu?.id || "").trim();

          const meMatch =
            (myEmail &&
              normalized.find(
                (g) => String(g.email || "").toLowerCase() === myEmail
              )) ||
            (myId &&
              normalized.find(
                (g) => String(g._id || g.opId || "") === myId
              )) ||
            null;

          if (meMatch) {
            setForm((prev) => ({
              ...prev,
              reportedByGuardId: String(meMatch.opId),
              reportedBy: getGuardLabel(meMatch),
            }));
          }
        }
      } catch (e) {
        console.warn("[IncidenteForm] load guards error:", e);
        if (mounted) setGuards([]);
      } finally {
        if (mounted) setLoadingGuards(false);
      }
    })();

    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ✅ Modo edición: cargar campos + media normalizada
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

    setMedia(normalizeIncidentMedia(editingIncident));
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

    setMedia((prev) => [
      ...prev,
      { type: isVideo ? "video" : isAudio ? "audio" : "image", src: base64 },
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

    if (!form.description.trim()) return alert("Describa el incidente.");
    if (!form.reportedByGuardId) {
      return alert("Seleccione el guardia que reporta el incidente.");
    }

    try {
      setSending(true);

      const guard = guards.find(
        (g) => String(g.opId) === String(form.reportedByGuardId)
      );
      const label = guard ? getGuardLabel(guard) : form.reportedBy;

      // ✅ Compatibilidad actual
      const photosBase64 = media
        .filter((m) => m.type === "image")
        .map((m) => m.src);

      const videosBase64 = media
        .filter((m) => m.type === "video")
        .map((m) => m.src);

      const audiosBase64 = media
        .filter((m) => m.type === "audio")
        .map((m) => m.src);

      // ✅ Nuevo formato normalizado
      const evidences = media.map((m) => ({
        kind: normalizeEvidenceKind(m.type),
        url: m.src,
        base64: m.src,
      }));

      const payload = {
        ...form,
        reportedBy: label,
        guardId: form.reportedByGuardId || undefined,
        guardName: guard?.name || undefined,
        guardEmail: guard?.email || undefined,

        // Legacy
        photosBase64,
        videosBase64,
        audiosBase64,

        // Nuevo
        evidences,

        ...(origin ? { origin } : {}),
        ...extraData,
      };

      if (editingIncident?._id) {
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
    <div className={UI.page}>
      {!finalStayOnFinish && (
        <div
          className="text-xs flex flex-wrap items-center gap-2"
          style={{ color: "var(--text-muted)" }}
        >
          <Link
            to="/"
            className="hover:underline underline-offset-4"
            style={{ color: "var(--text-muted)" }}
          >
            Panel principal
          </Link>
          <span style={{ color: "var(--text-muted)" }}>/</span>
          <Link
            to="/incidentes/lista"
            className="hover:underline underline-offset-4"
            style={{ color: "var(--text-muted)" }}
          >
            Gestión de Incidentes
          </Link>
          <span style={{ color: "var(--text-muted)" }}>/</span>
          <span style={{ color: "var(--text)" }}>
            {editing ? "Editar incidente" : "Reportar Incidente"}
          </span>
        </div>
      )}

      <div className={UI.shell} style={sxCard()}>
        <h2 className={UI.title} style={{ color: "var(--text)" }}>
          {editing ? "Editar incidente" : "Reportar Nuevo Incidente"}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-6 text-sm">
          <div>
            <label className={UI.label} style={{ color: "var(--text-muted)" }}>
              Tipo de Incidente
            </label>
            <select
              name="type"
              value={form.type}
              onChange={handleChange}
              className={UI.select}
              style={sxInput()}
            >
              <option>Acceso no autorizado</option>
              <option>Falla técnica</option>
              <option>Objeto perdido</option>
              <option>Otro</option>
            </select>
          </div>

          <div>
            <div className="flex items-center justify-between gap-3 mb-2 flex-wrap">
              <label className={UI.label} style={{ color: "var(--text-muted)", marginBottom: 0 }}>
                Descripción del Incidente
              </label>

              <div className="flex flex-wrap items-center gap-2">
                {!sttSupported ? (
                  <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                    🎙️ Dictado no disponible en este navegador
                  </span>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={sttListening ? stopAndInsert : sttStart}
                      className={UI.btnSm}
                      style={sttListening ? sxDangerBtn() : sxGhostBtn()}
                      title="Iniciar / detener dictado"
                    >
                      {sttListening ? "⏹ Detener" : "🎙 Grabar"}
                    </button>

                    <button
                      type="button"
                      onClick={() => appendTranscriptToDescription()}
                      disabled={!String(sttTranscript || "").trim()}
                      className={UI.btnSm}
                      style={
                        !String(sttTranscript || "").trim()
                          ? { ...sxGhostBtn(), opacity: 0.5, cursor: "not-allowed" }
                          : sxSuccessBtn()
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
                      className={UI.btnSm}
                      style={sxGhostBtn()}
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
              className={UI.textarea}
              style={sxInput()}
              placeholder="Describa detalladamente lo ocurrido..."
              required
            />

            {sttSupported && (sttError || sttTranscript) ? (
              <div className="mt-2 rounded-[14px] p-3" style={sxCardSoft()}>
                {sttError ? (
                  <div className="text-xs" style={{ color: "#fb7185" }}>
                    ⚠️ {sttError}
                  </div>
                ) : null}
                {sttTranscript ? (
                  <div
                    className="mt-1 text-xs whitespace-pre-wrap"
                    style={{ color: "var(--text)" }}
                  >
                    <span style={{ color: "var(--text-muted)" }}>Dictado:</span>{" "}
                    {sttTranscript}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={UI.label} style={{ color: "var(--text-muted)" }}>
                Reportado por
              </label>
              <select
                name="reportedByGuardId"
                value={form.reportedByGuardId}
                onChange={handleReporterChange}
                className={UI.select}
                style={sxInput()}
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
              <label className={UI.label} style={{ color: "var(--text-muted)" }}>
                Zona / Ubicación
              </label>
              <input
                name="zone"
                value={form.zone}
                onChange={handleChange}
                className={UI.input}
                style={sxInput()}
                placeholder="Ej. Entrada Principal / Comayagua / Sala Juntas A"
                required
              />
            </div>
          </div>

          <div>
            <label className={UI.label} style={{ color: "var(--text-muted)" }}>
              Prioridad
            </label>
            <select
              name="priority"
              value={form.priority}
              onChange={handleChange}
              className={UI.select}
              style={sxInput()}
            >
              <option value="alta">Alta</option>
              <option value="media">Media</option>
              <option value="baja">Baja</option>
            </select>
          </div>

          <div className="space-y-2">
            <label className={UI.label} style={{ color: "var(--text-muted)" }}>
              Evidencias (fotos / videos / audio)
            </label>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className={UI.btn}
                style={sxInfoBtn()}
              >
                📁 Seleccionar archivo
              </button>

              <button
                type="button"
                onClick={() => setShowCamera(true)}
                className={UI.btn}
                style={sxPrimaryBtn()}
              >
                📷 Tomar foto
              </button>

              <button
                type="button"
                onClick={() => setShowVideoRecorder(true)}
                className={UI.btn}
                style={sxPurpleBtn()}
              >
                🎥 Grabar video
              </button>

              <button
                type="button"
                onClick={() => setShowAudioRecorder(true)}
                className={UI.btn}
                style={sxOrangeBtn()}
              >
                🎙️ Grabar audio
              </button>

              <p
                className="text-xs self-center"
                style={{ color: "var(--text-muted)" }}
              >
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
                    className="relative w-24 h-24 rounded-[14px] overflow-hidden"
                    style={sxCardSoft({
                      background: "color-mix(in srgb, var(--card-solid) 70%, transparent)",
                    })}
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
                      className="absolute top-1 right-1 text-xs rounded-full w-5 h-5 flex items-center justify-center"
                      style={{
                        background: "rgba(2,6,23,.72)",
                        color: "#fff",
                        border: "1px solid rgba(255,255,255,.12)",
                      }}
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
              className={UI.btn}
              style={sxGhostBtn()}
            >
              Cancelar
            </button>

            <button
              type="submit"
              disabled={sending}
              className={UI.btn}
              style={sxSuccessBtn(sending ? { opacity: 0.7 } : {})}
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