import React, { useMemo, useState } from "react";

function StarButton({ active, disabled = false, onClick, label }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      disabled={disabled}
      className={`text-3xl transition-transform ${
        disabled ? "cursor-not-allowed" : "hover:scale-110"
      } ${active ? "opacity-100" : "opacity-30"}`}
      style={{
        color: active ? "#fbbf24" : "var(--text-muted)",
      }}
    >
      ★
    </button>
  );
}

export default function VisitFeedbackCard({
  item,
  loading = false,
  onSubmit,
}) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [wouldRecommend, setWouldRecommend] = useState("");

  const visitaId = String(item?._id || item?.id || "").trim();
  const canSubmit = !!visitaId && rating >= 1 && !loading;

  const visitTitle = useMemo(() => {
    return (
      item?.motivo ||
      item?.reason ||
      item?.titulo ||
      item?.asunto ||
      "Visita finalizada"
    );
  }, [item]);

  const hostLabel = useMemo(() => {
    return (
      item?.empleado ||
      item?.employee ||
      item?.hostName ||
      "Sin anfitrión"
    );
  }, [item]);

  const companyLabel = useMemo(() => {
    return item?.empresa || item?.company || "";
  }, [item]);

  const visitorLabel = useMemo(() => {
    return item?.nombre || item?.name || "Visitante";
  }, [item]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!canSubmit) return;

    try {
      await onSubmit({
        visitaId,
        rating,
        comment: comment.trim(),
        wouldRecommend,
      });

      setRating(0);
      setComment("");
      setWouldRecommend("");
    } catch {
      // El manejo del error lo hace el componente padre.
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-[24px] border p-4 space-y-4"
      style={{
        borderColor: "var(--border)",
        background: "color-mix(in srgb, var(--panel) 88%, transparent)",
      }}
    >
      <div>
        <h3
          className="text-base font-semibold"
          style={{ color: "var(--text)" }}
        >
          Califica tu experiencia
        </h3>
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          Tu opinión nos ayuda a mejorar la atención a visitantes.
        </p>
      </div>

      <div
        className="rounded-[16px] p-3 space-y-1"
        style={{ background: "rgba(255,255,255,0.04)" }}
      >
        <div className="text-sm font-medium" style={{ color: "var(--text)" }}>
          {visitTitle}
        </div>

        <div className="text-xs" style={{ color: "var(--text-muted)" }}>
          Visitante: {visitorLabel}
        </div>

        <div className="text-xs" style={{ color: "var(--text-muted)" }}>
          Anfitrión: {hostLabel}
        </div>

        {!!companyLabel && (
          <div className="text-xs" style={{ color: "var(--text-muted)" }}>
            Empresa: {companyLabel}
          </div>
        )}
      </div>

      <div>
        <label
          className="mb-2 block text-sm font-medium"
          style={{ color: "var(--text)" }}
        >
          Calificación
        </label>

        <div className="flex gap-2 flex-wrap">
          {[1, 2, 3, 4, 5].map((n) => (
            <StarButton
              key={n}
              active={n <= rating}
              disabled={loading}
              onClick={() => setRating(n)}
              label={`${n} estrellas`}
            />
          ))}
        </div>

        <div className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
          {rating > 0
            ? `Seleccionaste ${rating} estrella${rating > 1 ? "s" : ""}`
            : "Selecciona una calificación de 1 a 5 estrellas"}
        </div>
      </div>

      <div>
        <label
          className="mb-2 block text-sm font-medium"
          style={{ color: "var(--text)" }}
        >
          Observaciones
        </label>

        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={4}
          maxLength={1000}
          disabled={loading}
          className="w-full rounded-[16px] p-3 outline-none resize-none"
          style={{
            border: "1px solid var(--border)",
            background: "rgba(255,255,255,0.04)",
            color: "var(--text)",
          }}
          placeholder="Cuéntanos cómo fue tu experiencia"
        />

        <div className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
          {comment.length}/1000
        </div>
      </div>

      <div>
        <label
          className="mb-2 block text-sm font-medium"
          style={{ color: "var(--text)" }}
        >
          ¿Recomendarías este proceso?
        </label>

        <select
          value={wouldRecommend}
          onChange={(e) => setWouldRecommend(e.target.value)}
          disabled={loading}
          className="w-full rounded-[16px] p-3 outline-none"
          style={{
            border: "1px solid var(--border)",
            background: "rgba(255,255,255,0.04)",
            color: "var(--text)",
          }}
        >
          <option value="">Selecciona una opción</option>
          <option value="yes">Sí</option>
          <option value="maybe">Tal vez</option>
          <option value="no">No</option>
        </select>
      </div>

      <button
        type="submit"
        disabled={!canSubmit}
        className="inline-flex items-center justify-center gap-2 text-sm px-4 py-2 rounded-full transition"
        style={{
          opacity: canSubmit ? 1 : 0.6,
          pointerEvents: canSubmit ? "auto" : "none",
          background: "#06b6d4",
          color: "#082f49",
          fontWeight: 700,
        }}
      >
        {loading ? "Enviando..." : "Enviar opinión"}
      </button>
    </form>
  );
}