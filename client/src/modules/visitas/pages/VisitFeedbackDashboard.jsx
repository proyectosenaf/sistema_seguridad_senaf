import React, { useEffect, useMemo, useState, useCallback } from "react";
import { visitFeedbackApi } from "../api/visitFeedbackApi.js";

function KPI({ title, value, subtitle }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="text-sm opacity-70">{title}</div>
      <div className="mt-1 text-3xl font-bold">{value}</div>
      {subtitle ? (
        <div className="mt-1 text-xs opacity-60">{subtitle}</div>
      ) : null}
    </div>
  );
}

function RatingBar({ label, count, total }) {
  const pct = total ? Math.round((count / total) * 100) : 0;

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <span>{label}</span>
        <span>
          {count} ({pct}%)
        </span>
      </div>

      <div className="h-3 rounded-full bg-white/10 overflow-hidden">
        <div
          className="h-full rounded-full"
          style={{
            width: `${pct}%`,
            background: "linear-gradient(90deg, #7cc7ff 0%, #8ee3d1 100%)",
          }}
        />
      </div>
    </div>
  );
}

function MonthBar({ label, count, maxCount }) {
  const pct = maxCount > 0 ? Math.round((count / maxCount) * 100) : 0;

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <span>{label}</span>
        <span>{count}</span>
      </div>

      <div className="h-3 rounded-full bg-white/10 overflow-hidden">
        <div
          className="h-full rounded-full"
          style={{
            width: `${pct}%`,
            background: "linear-gradient(90deg, #a78bfa 0%, #7dd3fc 100%)",
          }}
        />
      </div>
    </div>
  );
}

function formatMonthLabel(year, month) {
  const date = new Date(year, month - 1, 1);
  return date.toLocaleDateString("es-HN", {
    month: "short",
    year: "numeric",
  });
}

function renderStars(value) {
  const n = Math.max(0, Math.min(5, Number(value) || 0));
  return "★".repeat(n) + "☆".repeat(5 - n);
}

