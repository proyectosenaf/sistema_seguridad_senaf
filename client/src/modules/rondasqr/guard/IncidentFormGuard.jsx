import React, { useState, useRef } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import CameraCapture from "../../../components/CameraCapture.jsx";

export default function IncidentFormGuard() {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    type: "Acceso no autorizado",
    description: "",
    reportedBy: "",
    zone: "",
    priority: "alta",
  });

  const [photos, setPhotos] = useState([]);
  const [sending, setSending] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [okMsg, setOkMsg] = useState("");
  const fileInputRef = useRef(null);

  const handleChange = (e) =>
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));

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

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setSending(true);
      setOkMsg("");

      const payload = {
        ...form,
        photosBase64: photos,
      };

      await axios.post("http://localhost:4000/api/incidentes", payload);

      // no salimos del módulo de rondas
      setForm({
        type: "Acceso no autorizado",
        description: "",
        reportedBy: "",
        zone: "",
        priority: "alta",
      });
      setPhotos([]);
      setOkMsg("Incidente registrado ✔");
    } catch (err) {
      console.error("[IncidentFormGuard] error:", err);
      alert("Error al reportar el incidente");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#130815] via-[#020617] to-black px-4 py-6 space-y-5">
      <div className="flex items-center justify-between gap-3">
        <button
          onClick={() => navigate("/rondasqr/scan")}
          className="text-xs px-3 py-1 rounded-lg bg-white/5 border border-white/10 text-white hover:bg-white/10"
        >
          ← Volver
        </button>
        {okMsg && (
          <span className="text-xs px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-200 border border-emerald-400/30">
            {okMsg}
          </span>
        )}
      </div>

      <h1 className="text-xl font-semibold text-white">Mensaje / Incidente</h1>
      <p className="text-xs text-white/50">
        Completa los datos del incidente que estás reportando.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs mb-1 text-white/80">Tipo</label>
          <select
            name="type"
            value={form.type}
            onChange={handleChange}
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white"
          >
            <option>Acceso no autorizado</option>
            <option>Falla técnica</option>
            <option>Objeto perdido</option>
            <option>Otro</option>
          </select>
        </div>

        <div>
          <label className="block text-xs mb-1 text-white/80">
            Descripción
          </label>
          <textarea
            name="description"
            value={form.description}
            onChange={handleChange}
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white min-h-[100px]"
            placeholder="Describe lo ocurrido…"
            required
          />
        </div>

        <div>
          <label className="block text-xs mb-1 text-white/80">
            Reportado por
          </label>
          <input
            name="reportedBy"
            value={form.reportedBy}
            onChange={handleChange}
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white"
            placeholder="Nombre del guardia"
            required
          />
        </div>

        <div>
          <label className="block text-xs mb-1 text-white/80">
            Zona / ubicación
          </label>
          <input
            name="zone"
            value={form.zone}
            onChange={handleChange}
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white"
            placeholder="Ej. Entrada principal"
            required
          />
        </div>

        <div>
          <label className="block text-xs mb-1 text-white/80">
            Prioridad
          </label>
          <select
            name="priority"
            value={form.priority}
            onChange={handleChange}
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white"
          >
            <option value="alta">Alta</option>
            <option value="media">Media</option>
            <option value="baja">Baja</option>
          </select>
        </div>

        <div className="space-y-2">
          <label className="block text-xs mb-1 text-white/80">
            Evidencias
          </label>
          <div className="flex gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="px-4 py-2 rounded-lg bg-indigo-500 text-white text-sm"
            >
              📁 Seleccionar
            </button>
            <button
              type="button"
              onClick={() => setShowCamera(true)}
              className="px-4 py-2 rounded-lg bg-cyan-500 text-white text-sm"
            >
              📷 Tomar foto
            </button>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFile}
            className="hidden"
          />

          {photos.length > 0 && (
            <div className="flex gap-2 flex-wrap">
              {photos.map((src, i) => (
                <div
                  key={i}
                  className="relative w-20 h-20 rounded-lg overflow-hidden border border-white/10 bg-black/30"
                >
                  <img src={src} alt="" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() =>
                      setPhotos((prev) => prev.filter((_, j) => j !== i))
                    }
                    className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/70 text-white text-xs flex items-center justify-center"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="pt-2 flex gap-3">
          <button
            type="button"
            onClick={() => navigate("/rondasqr/scan")}
            className="flex-1 bg-white/5 border border-white/10 rounded-lg py-2 text-sm text-white hover:bg-white/10"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={sending}
            className="flex-1 bg-emerald-500 hover:bg-emerald-400 rounded-lg py-2 text-sm font-semibold text-white disabled:opacity-70"
          >
            {sending ? "Enviando..." : "Reportar"}
          </button>
        </div>
      </form>

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
