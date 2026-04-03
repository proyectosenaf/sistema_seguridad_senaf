import React, { useMemo, useState } from "react";

export default function PhotosPage() {
  const [files, setFiles] = useState([null, null, null, null, null]);
  const [sending, setSending] = useState(false);

  function onPick(index, fileList) {
    setFiles((prev) => {
      const next = [...prev];
      next[index] = fileList?.[0] || null;
      return next;
    });
  }

  function clear(index) {
    setFiles((prev) => {
      const next = [...prev];
      next[index] = null;
      return next;
    });
  }

  const selectedCount = useMemo(() => files.filter(Boolean).length, [files]);

  async function send() {
    if (sending) return;

    const picked = files.filter(Boolean);
    if (!picked.length) {
      alert("Selecciona al menos una foto.");
      return;
    }

    setSending(true);
    try {
      // TODO: reemplazar con llamada real a tu API cuando me pases el endpoint
      alert(
        `Fotos listas para envío: ${picked.length}. Reemplaza este stub con tu API.`
      );
    } catch (e) {
      console.error("[PhotosPage] send error:", e?.message || e);
      alert("No se pudieron enviar las fotos.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-xl font-semibold">Enviar fotos</h1>

      <p className="text-sm text-white/70">
        Seleccionadas: <strong>{selectedCount}</strong> de 5
      </p>

      <div className="grid gap-3 md:grid-cols-2">
        {files.map((file, index) => (
          <div
            key={index}
            className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl p-3"
          >
            <div className="w-28 text-sm">Toma foto {index + 1}</div>

            <input
              type="file"
              accept="image/*"
              onChange={(e) => onPick(index, e.target.files)}
              className="flex-1"
            />

            <button
              type="button"
              className="px-3 py-1 rounded bg-red-600 text-white disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={() => clear(index)}
              disabled={!file}
            >
              Eliminar
            </button>
          </div>
        ))}
      </div>

      <button
        type="button"
        className="px-5 py-2 rounded-xl bg-blue-600 text-white disabled:opacity-50 disabled:cursor-not-allowed"
        onClick={send}
        disabled={sending}
      >
        {sending ? "Enviando..." : "Enviar"}
      </button>
    </div>
  );
}