export default function VisitFeedbackDashboard() {
  const [metrics, setMetrics] = useState(null);
  const [listData, setListData] = useState({ items: [], meta: null });
  const [loadingMetrics, setLoadingMetrics] = useState(true);
  const [loadingList, setLoadingList] = useState(true);
  const [error, setError] = useState("");

  const [filters, setFilters] = useState({
    from: "",
    to: "",
    rating: "",
    withComment: false,
    q: "",
    page: 1,
    limit: 10,
  });

  const loadMetrics = useCallback(async (currentFilters) => {
    setLoadingMetrics(true);

    try {
      const data = await visitFeedbackApi.getMetrics({
        from: currentFilters.from || undefined,
        to: currentFilters.to || undefined,
      });
      setMetrics(data || null);
    } catch (err) {
      throw err;
    } finally {
      setLoadingMetrics(false);
    }
  }, []);

  const loadList = useCallback(async (currentFilters) => {
    setLoadingList(true);

    try {
      const data = await visitFeedbackApi.list({
        from: currentFilters.from || undefined,
        to: currentFilters.to || undefined,
        rating: currentFilters.rating || undefined,
        withComment: currentFilters.withComment ? "true" : undefined,
        q: currentFilters.q || undefined,
        page: currentFilters.page,
        limit: currentFilters.limit,
      });

      setListData({
        items: data?.items || [],
        meta: data?.meta || null,
      });
    } catch (err) {
      throw err;
    } finally {
      setLoadingList(false);
    }
  }, []);

  const loadAll = useCallback(async () => {
    setError("");

    try {
      await Promise.all([loadMetrics(filters), loadList(filters)]);
    } catch (err) {
      setError(
        err?.response?.data?.error ||
          err?.response?.data?.message ||
          err?.message ||
          "No se pudieron cargar las métricas de satisfacción."
      );
    }
  }, [filters, loadMetrics, loadList]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const totalResponses = metrics?.totalResponses || 0;
  const distribution = metrics?.distribution || {
    1: 0,
    2: 0,
    3: 0,
    4: 0,
    5: 0,
  };
  const recommendation = metrics?.recommendation || {
    yes: 0,
    maybe: 0,
    no: 0,
  };
  const byMonth = metrics?.byMonth || [];

  const maxMonthCount = useMemo(() => {
    if (!byMonth.length) return 0;
    return Math.max(...byMonth.map((m) => m.count || 0));
  }, [byMonth]);

  const totalPages = listData?.meta?.pages || 1;
  const currentPage = listData?.meta?.page || 1;

  return (
    <div className="layer-content space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Satisfacción del visitante</h1>
        <p className="text-sm opacity-75">
          Métricas reales de aceptación, comentarios y evolución mensual.
        </p>
      </div>

      <section className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-4">
        <h3 className="text-lg font-semibold">Filtros</h3>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
          <div>
            <label className="mb-1 block text-sm opacity-75">Desde</label>
            <input
              type="date"
              value={filters.from}
              onChange={(e) =>
                setFilters((prev) => ({ ...prev, from: e.target.value, page: 1 }))
              }
              className="w-full rounded-xl border border-white/10 bg-white/5 p-3 outline-none"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm opacity-75">Hasta</label>
            <input
              type="date"
              value={filters.to}
              onChange={(e) =>
                setFilters((prev) => ({ ...prev, to: e.target.value, page: 1 }))
              }
              className="w-full rounded-xl border border-white/10 bg-white/5 p-3 outline-none"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm opacity-75">Calificación</label>
            <select
              value={filters.rating}
              onChange={(e) =>
                setFilters((prev) => ({
                  ...prev,
                  rating: e.target.value,
                  page: 1,
                }))
              }
              className="w-full rounded-xl border border-white/10 bg-white/5 p-3 outline-none"
            >
              <option value="">Todas</option>
              <option value="5">5 estrellas</option>
              <option value="4">4 estrellas</option>
              <option value="3">3 estrellas</option>
              <option value="2">2 estrellas</option>
              <option value="1">1 estrella</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm opacity-75">Buscar</label>
            <input
              type="text"
              value={filters.q}
              onChange={(e) =>
                setFilters((prev) => ({ ...prev, q: e.target.value, page: 1 }))
              }
              placeholder="Visitante, correo, comentario..."
              className="w-full rounded-xl border border-white/10 bg-white/5 p-3 outline-none"
            />
          </div>

          <div className="flex items-end">
            <label className="inline-flex items-center gap-2 text-sm opacity-90">
              <input
                type="checkbox"
                checked={filters.withComment}
                onChange={(e) =>
                  setFilters((prev) => ({
                    ...prev,
                    withComment: e.target.checked,
                    page: 1,
                  }))
                }
              />
              Solo con comentario
            </label>
          </div>
        </div>
      </section>

      {!!error && (
        <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4">
          <p className="text-sm text-rose-400">{error}</p>
        </div>
      )}

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KPI
          title="Total respuestas"
          value={loadingMetrics ? "…" : totalResponses}
        />
        <KPI
          title="Promedio"
          value={loadingMetrics ? "…" : metrics?.averageRating ?? 0}
          subtitle="Escala de 1 a 5 estrellas"
        />
        <KPI
          title="Aceptación"
          value={loadingMetrics ? "…" : `${metrics?.acceptanceRate ?? 0}%`}
          subtitle="Respuestas con 4 o 5 estrellas"
        />
        <KPI
          title="Con comentario"
          value={loadingMetrics ? "…" : metrics?.commentedCount ?? 0}
        />
      </section>

      {!loadingMetrics && totalResponses > 0 && (
        <>
          <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-4">
              <h3 className="text-lg font-semibold">Distribución por estrellas</h3>

              {[5, 4, 3, 2, 1].map((n) => (
                <RatingBar
                  key={n}
                  label={`${n} estrella${n > 1 ? "s" : ""}`}
                  count={distribution[n] || 0}
                  total={totalResponses}
                />
              ))}
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-4">
              <h3 className="text-lg font-semibold">Recomendación</h3>

              <RatingBar
                label="Sí"
                count={recommendation.yes || 0}
                total={totalResponses}
              />
              <RatingBar
                label="Tal vez"
                count={recommendation.maybe || 0}
                total={totalResponses}
              />
              <RatingBar
                label="No"
                count={recommendation.no || 0}
                total={totalResponses}
              />
            </div>
          </section>

          <section className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-4">
            <h3 className="text-lg font-semibold">Evolución mensual</h3>

            {!byMonth.length ? (
              <p className="text-sm opacity-75">
                No hay datos mensuales disponibles.
              </p>
            ) : (
              <div className="space-y-4">
                {byMonth.map((item) => (
                  <MonthBar
                    key={`${item.year}-${item.month}`}
                    label={`${formatMonthLabel(item.year, item.month)} · Promedio ${item.averageRating}`}
                    count={item.count}
                    maxCount={maxMonthCount}
                  />
                ))}
              </div>
            )}
          </section>
        </>
      )}

      <section className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-lg font-semibold">Listado de respuestas</h3>

          <div className="text-sm opacity-75">
            {loadingList
              ? "Cargando..."
              : `${listData?.meta?.total || 0} respuesta(s)`}
          </div>
        </div>

        {loadingList ? (
          <p className="text-sm opacity-75">Cargando respuestas...</p>
        ) : !listData.items.length ? (
          <p className="text-sm opacity-75">
            No hay respuestas para los filtros seleccionados.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 text-left">
                  <th className="py-3 pr-4">Fecha</th>
                  <th className="py-3 pr-4">Visitante</th>
                  <th className="py-3 pr-4">Correo</th>
                  <th className="py-3 pr-4">Anfitrión</th>
                  <th className="py-3 pr-4">Empresa</th>
                  <th className="py-3 pr-4">Calificación</th>
                  <th className="py-3 pr-4">Recomienda</th>
                  <th className="py-3 pr-4">Comentario</th>
                </tr>
              </thead>

              <tbody>
                {listData.items.map((row) => {
                  const id = String(row?._id || row?.id || row?.visitaId || Math.random());
                  const dateValue = row?.answeredAt || row?.createdAt;

                  return (
                    <tr key={id} className="border-b border-white/5 align-top">
                      <td className="py-3 pr-4 whitespace-nowrap">
                        {dateValue
                          ? new Date(dateValue).toLocaleString("es-HN")
                          : "—"}
                      </td>
                      <td className="py-3 pr-4">{row?.visitorName || "—"}</td>
                      <td className="py-3 pr-4">{row?.visitorEmail || "—"}</td>
                      <td className="py-3 pr-4">{row?.hostName || "—"}</td>
                      <td className="py-3 pr-4">{row?.empresa || "—"}</td>
                      <td className="py-3 pr-4 whitespace-nowrap">
                        {renderStars(row?.rating || 0)}
                      </td>
                      <td className="py-3 pr-4">
                        {row?.wouldRecommend === "yes"
                          ? "Sí"
                          : row?.wouldRecommend === "maybe"
                          ? "Tal vez"
                          : row?.wouldRecommend === "no"
                          ? "No"
                          : "—"}
                      </td>
                      <td className="py-3 pr-4 max-w-[320px]">
                        {row?.comment || "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {!loadingList && totalPages > 1 && (
          <div className="flex items-center justify-between gap-3 pt-2">
            <button
              type="button"
              disabled={currentPage <= 1}
              onClick={() =>
                setFilters((prev) => ({
                  ...prev,
                  page: Math.max(1, prev.page - 1),
                }))
              }
              className="rounded-full px-4 py-2 text-sm font-semibold disabled:opacity-50"
              style={{
                background: "#1f2937",
                color: "#fff",
              }}
            >
              Anterior
            </button>

            <div className="text-sm opacity-75">
              Página {currentPage} de {totalPages}
            </div>

            <button
              type="button"
              disabled={currentPage >= totalPages}
              onClick={() =>
                setFilters((prev) => ({
                  ...prev,
                  page: Math.min(totalPages, prev.page + 1),
                }))
              }
              className="rounded-full px-4 py-2 text-sm font-semibold disabled:opacity-50"
              style={{
                background: "#1f2937",
                color: "#fff",
              }}
            >
              Siguiente
            </button>
          </div>
        )}
      </section>
    </div>
  );
}