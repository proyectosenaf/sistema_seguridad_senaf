import React, { useState } from "react";

export default function DatabaseUploadPage() {
  const [file, setFile] = useState(null);
  async function upload() {
    if (!file) return;
    // Si deseas, manda el archivo a /api/rondasqr/v1/admin/import (cuando lo tengas)
    alert(`Subiendo base (stub): ${file.name}`);
  }
  return (
    <div className="p-4 space-y-3">
      <h1 className="text-xl font-semibold">Enviar base de datos</h1>
      <input type="file" accept=".csv,.kml,.json" onChange={e=>setFile(e.target.files?.[0] || null)} />
      <button disabled={!file} onClick={upload} className="px-5 py-2 rounded-xl bg-blue-600 text-white disabled:opacity-50">Enviar</button>
    </div>
  );
}
