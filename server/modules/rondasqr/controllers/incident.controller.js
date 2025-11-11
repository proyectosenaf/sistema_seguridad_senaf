// src/modules/rondasqr/guard/IncidentForm.jsx
import React, { useState } from "react";
import { rondasqrApi } from "../api/rondasqrApi.js";

export default function IncidentForm() {
  const [text, setText] = useState("");
  const [files, setFiles] = useState([]);
  const [sending, setSending] = useState(false);

  const API_BASE =
    import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";

  async function submit(e) {
    if (e) e.preventDefault();
    if (!text.trim()) {
      alert("Describe el incidente.");
      return;
    }

    setSending(true);

    // 1) guardar en el módulo de RONDAS (el tuyo de siempre)
    let gps = null;
    try {
      gps = await new Promise((res) =>
        navigator.geolocation.getCurrentPosition(
          (p) => res({ lat: p.coords.latitude, lon: p.coords.longitude }),
          () => res(null)
        )
      );
    } catch (_) {}

    try {
      const fd = new FormData();
      fd.append("text", text);
      if (gps) {
        fd.append("lat", gps.lat);
        fd.append("lon", gps.lon);
      }
      [...files].forEach((f) => fd.append("photos", f));

      await rondasqrApi.createIncident(fd);
    } catch (err) {
      console.warn("No se pudo guardar en rondas:", err);
      // seguimos con el general
    }

    // 2) ahora lo mandamos al módulo general de incidentes PERO SIN AXIOS
    try {
      const photosBase64 = await Promise.all(
        [...files].map((f) => fileToBase64(f))
      );

      const body = {
        type: "Incidente de ronda",
        description: text,
        reportedBy: "guardia (ronda)",
        zone: gps ? `${gps.lat},${gps.lon}` : "",
        priority: "media",
        status: "abierto",
        origin: "ronda",
        photosBase64,
      };

      // 👇 AQUÍ VA EL TRUCO: fetch en vez de axios
      await fetch(`${API_BASE}/api/incidentes`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify(body),
      });
    } catch (err) {
      console.warn("Se guardó en rondas pero no en /api/incidentes:", err);
    }

    // 3) limpiar sin navegar
    setText("");
    setFiles([]);
    setSending(false);
    alert("Incidente enviado");
  }

  return (
    <div className="p-4 bg-slate-900/30 rounded-xl border border-slate-800">
      <h2 className="font-medium text-white mb-3">Registrar incidente</h2>
      <form onSubmit={submit} className="space-y-3">
        <textarea
          className="border border-slate-700 bg-slate-900/40 w-full p-2 rounded text-white"
          maxLength={200}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Descripción (max 200)"
        />
        <input
          type="file"
          multiple
          accept="image/*"
          onChange={(e) => setFiles(e.target.files)}
          className="mt-2 text-white"
        />
        <button
          type="submit"
          disabled={sending}
          className="mt-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white px-4 py-2 rounded"
        >
          {sending ? "Enviando..." : "Enviar"}
        </button>
      </form>
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
