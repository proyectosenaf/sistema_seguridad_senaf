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

/* =========================
   Helpers
========================= */
function guardLabel(g) {
  const name = g?.name || "(Sin nombre)";
  return g?.email ? `${name} — ${g.email}` : name;
}

// arma una URL absoluta para evidencias:
// - si viene dataURL (base64) -> devuelve igual
// - si viene "/uploads/..." -> lo pega al host
// - si ya viene "http..." -> devuelve igual
function toAbsoluteMediaUrl(src, apiHost) {
  const s = String(src || "");
  if (!s) return "";
  if (s.startsWith("data:")) return s;
  if (s.startsWith("http://") || s.startsWith("https://")) return s;
  if (s.startsWith("/")) return `${apiHost}${s}`;
  return `${apiHost}/${s}`;
}

// intenta deducir extensión por mime o por url
function guessExtFromSrc(src, fallback = "bin") {
  const s = String(src || "");
  const m = s.match(/^data:([^;]+);base64,/);
  if (m?.[1]) {
    const mime = m[1];
    const map = {
      "image/jpeg": "jpg",
      "image/jpg": "jpg",
      "image/png": "png",
      "image/webp": "webp",
      "image/gif": "gif",
      "video/webm": "webm",
      "video/mp4": "mp4",
      "audio/webm": "webm",
      "audio/mpeg": "mp3",
      "audio/mp3": "mp3",
      "audio/wav": "wav",
      "audio/ogg": "ogg",
    };
    return map[mime] || mime.split("/")[1] || fallback;
  }

  try {
    const clean = s.split("?")[0].split("#")[0];
    const ext = clean.split(".").pop();
    if (ext && ext.length <= 6 && ext !== clean) return ext;
  } catch (_) {}
  return fallback;
}

