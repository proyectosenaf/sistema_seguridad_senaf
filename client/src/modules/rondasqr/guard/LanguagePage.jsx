import React, { useState } from "react";

export default function LanguagePage() {
  const [lang, setLang] = useState(localStorage.getItem("lang") || "es");
  function save() {
    localStorage.setItem("lang", lang);
    alert("Idioma guardado (stub). Integra con i18n si lo usas.");
  }
  return (
    <div className="p-4 space-y-3">
      <h1 className="text-xl font-semibold">Idioma</h1>
      <select value={lang} onChange={e=>setLang(e.target.value)}
              className="bg-black/30 border border-white/10 rounded px-3 py-2">
        <option value="es">Español</option>
        <option value="en">English</option>
      </select>
      <button onClick={save} className="px-4 py-2 rounded bg-blue-600 text-white">Guardar</button>
    </div>
  );
}
