import React, { useState, useRef, useEffect, useMemo } from "react";
import { useLocation, useNavigate, Link } from "react-router-dom";
import { Mic, MicOff, PencilLine } from "lucide-react";
import CameraCapture from "../../components/CameraCapture.jsx";
import VideoRecorder from "../../components/VideoRecorder.jsx";
import AudioRecorder from "../../components/AudioRecorder.jsx";
import api from "../../lib/api.js";
import iamApi from "../../iam/api/iamApi.js";

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

function norm(value) {
  return String(value || "").trim().toLowerCase();
}

const LEGACY_PERMISSION_ALIASES = {
  "incidentes.read": "incidentes.records.read",
  "incidentes.create": "incidentes.records.write",
  "incidentes.edit": "incidentes.records.write",
  "incidentes.delete": "incidentes.records.delete",
  "incidentes.close": "incidentes.records.close",
  "incidentes.attach": "incidentes.evidences.write",
  "incidentes.reports": "incidentes.reports.read",
  "incidentes.export": "incidentes.reports.export",

  "rondasqr.view": "rondasqr.rounds.read",
  "rondasqr.create": "rondasqr.assignments.write",
  "rondasqr.edit": "rondasqr.assignments.write",
  "rondasqr.delete": "rondasqr.assignments.delete",
  "rondasqr.export": "rondasqr.reports.export",
  "rondasqr.reports": "rondasqr.reports.read",
  "rondasqr.scan.qr": "rondasqr.scan.execute",
  "rondasqr.panic.send": "rondasqr.panic.write",

  "visitas.read": "visitas.records.read",
  "visitas.write": "visitas.records.write",
  "visitas.close": "visitas.records.close",
};

function normalizePermissionKey(key) {
  const k = norm(key);
  if (!k) return "";
  return LEGACY_PERMISSION_ALIASES[k] || k;
}

function extractRoles(u) {
  const roles = Array.isArray(u?.roles) ? u.roles : u?.roles ? [u.roles] : [];
  const NS = "https://senaf.local/roles";
  const nsRoles = Array.isArray(u?.[NS]) ? u[NS] : [];

  return [...roles, ...nsRoles]
    .map((r) => {
      if (typeof r === "string") return norm(r);
      if (r && typeof r === "object") {
        return norm(r.code || r.key || r.slug || r.name || r.nombre);
      }
      return "";
    })
    .filter(Boolean);
}

function extractPermissions(u) {
  const direct = Array.isArray(u?.permissions) ? u.permissions : [];
  const permsField = Array.isArray(u?.perms) ? u.perms : [];

  const rolePerms = Array.isArray(u?.roles)
    ? u.roles.flatMap((r) => {
        if (!r || typeof r !== "object") return [];
        return Array.isArray(r.permissions)
          ? r.permissions
          : Array.isArray(r.perms)
          ? r.perms
          : [];
      })
    : [];

  return [
    ...new Set(
      [...direct, ...permsField, ...rolePerms]
        .map((p) => normalizePermissionKey(p))
        .filter(Boolean)
    ),
  ];
}

function hasPermission(user, ...wanted) {
  const perms = extractPermissions(user);
  if (perms.includes("*")) return true;
  return wanted.map(normalizePermissionKey).some((w) => perms.includes(w));
}