function dataUrlToBlob(dataUrl) {
  const [meta, b64] = String(dataUrl).split(",");
  const mime =
    meta?.match(/^data:([^;]+);base64$/)?.[1] || "application/octet-stream";
  const bin = atob(b64 || "");
  const len = bin.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

// descarga:
// - si es dataURL -> convierte a Blob y baja
// - si es URL http/https -> usa <a download> y abre en nueva pestaña si el server no manda headers
async function downloadMedia({ url, rawSrc, filename }) {
  try {
    const src = String(rawSrc || url || "");
    const name = filename || `evidencia_${Date.now()}`;

    if (src.startsWith("data:")) {
      const blob = dataUrlToBlob(src);
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
      return;
    }

    const a = document.createElement("a");
    a.href = url || src;
    a.download = name;
    a.target = "_blank";
    a.rel = "noreferrer";
    document.body.appendChild(a);
    a.click();
    a.remove();
  } catch (e) {
    console.warn("downloadMedia error:", e);
    alert(
      "No se pudo descargar. Intenta 'Abrir' y luego descargar desde el navegador."
    );
  }
}

function safeLower(v) {
  return String(v || "").toLowerCase().trim();
}

function normalizeStatus(s) {
  const v = safeLower(s);
  if (v === "en proceso") return "en_proceso";
  return v;
}

function formatStatus(s) {
  if (s === "en_proceso") return "En proceso";
  if (s === "resuelto") return "Resuelto";
  return "Abierto";
}

function getIncidentDate(inc) {
  return inc?.date || inc?.createdAt || null;
}

function parseDateValue(d) {
  const t = new Date(d).getTime();
  return Number.isNaN(t) ? null : t;
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

  // ========= API_HOST (solo host, sin /api/...) =========
  const API_HOST = useMemo(() => {
    const raw = String(API || "").trim();
    if (!raw) return "";
    const idx = raw.indexOf("/api");
    return idx >= 0 ? raw.slice(0, idx) : raw.replace(/\/$/, "");
  }, []);

  // 👇 catálogo de guardias (IAM)
  const [guards, setGuards] = useState([]);

  // ======= filtros (UI) =======
  const [q, setQ] = useState("");
  const [fStatus, setFStatus] = useState("all"); // abierto | en_proceso | resuelto | all
  const [fPriority, setFPriority] = useState("all"); // alta | media | baja | all
  const [dateFrom, setDateFrom] = useState(""); // YYYY-MM-DD
  const [dateTo, setDateTo] = useState(""); // YYYY-MM-DD

  function clearFilters() {
    setQ("");
    setFStatus("all");
    setFPriority("all");
    setDateFrom("");
    setDateTo("");
  }

  // ======= modal evidencias (galería + viewer grande) =======
  const [evidenceOpen, setEvidenceOpen] = useState(false);
  const [evidenceItems, setEvidenceItems] = useState([]); // [{type, src, url}]
  const [evidenceTitle, setEvidenceTitle] = useState("");
  const [activeEvidenceIdx, setActiveEvidenceIdx] = useState(0);

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

  function openEvidence(inc) {
    const photos = extractPhotos(inc);
    const videos = extractVideos(inc);
    const audios = extractAudios(inc);

    const items = [
      ...photos.map((src) => ({
        type: "image",
        src,
        url: toAbsoluteMediaUrl(src, API_HOST),
      })),
      ...videos.map((src) => ({
        type: "video",
        src,
        url: toAbsoluteMediaUrl(src, API_HOST),
      })),
      ...audios.map((src) => ({
        type: "audio",
        src,
        url: toAbsoluteMediaUrl(src, API_HOST),
      })),
    ];

    setEvidenceItems(items);
    setEvidenceTitle(`${inc?.type || "Incidente"} — ${inc?._id || ""}`);
    setActiveEvidenceIdx(0);
    setEvidenceOpen(true);
  }

  function closeEvidence() {
    setEvidenceOpen(false);
    setEvidenceItems([]);
    setEvidenceTitle("");
    setActiveEvidenceIdx(0);
  }

  function nextEvidence() {
    setActiveEvidenceIdx((prev) =>
      Math.min(prev + 1, evidenceItems.length - 1)
    );
  }
  function prevEvidence() {
    setActiveEvidenceIdx((prev) => Math.max(prev - 1, 0));
  }

  const activeEvidence = evidenceItems[activeEvidenceIdx];

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

  // ───────── cargar guardias desde IAM ─────────
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
            console.warn("[IncidentesList] no token IAM:", e?.message || e);
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
      const msg =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        err?.message ||
        "No se pudo actualizar el estado";
      alert(msg);
    }
  };

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

    if (!form.description.trim()) return alert("Describa el incidente.");
    if (!form.reportedByGuardId)
      return alert("Seleccione el guardia que reporta el incidente.");

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
        status: normalizeStatus(form.status),
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
      const msg =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        err?.message ||
        "No se pudo guardar el incidente";
      alert(msg);
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
    if (!incidente?._id) return;

    setShowForm(true);
    setEditingId(incidente._id);
    clearDictation();

    const guardId =
      incidente.guardId || incidente.opId || incidente.reportedByGuardId || "";
    const reportedByLabel = incidente.reportedBy || "";

    setForm({
      type: incidente.type || "Acceso no autorizado",
      description: incidente.description || "",
      reportedBy: reportedByLabel,
      reportedByGuardId: guardId,
      zone: incidente.zone || "",
      priority: incidente.priority || "alta",
      status: normalizeStatus(incidente.status || "abierto"),
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
      const msg =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        err?.message ||
        "No se pudo eliminar el incidente";
      alert(msg);
    }
  };

  /* =========================
     Filtro completo + fecha
  ========================== */
  const filtered = useMemo(() => {
    const text = safeLower(q);

    const fromTs = dateFrom ? parseDateValue(dateFrom + "T00:00:00") : null;
    const toTs = dateTo ? parseDateValue(dateTo + "T23:59:59") : null;

    return (incidentes || []).filter((i) => {
      // status
      if (fStatus !== "all" && normalizeStatus(i.status) !== fStatus) return false;

      // priority
      if (fPriority !== "all" && safeLower(i.priority) !== fPriority) return false;

      // date range
      const d = getIncidentDate(i);
      const t = d ? parseDateValue(d) : null;
      if (fromTs != null && t != null && t < fromTs) return false;
      if (toTs != null && t != null && t > toTs) return false;
      // si no tiene fecha, lo dejamos pasar (o cámbialo a false si quieres excluirlos)

      // text search
      if (!text) return true;

      const haystack = [
        i.type,
        i.description,
        i.zone,
        i.reportedBy,
        i.guardName,
        i.guardEmail,
        i.status,
        i.priority,
      ]
        .map(safeLower)
        .join(" | ");

      return haystack.includes(text);
    });
  }, [incidentes, q, fStatus, fPriority, dateFrom, dateTo]);

  /* =========================
     Exportadores (lo filtrado)
  ========================== */
  const handleExportPDF = () => {
    if (!filtered.length) return alert("No hay incidentes (filtrados) para exportar.");

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

    const rows = filtered.map((i, idx) => {
      const fecha = getIncidentDate(i)
        ? new Date(getIncidentDate(i)).toLocaleString()
        : "";
      return [
        idx + 1,
        i.type || "",
        i.description || "",
        i.reportedBy || "",
        i.zone || "",
        fecha,
        i.priority || "",
        formatStatus(normalizeStatus(i.status)),
      ];
    });

    doc.setFontSize(14);
    doc.text("Reporte de Incidentes", 40, 30);

    // autotable seguro
    if (typeof doc.autoTable !== "function") {
      alert("autoTable no está disponible. Revisa la importación de jspdf-autotable.");
      return;
    }

    doc.autoTable({
      head: [columns],
      body: rows,
      startY: 50,
      styles: { fontSize: 8, cellPadding: 4 },
      headStyles: { fillColor: [15, 27, 45] },
    });

    doc.save("incidentes_filtrados.pdf");
  };

  const handleExportExcel = () => {
    if (!filtered.length) return alert("No hay incidentes (filtrados) para exportar.");

    const data = filtered.map((i, idx) => {
      const fecha = getIncidentDate(i)
        ? new Date(getIncidentDate(i)).toLocaleString()
        : "";

      return {
        "#": idx + 1,
        Tipo: i.type || "",
        Descripción: i.description || "",
        "Reportado por": i.reportedBy || "",
        Zona: i.zone || "",
        Fecha: fecha,
        Prioridad: i.priority || "",
        Estado: formatStatus(normalizeStatus(i.status)),
      };
    });

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Incidentes");
    XLSX.writeFile(wb, "incidentes_filtrados.xlsx");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#001a12] via-[#00172a] to-[#000000] text-white p-6 max-w-[1400px] mx-auto space-y-8">
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-white">Gestión de Incidentes</h1>
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
          {showForm ? "Cerrar formulario" : "+ Reportar Incidente"}
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

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

              <div>
                <label className="block mb-2 text-gray-700 dark:text-white/80 font-medium">
                  Estado
                </label>
                <select
                  name="status"
                  value={form.status}
                  onChange={handleFormChange}
                  className="w-full bg-gray-100 dark:bg-black/20 text-gray-800 dark:text-white border border-gray-300 dark:border-white/10 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-cyan-400/60"
                >
                  <option value="abierto">Abierto</option>
                  <option value="en_proceso">En proceso</option>
                  <option value="resuelto">Resuelto</option>
                </select>
              </div>
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
                        (item.type === "audio"
                          ? "w-72 h-12 p-2 flex items-center"
                          : "w-28 h-28")
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
          <div className="text-3xl font-semibold text-red-400">{stats.abiertos}</div>
        </div>

        <div className="rounded-lg bg-[#0f1b2d] border border-blue-400/40 p-4">
          <div className="text-xs uppercase text-blue-300 font-medium flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-blue-500" />
            En Proceso
          </div>
          <div className="text-3xl font-semibold text-blue-400">{stats.enProceso}</div>
        </div>

        <div className="rounded-lg bg-[#0f1b2d] border border-green-400/40 p-4">
          <div className="text-xs uppercase text-green-300 font-medium flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-500" />
            Resueltos
          </div>
          <div className="text-3xl font-semibold text-green-400">{stats.resueltos}</div>
        </div>

        <div className="rounded-lg bg-[#0f1b2d] border border-yellow-400/40 p-4">
          <div className="text-xs uppercase text-yellow-300 font-medium flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-yellow-400" />
            Alta prioridad
          </div>
          <div className="text-3xl font-semibold text-yellow-300">{stats.alta}</div>
        </div>
      </div>

      {/* ----- tabla ----- */}
      <div className="bg-white/5 border border-purple-500/40 rounded-2xl shadow-[0_0_30px_rgba(168,85,247,0.45)] overflow-hidden backdrop-blur-md">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center p-4 border-b border-white/10 gap-3 bg-black/10">
          <div>
            <h2 className="font-semibold text-lg text-white">Lista de Incidentes</h2>
            <p className="text-xs text-gray-300">
              Historial de reportes registrados en el sistema
            </p>
          </div>

          <div className="w-full lg:w-[620px] flex flex-col gap-2">
            <input
              className="w-full bg-black/30 text-white text-sm rounded-md px-3 py-2 
                         border border-purple-400/40 placeholder-gray-500 
                         focus:outline-none focus:ring-2 focus:ring-purple-400/60 
                         transition-all duration-200"
              placeholder="Buscar (tipo, descripción, zona, reportado por, estado, prioridad...)"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />

            <div className="flex flex-wrap gap-2 items-center justify-end">
              <select
                value={fStatus}
                onChange={(e) => setFStatus(e.target.value)}
                className="bg-black/30 text-white text-xs rounded-md px-3 py-2 border border-purple-400/40"
                title="Estado"
              >
                <option value="all">Estado: Todos</option>
                <option value="abierto">Abierto</option>
                <option value="en_proceso">En proceso</option>
                <option value="resuelto">Resuelto</option>
              </select>

              <select
                value={fPriority}
                onChange={(e) => setFPriority(e.target.value)}
                className="bg-black/30 text-white text-xs rounded-md px-3 py-2 border border-purple-400/40"
                title="Prioridad"
              >
                <option value="all">Prioridad: Todas</option>
                <option value="alta">Alta</option>
                <option value="media">Media</option>
                <option value="baja">Baja</option>
              </select>

              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="bg-black/30 text-white text-xs rounded-md px-3 py-2 border border-purple-400/40"
                title="Desde"
              />

              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="bg-black/30 text-white text-xs rounded-md px-3 py-2 border border-purple-400/40"
                title="Hasta"
              />

              <button
                type="button"
                onClick={clearFilters}
                className="text-xs bg-white/10 hover:bg-white/15 text-white font-medium rounded px-3 py-2 transition-all duration-200 border border-white/10"
              >
                Limpiar
              </button>

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

            <div className="text-[11px] text-white/50 text-right">
              Mostrando <span className="text-white/80 font-semibold">{filtered.length}</span> de{" "}
              <span className="text-white/80 font-semibold">{incidentes.length}</span>
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
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center text-gray-400 py-10 text-sm">
                    No hay incidentes con los filtros actuales.
                  </td>
                </tr>
              ) : (
                filtered.map((i) => {
                  const photos = extractPhotos(i);
                  const videos = extractVideos(i);
                  const audios = extractAudios(i);
                  const total = photos.length + videos.length + audios.length;

                  const d = getIncidentDate(i);
                  const fecha = d ? new Date(d).toLocaleString() : "—";

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
                        {fecha}
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
                            (normalizeStatus(i.status) === "resuelto"
                              ? "bg-green-600/20 text-green-300 border border-green-400/60"
                              : normalizeStatus(i.status) === "en_proceso"
                              ? "bg-blue-600/20 text-blue-300 border border-blue-400/60"
                              : "bg-red-600/20 text-red-300 border border-red-400/60")
                          }
                        >
                          {formatStatus(normalizeStatus(i.status))}
                        </span>
                      </td>

                      <td className="px-4 py-3">
                        {total ? (
                          <button
                            type="button"
                            onClick={() => openEvidence(i)}
                            className="inline-flex items-center gap-2 text-xs text-cyan-200 hover:text-cyan-100 underline underline-offset-4"
                            title="Ver evidencias"
                          >
                            {photos.length ? <span>📷 {photos.length}</span> : null}
                            {videos.length ? <span>🎥 {videos.length}</span> : null}
                            {audios.length ? <span>🎙️ {audios.length}</span> : null}
                          </button>
                        ) : (
                          <span className="text-xs text-gray-500">—</span>
                        )}
                      </td>

                      <td className="px-4 py-3 text-right whitespace-nowrap space-x-2">
                        {normalizeStatus(i.status) === "abierto" && (
                          <button
                            onClick={() => actualizarEstado(i._id, "en_proceso")}
                            className="text-[11px] bg-blue-600 hover:bg-blue-700 text-white rounded px-3 py-1 transition-all duration-300"
                          >
                            Procesar
                          </button>
                        )}

                        {normalizeStatus(i.status) === "en_proceso" && (
                          <button
                            onClick={() => actualizarEstado(i._id, "resuelto")}
                            className="text-[11px] bg-green-600 hover:bg-green-700 text-white rounded px-3 py-1 transition-all duration-300"
                          >
                            Resolver
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => startEdit(i)}
                          className="text-[11px] bg-indigo-600 hover:bg-indigo-700 text-white rounded px-3 py-1 transition-all duration-300"
                        >
                          Editar
                        </button>

                        <button
                          type="button"
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

      {/* ===== Modal evidencias: Viewer grande + miniaturas + descargar ===== */}
      {evidenceOpen && (
        <div
          className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={closeEvidence}
        >
          <div
            className="w-full max-w-6xl rounded-2xl border border-white/10 bg-[#07111f]/95 shadow-[0_0_80px_rgba(0,0,0,0.7)] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* header */}
            <div className="p-4 border-b border-white/10 flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-white">Evidencias</div>
                <div className="text-xs text-white/60">{evidenceTitle}</div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={!activeEvidence || activeEvidenceIdx === 0}
                  onClick={prevEvidence}
                  className={
                    "px-3 py-1.5 rounded-lg text-xs font-semibold border " +
                    (activeEvidenceIdx === 0
                      ? "opacity-50 bg-white/5 border-white/10 text-white/60"
                      : "bg-white/10 hover:bg-white/15 border-white/10 text-white")
                  }
                >
                  ◀ Anterior
                </button>

                <button
                  type="button"
                  disabled={
                    !activeEvidence || activeEvidenceIdx === evidenceItems.length - 1
                  }
                  onClick={nextEvidence}
                  className={
                    "px-3 py-1.5 rounded-lg text-xs font-semibold border " +
                    (activeEvidenceIdx === evidenceItems.length - 1
                      ? "opacity-50 bg-white/5 border-white/10 text-white/60"
                      : "bg-white/10 hover:bg-white/15 border-white/10 text-white")
                  }
                >
                  Siguiente ▶
                </button>

                <button
                  type="button"
                  onClick={closeEvidence}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-rose-600/80 hover:bg-rose-600 border border-rose-400/30 text-white"
                >
                  Cerrar ✕
                </button>
              </div>
            </div>

            {/* content */}
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-0">
              {/* viewer grande */}
              <div className="p-4">
                {!activeEvidence ? (
                  <div className="text-white/60 text-sm">No hay evidencias.</div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-xs text-white/60">
                        {activeEvidence.type.toUpperCase()} #{activeEvidenceIdx + 1} de{" "}
                        {evidenceItems.length}
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            window.open(activeEvidence.url, "_blank", "noreferrer")
                          }
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white/10 hover:bg-white/15 border border-white/10 text-white"
                        >
                          Abrir ↗
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            const ext = guessExtFromSrc(
                              activeEvidence.src,
                              activeEvidence.type === "image"
                                ? "png"
                                : activeEvidence.type === "video"
                                ? "webm"
                                : "webm"
                            );
                            const filename = `evidencia_${activeEvidence.type}_${
                              activeEvidenceIdx + 1
                            }.${ext}`;
                            downloadMedia({
                              url: activeEvidence.url,
                              rawSrc: activeEvidence.src,
                              filename,
                            });
                          }}
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600/80 hover:bg-emerald-600 border border-emerald-400/30 text-white"
                        >
                          Descargar ⬇
                        </button>
                      </div>
                    </div>

                    <div className="rounded-xl border border-white/10 bg-black/40 overflow-hidden">
                      {activeEvidence.type === "image" ? (
                        <img
                          src={activeEvidence.url}
                          alt="evidencia"
                          className="w-full h-[70vh] object-contain bg-black/60"
                        />
                      ) : activeEvidence.type === "video" ? (
                        <video
                          src={activeEvidence.url}
                          controls
                          className="w-full h-[70vh] object-contain bg-black/60"
                        />
                      ) : (
                        <div className="p-4">
                          <audio src={activeEvidence.url} controls className="w-full" />
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* sidebar miniaturas */}
              <div className="border-l border-white/10 bg-black/20 p-3">
                <div className="text-xs text-white/70 mb-2">Miniaturas</div>
                <div className="space-y-2 max-h-[78vh] overflow-auto pr-1">
                  {evidenceItems.map((m, idx) => {
                    const active = idx === activeEvidenceIdx;
                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setActiveEvidenceIdx(idx)}
                        className={
                          "w-full text-left rounded-xl border p-2 transition " +
                          (active
                            ? "border-cyan-400/60 bg-cyan-400/10"
                            : "border-white/10 bg-white/5 hover:bg-white/10")
                        }
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-16 h-12 rounded-lg overflow-hidden bg-black/40 border border-white/10 flex items-center justify-center">
                            {m.type === "image" ? (
                              <img src={m.url} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <div className="text-lg">{m.type === "video" ? "🎥" : "🎙️"}</div>
                            )}
                          </div>

                          <div className="min-w-0">
                            <div className="text-xs font-semibold text-white">
                              {m.type.toUpperCase()} #{idx + 1}
                            </div>
                            <div className="text-[11px] text-white/60 truncate">
                              {String(m.src || "").startsWith("data:")
                                ? "Capturado (base64)"
                                : m.url}
                            </div>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

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
