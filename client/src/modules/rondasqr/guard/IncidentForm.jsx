// guard/IncidentForm.jsx
import React, { useState } from "react";
import { rondasqrApi } from "../api/rondasqrApi";

export default function IncidentForm() {
  const [text, setText] = useState("");
  const [files, setFiles] = useState([]);

  async function submit(e) {
    if (e) e.preventDefault();

    const gps = await new Promise((res) =>
      navigator.geolocation.getCurrentPosition(
        (p) => res({ lat: p.coords.latitude, lon: p.coords.longitude }),
        () => res(null)
      )
    );

    const fd = new FormData();
    fd.append("text", text);
    if (gps) {
      fd.append("lat", gps.lat);
      fd.append("lon", gps.lon);
    }
    [...files].forEach((f) => fd.append("photos", f));

    await rondasqrApi.createIncident(fd);
    setText("");
    setFiles([]);
    alert("Incidente enviado");
  }

  return (
    <div className="p-4 bg-slate-900/30 rounded-xl border border-slate-800">
      <h2 className="font-medium text-white mb-3">Registrar incidente</h2>
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
        onClick={submit}
        className="mt-3 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded"
      >
        Enviar
      </button>
    </div>
  );
}
