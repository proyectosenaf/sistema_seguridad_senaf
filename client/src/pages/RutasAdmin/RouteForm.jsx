import React from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import api from "/src/lib/api.js";

const emptyCp = () => ({
  code: "",
  name: "",
  order: 0,
  expectedSecondsFromStart: 0,
  graceSeconds: 120,
  allowedMethods: [],
  requirePhoto: false,
  requireNote: false,
  tags: "",
});

export default function RouteForm() {
  const { id } = useParams(); // si hay id => edición
  const nav = useNavigate();

  const [loading, setLoading] = React.useState(!!id);
  const [saving, setSaving] = React.useState(false);
  const [err, setErr] = React.useState("");

  const [form, setForm] = React.useState({
    siteId: "",
    name: "",
    code: "",
    active: true,
    sla: { lateThresholdSeconds: 180, missingThresholdSeconds: 600 },
    checkpoints: [emptyCp()],
    windows: [],
  });

  // Cargar ruta si es edición
  React.useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const { data } = await api.get(`/api/routes/${id}`);
        setForm({
          siteId: data.siteId || "",
          name: data.name || "",
          code: data.code || "",
          active: data.active ?? true,
          sla: {
            lateThresholdSeconds: data?.sla?.lateThresholdSeconds ?? 180,
            missingThresholdSeconds: data?.sla?.missingThresholdSeconds ?? 600,
          },
          checkpoints: (data.checkpoints || []).map((c) => ({
            code: c.code || "",
            name: c.name || "",
            order: c.order ?? 0,
            expectedSecondsFromStart: c.expectedSecondsFromStart ?? 0,
            graceSeconds: c.graceSeconds ?? 120,
            allowedMethods: Array.isArray(c.allowedMethods) ? c.allowedMethods : [],
            requirePhoto: !!c.requirePhoto,
            requireNote: !!c.requireNote,
            tags: Array.isArray(c.tags) ? c.tags.join(", ") : (c.tags || ""),
          })),
          windows: data.windows || [],
        });
      } catch (e) {
        setErr(e?.response?.data?.error || e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  // Helpers UI
  const setField = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const setSla = (k, v) =>
    setForm((f) => ({ ...f, sla: { ...(f.sla || {}), [k]: v } }));

  const setCp = (idx, patch) =>
    setForm((f) => {
      const cps = [...(f.checkpoints || [])];
      cps[idx] = { ...cps[idx], ...patch };
      return { ...f, checkpoints: cps };
    });

  const addCp = () =>
    setForm((f) => ({ ...f, checkpoints: [...(f.checkpoints || []), emptyCp()] }));

  const delCp = (idx) =>
    setForm((f) => {
      const cps = [...(f.checkpoints || [])];
      cps.splice(idx, 1);
      return { ...f, checkpoints: cps.length ? cps : [emptyCp()] };
    });

  const toggleMethod = (idx, m) =>
    setCp(idx, {
      allowedMethods: (form.checkpoints[idx].allowedMethods || []).includes(m)
        ? form.checkpoints[idx].allowedMethods.filter((x) => x !== m)
        : [...(form.checkpoints[idx].allowedMethods || []), m],
    });

  const normalizePayload = () => {
    // Limpieza básica
    const cps = (form.checkpoints || [])
      .map((c, i) => ({
        code: c.code.trim(),
        name: c.name.trim(),
        order: Number.isFinite(+c.order) ? +c.order : i,
        expectedSecondsFromStart: Number(c.expectedSecondsFromStart) || 0,
        graceSeconds: Number(c.graceSeconds) || 120,
        allowedMethods: c.allowedMethods || [],
        requirePhoto: !!c.requirePhoto,
        requireNote: !!c.requireNote,
        tags: (c.tags || "")
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
      }))
      .filter((c) => c.code && c.name);

    return {
      siteId: form.siteId || undefined,
      name: form.name.trim(),
      code: form.code?.trim() || undefined,
      active: !!form.active,
      sla: {
        lateThresholdSeconds: Number(form?.sla?.lateThresholdSeconds) || 180,
        missingThresholdSeconds: Number(form?.sla?.missingThresholdSeconds) || 600,
      },
      checkpoints: cps.sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
      windows: form.windows || [],
    };
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setErr("");
    const payload = normalizePayload();

    if (!payload.name) {
      setErr("El nombre es obligatorio.");
      return;
    }
    if (!payload.checkpoints?.length) {
      setErr("Agrega al menos un checkpoint con código y nombre.");
      return;
    }

    try {
      setSaving(true);
      if (id) {
        await api.put(`/api/routes/${id}`, payload);
      } else {
        await api.post("/api/routes", payload);
      }
      nav("/rutas-admin");
    } catch (e) {
      setErr(e?.response?.data?.error || e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="text-2xl font-semibold">{id ? "Editar ruta" : "Nueva ruta"}</div>
        <Link
          to="/rutas-admin"
          className="text-sm underline opacity-80 hover:opacity-100"
        >
          Volver al listado
        </Link>
      </div>

      {err && (
        <div className="p-3 rounded-lg bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-100">
          {err}
        </div>
      )}

      <form onSubmit={onSubmit} className="grid lg:grid-cols-3 gap-6">
        {/* Columna 1: Datos generales */}
        <div className="p-5 rounded-2xl border dark:border-neutral-800 bg-white/70 dark:bg-neutral-950/40 backdrop-blur space-y-3">
          {loading ? (
            <div className="opacity-60">Cargando…</div>
          ) : (
            <>
              <div>
                <div className="text-sm opacity-70 mb-1">SiteId (opcional)</div>
                <input
                  className="w-full border rounded p-2 bg-white dark:bg-neutral-900"
                  value={form.siteId}
                  onChange={(e) => setField("siteId", e.target.value)}
                  placeholder="ObjectId del sitio (opcional)"
                />
              </div>
              <div>
                <div className="text-sm opacity-70 mb-1">Nombre</div>
                <input
                  className="w-full border rounded p-2 bg-white dark:bg-neutral-900"
                  value={form.name}
                  onChange={(e) => setField("name", e.target.value)}
                  placeholder="Ej. Perímetro General – Noche"
                  required
                />
              </div>
              <div>
                <div className="text-sm opacity-70 mb-1">Código (opcional)</div>
                <input
                  className="w-full border rounded p-2 bg-white dark:bg-neutral-900"
                  value={form.code}
                  onChange={(e) => setField("code", e.target.value)}
                  placeholder="Ej. R-PERIM-NOCHE"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  id="active"
                  type="checkbox"
                  checked={!!form.active}
                  onChange={(e) => setField("active", e.target.checked)}
                />
                <label htmlFor="active">Activa</label>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <div>
                  <div className="text-sm opacity-70 mb-1">SLA: Límite “late” (seg)</div>
                  <input
                    type="number"
                    min="0"
                    className="w-full border rounded p-2 bg-white dark:bg-neutral-900"
                    value={form.sla?.lateThresholdSeconds ?? 180}
                    onChange={(e) => setSla("lateThresholdSeconds", Number(e.target.value))}
                  />
                </div>
                <div>
                  <div className="text-sm opacity-70 mb-1">SLA: “missing” (seg)</div>
                  <input
                    type="number"
                    min="0"
                    className="w-full border rounded p-2 bg-white dark:bg-neutral-900"
                    value={form.sla?.missingThresholdSeconds ?? 600}
                    onChange={(e) => setSla("missingThresholdSeconds", Number(e.target.value))}
                  />
                </div>
              </div>
            </>
          )}
        </div>

        {/* Columna 2 y 3: Checkpoints */}
        <div className="lg:col-span-2 p-5 rounded-2xl border dark:border-neutral-800 bg-white/70 dark:bg-neutral-950/40 backdrop-blur">
          <div className="flex items-center justify-between mb-3">
            <div className="text-lg font-semibold">Checkpoints</div>
            <button
              type="button"
              onClick={addCp}
              className="px-3 py-1.5 rounded bg-emerald-600 text-white hover:bg-emerald-700"
            >
              Agregar
            </button>
          </div>

          <div className="space-y-4">
            {(form.checkpoints || []).map((c, idx) => (
              <div
                key={idx}
                className="p-4 rounded-xl border dark:border-neutral-800 bg-black/5 dark:bg-white/5"
              >
                <div className="grid md:grid-cols-5 gap-3">
                  <div>
                    <div className="text-xs opacity-70 mb-1">Código</div>
                    <input
                      className="w-full border rounded p-2 bg-white dark:bg-neutral-900"
                      value={c.code}
                      onChange={(e) => setCp(idx, { code: e.target.value })}
                      placeholder="Ej. A1"
                      required
                    />
                  </div>
                  <div className="md:col-span-2">
                    <div className="text-xs opacity-70 mb-1">Nombre</div>
                    <input
                      className="w-full border rounded p-2 bg-white dark:bg-neutral-900"
                      value={c.name}
                      onChange={(e) => setCp(idx, { name: e.target.value })}
                      placeholder="Ej. Portón Norte"
                      required
                    />
                  </div>
                  <div>
                    <div className="text-xs opacity-70 mb-1">Orden</div>
                    <input
                      type="number"
                      className="w-full border rounded p-2 bg-white dark:bg-neutral-900"
                      value={c.order}
                      onChange={(e) => setCp(idx, { order: Number(e.target.value) })}
                    />
                  </div>
                  <div>
                    <div className="text-xs opacity-70 mb-1">ETA desde inicio (seg)</div>
                    <input
                      type="number"
                      className="w-full border rounded p-2 bg-white dark:bg-neutral-900"
                      value={c.expectedSecondsFromStart}
                      onChange={(e) =>
                        setCp(idx, { expectedSecondsFromStart: Number(e.target.value) })
                      }
                    />
                  </div>
                </div>

                <div className="grid md:grid-cols-4 gap-3 mt-3">
                  <div>
                    <div className="text-xs opacity-70 mb-1">Tolerancia (seg)</div>
                    <input
                      type="number"
                      className="w-full border rounded p-2 bg-white dark:bg-neutral-900"
                      value={c.graceSeconds}
                      onChange={(e) => setCp(idx, { graceSeconds: Number(e.target.value) })}
                    />
                  </div>

                  <div className="md:col-span-2">
                    <div className="text-xs opacity-70 mb-1">Métodos permitidos</div>
                    <div className="flex flex-wrap gap-2">
                      {["qr", "nfc", "finger"].map((m) => (
                        <label
                          key={m}
                          className={`px-2 py-1 rounded border cursor-pointer select-none ${
                            (c.allowedMethods || []).includes(m)
                              ? "bg-emerald-600 text-white border-emerald-700"
                              : "border-neutral-300 dark:border-neutral-700"
                          }`}
                        >
                          <input
                            type="checkbox"
                            className="hidden"
                            checked={(c.allowedMethods || []).includes(m)}
                            onChange={() => toggleMethod(idx, m)}
                          />
                          {m.toUpperCase()}
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <label className="inline-flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={!!c.requirePhoto}
                        onChange={(e) => setCp(idx, { requirePhoto: e.target.checked })}
                      />
                      Foto
                    </label>
                    <label className="inline-flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={!!c.requireNote}
                        onChange={(e) => setCp(idx, { requireNote: e.target.checked })}
                      />
                      Nota
                    </label>
                  </div>
                </div>

                <div className="mt-3">
                  <div className="text-xs opacity-70 mb-1">Tags (coma separadas)</div>
                  <input
                    className="w-full border rounded p-2 bg-white dark:bg-neutral-900"
                    value={c.tags}
                    onChange={(e) => setCp(idx, { tags: e.target.value })}
                    placeholder="entrada, vehiculos"
                  />
                </div>

                <div className="mt-3 text-right">
                  <button
                    type="button"
                    onClick={() => delCp(idx)}
                    className="px-3 py-1.5 rounded bg-rose-600 text-white hover:bg-rose-700"
                  >
                    Eliminar
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Acciones */}
        <div className="lg:col-span-3 flex items-center gap-3">
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 rounded bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-60"
          >
            {saving ? "Guardando…" : "Guardar"}
          </button>
          <button
            type="button"
            onClick={() => nav("/rutas-admin")}
            className="px-4 py-2 rounded border dark:border-neutral-700"
          >
            Cancelar
          </button>
        </div>
      </form>
    </div>
  );
}