function hasRole(user, ...wanted) {
  const roles = extractRoles(user);
  const normalizedWanted = wanted.map(norm).filter(Boolean);
  return normalizedWanted.some((r) => roles.includes(r));
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

  if (Array.isArray(inc.evidences) && inc.evidences.length > 0) {
    return inc.evidences
      .filter(Boolean)
      .map((e) => {
        const src = e?.base64 || e?.src || e?.url || e?.path || "";
        if (!src) return null;

        return {
          type: normalizeMediaType(e?.kind),
          src,
        };
      })
      .filter(Boolean);
  }

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

const UI = {
  page: "min-h-screen max-w-[1100px] mx-auto space-y-6 px-4 py-6 md:p-8 transition-colors layer-content",
  shell: "rounded-[24px] p-6 md:p-8 transition-all",
  title: "text-2xl font-semibold mb-6",
  label: "block mb-2 font-medium text-sm",
  input: "w-full rounded-[14px] px-3 py-2 text-sm outline-none transition",
  select: "w-full rounded-[14px] px-3 py-2 text-sm outline-none transition",
  textarea:
    "w-full rounded-[14px] px-3 py-2 text-sm outline-none transition min-h-[110px] resize-none",
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

function getGuardLabel(g) {
  if (!g) return "";
  return g.email ? `${g.name || "(Sin nombre)"} — ${g.email}` : g.name || "(Sin nombre)";
}

function buildSelfGuard(user) {
  const id = String(user?._id || user?.id || user?.sub || "").trim();
  const email = String(user?.email || user?.correo || user?.mail || "").trim();
  const name =
    String(
      user?.nombreCompleto ||
        user?.fullName ||
        user?.name ||
        user?.nombre ||
        user?.nickname ||
        ""
    ).trim() || "Guardia";

  return {
    _id: id,
    name,
    email,
    opId: id,
    active: true,
    synthetic: true,
  };
}

function normalizeGuards(items) {
  const normalized = (items || [])
    .filter(Boolean)
    .map((u) => ({
      _id: u._id ? String(u._id) : String(u.id || ""),
      name: u.name || u.nombreCompleto || u.fullName || u.nombre || "",
      email: u.email || u.correo || u.mail || "",
      opId: u.opId || u.sub || u.legacyId || String(u._id || u.id || ""),
      active: u.active !== false,
    }))
    .filter((u) => u.active !== false);

  const seen = new Set();
  return normalized.filter((g) => {
    const k = String(g._id || g.opId || g.email || "");
    if (!k) return true;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

function findGuardByAnyId(guards, value) {
  const v = String(value || "").trim();
  if (!v) return null;

  return (
    guards.find((g) => String(g._id || "") === v) ||
    guards.find((g) => String(g.opId || "") === v) ||
    null
  );
}

function matchesCurrentUserGuard(guard, user) {
  const userId = String(user?._id || user?.id || user?.sub || "").trim();
  const userEmail = String(user?.email || "").trim().toLowerCase();

  if (!guard) return false;
  if (userId && (String(guard._id || "") === userId || String(guard.opId || "") === userId)) {
    return true;
  }
  if (userEmail && String(guard.email || "").trim().toLowerCase() === userEmail) {
    return true;
  }
  return false;
}

function normalizeSpeechText(t) {
  return String(t || "").replace(/\s+/g, " ").trim();
}

export default function IncidenteForm({
  stayOnFinish = false,
  onCancel,
  origin,
  extraData = {},
}) {
  const nav = useNavigate();
  const location = useLocation();
  const localUser = useMemo(() => readLocalUser(), []);
  const selfGuard = useMemo(() => buildSelfGuard(localUser), [localUser]);

  const canRead =
    hasPermission(
      localUser,
      "incidentes.records.read",
      "incidentes.reports.read",
      "incidentes.read.any",
      "incidentes.reports.any"
    ) || hasRole(localUser, "admin", "superadmin", "supervisor", "guardia");

  const canCreate =
    hasPermission(localUser, "incidentes.records.write", "incidentes.create.any") ||
    hasRole(localUser, "admin", "superadmin", "supervisor", "guardia");

  const canCreateAny =
    hasPermission(localUser, "incidentes.create.any") ||
    hasRole(localUser, "admin", "superadmin", "supervisor");

  const canEditAny =
    hasPermission(localUser, "incidentes.edit.any") ||
    hasRole(localUser, "admin", "superadmin", "supervisor");

  const isGuardOnly =
    hasRole(localUser, "guardia", "guard", "rondasqr.guard") &&
    !canCreateAny &&
    !hasRole(localUser, "admin", "superadmin", "supervisor");

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

  const [media, setMedia] = useState([]);
  const [sending, setSending] = useState(false);

  const [showCamera, setShowCamera] = useState(false);
  const [showVideoRecorder, setShowVideoRecorder] = useState(false);
  const [showAudioRecorder, setShowAudioRecorder] = useState(false);

  const fileInputRef = useRef(null);

  const [guards, setGuards] = useState([]);
  const [loadingGuards, setLoadingGuards] = useState(false);

  const [speechSupported, setSpeechSupported] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [speechError, setSpeechError] = useState("");
  const recognitionRef = useRef(null);

  useEffect(() => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setSpeechSupported(false);
      recognitionRef.current = null;
      return;
    }

    setSpeechSupported(true);

    const recognition = new SpeechRecognition();
    recognition.lang = "es-HN";
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onstart = () => {
      setIsListening(true);
      setSpeechError("");
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognition.onerror = (event) => {
      console.warn("[IncidenteForm] speech error:", event?.error);
      setSpeechError("No se pudo usar el dictado por voz.");
      setIsListening(false);
    };

    recognition.onresult = (event) => {
      let finalTranscript = "";

      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const transcript = event.results[i][0]?.transcript || "";
        if (event.results[i].isFinal) {
          finalTranscript += transcript + " ";
        }
      }

      if (finalTranscript.trim()) {
        setForm((prev) => ({
          ...prev,
          description: `${prev.description}${prev.description ? " " : ""}${finalTranscript.trim()}`.trim(),
        }));
      }
    };

    recognitionRef.current = recognition;

    return () => {
      try {
        recognition.stop();
      } catch {
        // ignore
      }
    };
  }, []);

  useEffect(() => {
    let mounted = true;

    async function loadGuards() {
      if (isGuardOnly) {
        const mine = selfGuard && (selfGuard._id || selfGuard.email) ? [selfGuard] : [];
        if (!mounted) return;
        setGuards(mine);
        setForm((prev) => ({
          ...prev,
          reportedByGuardId: mine[0]?._id || mine[0]?.opId || "",
          reportedBy: mine[0] ? getGuardLabel(mine[0]) : "",
        }));
        setLoadingGuards(false);
        return;
      }

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

        let normalized = normalizeGuards(items);

        if (selfGuard && (selfGuard._id || selfGuard.email)) {
          const existsMe = normalized.some((g) => matchesCurrentUserGuard(g, localUser));
          if (!existsMe) normalized = [selfGuard, ...normalized];
        }

        if (!mounted) return;
        setGuards(normalized);

        const myself =
          normalized.find((g) => matchesCurrentUserGuard(g, localUser)) || null;

        if (myself && fromQueryIsRonda) {
          setForm((prev) => ({
            ...prev,
            reportedByGuardId: String(myself._id || myself.opId || ""),
            reportedBy: getGuardLabel(myself),
          }));
        }
      } catch (e) {
        console.warn("[IncidenteForm] load guards error:", e);
        if (!mounted) return;

        const fallback = selfGuard && (selfGuard._id || selfGuard.email) ? [selfGuard] : [];
        setGuards(fallback);

        if (fromQueryIsRonda || isGuardOnly) {
          setForm((prev) => ({
            ...prev,
            reportedByGuardId: fallback[0]?._id || fallback[0]?.opId || "",
            reportedBy: fallback[0] ? getGuardLabel(fallback[0]) : "",
          }));
        }
      } finally {
        if (mounted) setLoadingGuards(false);
      }
    }

    loadGuards();

    return () => {
      mounted = false;
    };
  }, [fromQueryIsRonda, isGuardOnly, localUser, selfGuard]);

  useEffect(() => {
    if (!editingIncident) return;

    const matchedGuard = findGuardByAnyId(
      guards,
      editingIncident.reportedByGuardId ||
        editingIncident.guardId ||
        editingIncident.opId ||
        editingIncident.createdByUserId ||
        ""
    );

    setForm((prev) => ({
      ...prev,
      type: editingIncident.type || "Acceso no autorizado",
      description: editingIncident.description || "",
      reportedBy:
        matchedGuard
          ? getGuardLabel(matchedGuard)
          : editingIncident.reportedBy || "",
      reportedByGuardId: String(
        matchedGuard?._id ||
          editingIncident.reportedByGuardId ||
          editingIncident.guardId ||
          editingIncident.opId ||
          editingIncident.createdByUserId ||
          ""
      ),
      zone: editingIncident.zone || "",
      priority: editingIncident.priority || "alta",
      status: editingIncident.status || "abierto",
    }));

    setMedia(normalizeIncidentMedia(editingIncident));
  }, [editingIncident, guards]);

  useEffect(() => {
    if (!openLike(finalStayOnFinish, editing, onCancel) && recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
      setIsListening(false);
    }
  }, [finalStayOnFinish, editing, onCancel]);

  const canEditThisIncident = useMemo(() => {
    if (!editingIncident) return canCreate;
    if (canEditAny) return true;

    const myId = String(localUser?._id || localUser?.id || localUser?.sub || "").trim();
    const myEmail = String(localUser?.email || "").trim().toLowerCase();

    const ownerIds = [
      editingIncident?.createdByUserId,
      editingIncident?.reportedByGuardId,
      editingIncident?.guardId,
      editingIncident?.reportedByUserId,
    ]
      .map((v) => String(v || "").trim())
      .filter(Boolean);

    const ownerEmails = [
      editingIncident?.reportedByGuardEmail,
      editingIncident?.guardEmail,
    ]
      .map((v) => String(v || "").trim().toLowerCase())
      .filter(Boolean);

    if (myId && ownerIds.includes(myId)) return true;
    if (myEmail && ownerEmails.includes(myEmail)) return true;

    return false;
  }, [editingIncident, canEditAny, canCreate, localUser]);

  const availableGuards = useMemo(() => {
    if (!isGuardOnly) return guards;
    const mine = guards.filter((g) => matchesCurrentUserGuard(g, localUser));
    return mine.length
      ? mine
      : selfGuard && (selfGuard._id || selfGuard.email)
      ? [selfGuard]
      : [];
  }, [guards, isGuardOnly, localUser, selfGuard]);

  const selectedGuard = useMemo(() => {
    return (
      findGuardByAnyId(availableGuards, form.reportedByGuardId) ||
      availableGuards.find((g) => matchesCurrentUserGuard(g, localUser)) ||
      null
    );
  }, [availableGuards, form.reportedByGuardId, localUser]);

  const handleChange = (e) =>
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));

  const handleReporterChange = (e) => {
    const selectedId = e.target.value;
    const g = findGuardByAnyId(guards, selectedId);

    if (isGuardOnly && g && !matchesCurrentUserGuard(g, localUser)) {
      return;
    }

    setForm((prev) => ({
      ...prev,
      reportedByGuardId: selectedId,
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
    const myGuard =
      guards.find((g) => matchesCurrentUserGuard(g, localUser)) ||
      (selfGuard && (selfGuard._id || selfGuard.email) ? selfGuard : null);

    setForm({
      type: "Acceso no autorizado",
      description: "",
      reportedBy: isGuardOnly && myGuard ? getGuardLabel(myGuard) : "",
      reportedByGuardId:
        isGuardOnly && myGuard ? String(myGuard._id || myGuard.opId || "") : "",
      zone: "",
      priority: "alta",
      status: "abierto",
    });

    setMedia([]);
    setSpeechError("");
    try {
      recognitionRef.current?.stop();
    } catch {
      // ignore
    }
    setIsListening(false);
  };

  function toggleVoiceDictation() {
    if (!speechSupported || !recognitionRef.current) {
      setSpeechError("El dictado por voz no está disponible en este navegador.");
      return;
    }

    setSpeechError("");

    try {
      if (isListening) recognitionRef.current.stop();
      else recognitionRef.current.start();
    } catch (err) {
      console.warn("[IncidenteForm] toggle voice error:", err);
      setSpeechError("No se pudo iniciar el dictado por voz.");
      setIsListening(false);
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!canCreate) {
      return alert("No tienes permisos para reportar incidentes.");
    }

    if (editing && !canEditThisIncident) {
      return alert("No tienes permisos para editar este incidente.");
    }

    if (!form.description.trim()) return alert("Describa el incidente.");

    const effectiveGuard =
      findGuardByAnyId(guards, form.reportedByGuardId) ||
      selectedGuard ||
      (isGuardOnly ? selfGuard : null);

    if (!effectiveGuard || !(effectiveGuard._id || effectiveGuard.opId || effectiveGuard.email)) {
      return alert("Seleccione el guardia que reporta el incidente.");
    }

    if (isGuardOnly && !matchesCurrentUserGuard(effectiveGuard, localUser)) {
      return alert("Como guardia, solo puedes reportar incidentes a tu propio nombre.");
    }

    try {
      setSending(true);

      const label = getGuardLabel(effectiveGuard);
      const myId = String(localUser?._id || localUser?.id || localUser?.sub || "").trim();

      const photosBase64 = media.filter((m) => m.type === "image").map((m) => m.src);
      const videosBase64 = media.filter((m) => m.type === "video").map((m) => m.src);
      const audiosBase64 = media.filter((m) => m.type === "audio").map((m) => m.src);

      const evidences = media.map((m) => ({
        kind: normalizeEvidenceKind(m.type),
        base64: m.src,
      }));

      const payload = {
        ...form,
        reportedByGuardId: String(effectiveGuard._id || effectiveGuard.opId || ""),
        reportedBy: label,
        status: String(form.status || "abierto").trim(),

        reportedByGuardName: effectiveGuard?.name || "",
        reportedByGuardEmail: effectiveGuard?.email || "",

        guardId: String(effectiveGuard._id || effectiveGuard.opId || ""),
        guardName: effectiveGuard?.name || "",
        guardEmail: effectiveGuard?.email || "",

        createdByUserId: myId || "",
        reportedByUserId: myId || "",

        photosBase64,
        videosBase64,
        audiosBase64,
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
      console.error("Error guardando incidente:", err);
      console.error("STATUS:", err?.response?.status || err?.status);
      console.error("DATA:", err?.response?.data || err?.payload);

      const msg =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        err?.payload?.message ||
        err?.payload?.error ||
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

  if (!canRead) {
    return (
      <div className={UI.page}>
        <div className={UI.shell} style={sxCard()}>
          <h2 className={UI.title} style={{ color: "var(--text)" }}>
            Acceso restringido
          </h2>
          <p style={{ color: "var(--text-muted)" }}>
            No tienes permisos para acceder al módulo de incidentes.
          </p>
          <div className="pt-4">
            <button type="button" onClick={() => nav("/")} className={UI.btn} style={sxGhostBtn()}>
              Volver al panel
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (editing && !canEditThisIncident) {
    return (
      <div className={UI.page}>
        <div className={UI.shell} style={sxCard()}>
          <h2 className={UI.title} style={{ color: "var(--text)" }}>
            Edición no permitida
          </h2>
          <p style={{ color: "var(--text-muted)" }}>
            No tienes permiso para editar este incidente.
          </p>
          <div className="pt-4">
            <button
              type="button"
              onClick={() => nav("/incidentes/lista")}
              className={UI.btn}
              style={sxGhostBtn()}
            >
              Volver a la lista
            </button>
          </div>
        </div>
      </div>
    );
  }

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
          <input type="hidden" name="reportedByGuardId" value={form.reportedByGuardId || ""} readOnly />

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
              <label
                className={UI.label}
                style={{ color: "var(--text-muted)", marginBottom: 0 }}
              >
                Descripción del Incidente
              </label>

              <div className="flex flex-wrap items-center gap-2">
                <span
                  className="inline-flex items-center gap-1 text-xs"
                  style={{ color: "var(--text-muted)" }}
                >
                  <PencilLine className="h-3.5 w-3.5" />
                  Manual
                </span>

                <button
                  type="button"
                  onClick={toggleVoiceDictation}
                  disabled={!speechSupported}
                  className={UI.btnSm}
                  style={
                    !speechSupported
                      ? { ...sxGhostBtn(), opacity: 0.55, cursor: "not-allowed" }
                      : isListening
                      ? sxDangerBtn()
                      : sxGhostBtn()
                  }
                  title={
                    speechSupported
                      ? isListening
                        ? "Detener dictado"
                        : "Iniciar dictado por voz"
                      : "Dictado por voz no disponible"
                  }
                >
                  {isListening ? (
                    <>
                      <MicOff className="h-3.5 w-3.5" />
                      <span>Detener</span>
                    </>
                  ) : (
                    <>
                      <Mic className="h-3.5 w-3.5" />
                      <span>Micrófono</span>
                    </>
                  )}
                </button>
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

            {(speechError || speechSupported) && (
              <div className="mt-2 rounded-[14px] p-3" style={sxCardSoft()}>
                {speechError ? (
                  <div className="text-xs" style={{ color: "#fb7185" }}>
                    ⚠️ {speechError}
                  </div>
                ) : (
                  <div
                    className="text-xs"
                    style={{
                      color: isListening ? "#22c55e" : "var(--text-muted)",
                    }}
                  >
                    {isListening
                      ? "Escuchando... hable ahora para agregar la descripción."
                      : speechSupported
                      ? "Puede escribir manualmente o usar el micrófono para dictar."
                      : "El dictado por voz no está disponible en este navegador."}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={UI.label} style={{ color: "var(--text-muted)" }}>
                Reportado por
              </label>

              {isGuardOnly ? (
                <input
                  type="text"
                  value={selectedGuard ? getGuardLabel(selectedGuard) : form.reportedBy}
                  readOnly
                  className={UI.input}
                  style={sxInput({ opacity: 0.95 })}
                  placeholder="Tu usuario guardia"
                />
              ) : (
                <select
                  name="reportedByGuardId"
                  value={form.reportedByGuardId}
                  onChange={handleReporterChange}
                  className={UI.select}
                  style={sxInput()}
                  required
                  disabled={loadingGuards}
                >
                  <option value="">
                    {loadingGuards
                      ? "Cargando guardias..."
                      : "Seleccione el guardia que reporta"}
                  </option>

                  {availableGuards.map((g) => (
                    <option key={g._id || g.opId} value={g._id || g.opId}>
                      {getGuardLabel(g)}
                    </option>
                  ))}
                </select>
              )}

              {isGuardOnly && (
                <p className="mt-2 text-xs" style={{ color: "var(--text-muted)" }}>
                  Como usuario guardia, el incidente queda reportado automáticamente a tu nombre.
                </p>
              )}
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

          <div>
            <label className={UI.label} style={{ color: "var(--text-muted)" }}>
              Estado
            </label>
            <select
              name="status"
              value={form.status}
              onChange={handleChange}
              className={UI.select}
              style={sxInput()}
            >
              <option value="abierto">Abierto</option>
              <option value="en proceso">En proceso</option>
              <option value="cerrado">Cerrado</option>
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

              <p className="text-xs self-center" style={{ color: "var(--text-muted)" }}>
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
                      onClick={() => setMedia((prev) => prev.filter((_, i) => i !== idx))}
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
              disabled={sending || !canCreate || (editing && !canEditThisIncident)}
              className={UI.btn}
              style={sxSuccessBtn(
                sending || !canCreate || (editing && !canEditThisIncident)
                  ? { opacity: 0.7, cursor: "not-allowed" }
                  : {}
              )}
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

function openLike(finalStayOnFinish, editing, onCancel) {
  return !!(finalStayOnFinish || editing || onCancel);
}