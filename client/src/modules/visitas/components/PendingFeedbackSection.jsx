import React, { useEffect, useState, useCallback } from "react";
import { visitFeedbackApi } from "../api/visitFeedbackApi.js";
import VisitFeedbackCard from "./VisitFeedbackCard.jsx";

function extractItemsFromResponse(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.rows)) return payload.rows;
  if (Array.isArray(payload?.results)) return payload.results;
  return [];
}

export default function PendingFeedbackSection() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submittingId, setSubmittingId] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadPending = useCallback(async (isMountedRef) => {
    if (!isMountedRef.current) return;

    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const response = await visitFeedbackApi.getPendingMine();
      const nextItems = extractItemsFromResponse(response);

      if (!isMountedRef.current) return;
      setItems(nextItems);
    } catch (err) {
      if (!isMountedRef.current) return;

      setError(
        err?.response?.data?.error ||
          err?.response?.data?.message ||
          err?.message ||
          "No se pudo cargar la encuesta de satisfacción."
      );
      setItems([]);
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    const isMountedRef = { current: true };
    loadPending(isMountedRef);

    return () => {
      isMountedRef.current = false;
    };
  }, [loadPending]);

  async function handleSubmit(payload) {
    const id = String(payload?._id || payload?.visitaId || "");
    if (!id) return;

    setSubmittingId(id);
    setError("");
    setSuccess("");

    try {
      await visitFeedbackApi.submit(payload);

      setItems((prev) =>
        prev.filter((item) => String(item?._id || item?.id) !== id)
      );

      setSuccess("Gracias. Tu opinión fue registrada correctamente.");
    } catch (err) {
      setError(
        err?.response?.data?.error ||
          err?.response?.data?.message ||
          err?.message ||
          "No se pudo enviar la opinión."
      );
    } finally {
      setSubmittingId("");
    }
  }

  if (loading) {
    return (
      <div
        className="rounded-[24px] p-4"
        style={{
          border: "1px solid var(--border)",
          background: "color-mix(in srgb, var(--panel) 88%, transparent)",
        }}
      >
        <p style={{ color: "var(--text-muted)" }}>
          Cargando encuestas pendientes...
        </p>
      </div>
    );
  }

  if (error && !items.length) {
    return (
      <div
        className="rounded-[24px] p-4 flex flex-col gap-3"
        style={{
          border: "1px solid var(--border)",
          background: "color-mix(in srgb, var(--panel) 88%, transparent)",
        }}
      >
        <p className="text-sm text-rose-400">{error}</p>

        <div>
          <button
            type="button"
            onClick={() => {
              const isMountedRef = { current: true };
              loadPending(isMountedRef);
            }}
            className="inline-flex items-center justify-center gap-2 text-sm px-4 py-2 rounded-full transition"
            style={{
              background: "#06b6d4",
              color: "#082f49",
              fontWeight: 700,
            }}
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  if (!items.length) return null;

  return (
    <section className="flex flex-col gap-4">
      <div>
        <h2 className="text-lg font-bold" style={{ color: "var(--text)" }}>
          Tu opinión
        </h2>
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          Estas visitas ya finalizaron y están listas para ser calificadas.
        </p>
      </div>

      {!!error && <p className="text-sm text-rose-400">{error}</p>}
      {!!success && <p className="text-sm text-emerald-400">{success}</p>}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {items.map((item) => {
          const id = String(item?._id || item?.id || "");
          return (
            <VisitFeedbackCard
              key={id}
              item={item}
              loading={submittingId === id}
              onSubmit={handleSubmit}
            />
          );
        })}
      </div>
    </section>
  );
}