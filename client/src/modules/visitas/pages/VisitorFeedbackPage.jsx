import React, { useEffect, useState } from "react";
import { visitFeedbackApi } from "../api/visitFeedbackApi.js";
import VisitFeedbackCard from "../components/VisitFeedbackCard.jsx";

export default function VisitorFeedbackPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submittingId, setSubmittingId] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function loadPending() {
    setLoading(true);
    setError("");
    try {
      const data = await visitFeedbackApi.getPendingMine();
      setItems(data);
    } catch (err) {
      setError(
        err?.response?.data?.message ||
          err?.message ||
          "No se pudo cargar el feedback pendiente."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadPending();
  }, []);

  async function handleSubmit(payload) {
    const visitId = String(payload?.visitaId || "");
    setSubmittingId(visitId);
    setError("");
    setSuccess("");

    try {
      await visitFeedbackApi.submit(payload);
      setSuccess("Gracias. Tu opinión fue registrada.");
      setItems((prev) =>
        prev.filter((item) => String(item._id || item.id) !== visitId)
      );
    } catch (err) {
      setError(
        err?.response?.data?.message ||
          err?.message ||
          "No se pudo enviar la opinión."
      );
    } finally {
      setSubmittingId("");
    }
  }

  return (
    <div className="layer-content space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Tu opinión</h1>
        <p className="text-sm opacity-75">
          Califica tus visitas finalizadas y ayúdanos a mejorar.
        </p>
      </div>

      {loading && <p className="text-sm opacity-75">Cargando...</p>}
      {!!error && <p className="text-sm text-rose-400">{error}</p>}
      {!!success && <p className="text-sm text-emerald-400">{success}</p>}

      {!loading && items.length === 0 && (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          No tienes visitas pendientes por calificar.
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {items.map((visit) => {
          const visitId = String(visit?._id || visit?.id || "");
          return (
            <VisitFeedbackCard
              key={visitId}
              visit={visit}
              loading={submittingId === visitId}
              onSubmit={handleSubmit}
            />
          );
        })}
      </div>
    </div>
  );
}