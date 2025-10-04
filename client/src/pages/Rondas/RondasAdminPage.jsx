import React, { useEffect, useState } from "react";
import { useRondasApi } from "../../hooks/useRondasApi";

// ⬅️ este componente vive en /src/components
import RondasCheckpointCard from "../../components/RondasCheckpointCard";

// estos dos sí están en la misma carpeta /pages/Rondas
import RondasPlansPanel from "./RondasPlansPanel";
import RondasPlanForm from "./RondasPlanForm";

export default function RondasAdminPage() {
  const api = useRondasApi();

  const [zones, setZones] = useState([]);
  const [activeZone, setActiveZone] = useState(null);
  const [cps, setCps] = useState([]);
  const [loading, setLoading] = useState(false);

  // estado del modal (crear/editar plan)
  const [formState, setFormState] = useState({
    open: false,
    mode: "create",
    zone: null,
    plan: null,
  });

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const z = await api.listZones();
        setZones(z || []);
        if (z?.length) {
          setActiveZone(z[0]);
          const c = await api.zoneCheckpoints(z[0]._id);
          setCps(c || []);
        }
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function openZone(z) {
    setActiveZone(z);
    const c = await api.zoneCheckpoints(z._id);
    setCps(c || []);
  }

  function onOpenForm({ mode, zone, plan }) {
    setFormState({
      open: true,
      mode,
      zone: zone || activeZone,
      plan: plan || null,
    });
  }

  function closeForm() {
    setFormState((s) => ({ ...s, open: false }));
  }

  return (
    <section className="space-y-6">
      <header>
        <h1 className="text-2xl md:text-3xl font-bold">Rondas – Administración</h1>
        <p className="text-neutral-400 mt-1">
          Configura zonas, puntos de control (QR) y planes de ronda.
        </p>
      </header>

      <div className="grid md:grid-cols-3 gap-4">
        {/* Zonas */}
        <aside className="md:col-span-1 rounded-2xl border border-neutral-800 bg-neutral-900/40 p-4">
          <div className="text-sm text-neutral-400 mb-2">Zonas</div>
          <div className="space-y-2">
            {zones.map((z) => (
              <button
                key={z._id}
                onClick={() => openZone(z)}
                className={`w-full text-left px-3 py-2 rounded-xl border transition ${
                  activeZone?._id === z._id
                    ? "border-primary/60 bg-primary/10"
                    : "border-neutral-800 hover:border-neutral-700"
                }`}
              >
                <div className="font-medium">{z.name}</div>
                <div className="text-xs text-neutral-400">{z.code}</div>
              </button>
            ))}
            {loading && (
              <div className="text-sm text-neutral-400">Cargando…</div>
            )}
          </div>
        </aside>

        {/* Puntos + Planes */}
        <div className="md:col-span-2 space-y-4">
          <div className="rounded-2xl border border-neutral-800 bg-neutral-900/40 p-4">
            <div className="text-sm text-neutral-400 mb-3">
              {activeZone
                ? `Puntos de control — ${activeZone.name}`
                : "Selecciona una zona"}
            </div>
            <div className="grid gap-2">
              {cps.map((cp) => (
                <RondasCheckpointCard
                  key={cp._id}
                  cp={cp}
                  onOpenQR={(cp) => {
                    const url = `${
                      import.meta.env.VITE_API_BASE_URL ||
                      "http://localhost:4000"
                    }/api/rondas/v1/checkpoints/${cp._id}/qr?format=png`;
                    window.open(url, "_blank");
                  }}
                />
              ))}
              {!activeZone && (
                <div className="text-neutral-500 text-sm">
                  No hay zona seleccionada.
                </div>
              )}
            </div>
          </div>

          {/* Panel de planes de ronda */}
          <RondasPlansPanel
            zone={activeZone}
            api={{
              listPlans: api.listPlans,
              createPlan: api.createPlan,
              updatePlan: api.updatePlan,
              deletePlan: api.deletePlan,
            }}
            onOpenForm={onOpenForm}
          />
        </div>
      </div>

      {/* Modal crear/editar */}
      <RondasPlanForm
        open={formState.open}
        mode={formState.mode}
        zone={formState.zone}
        plan={formState.plan}
        api={{
          createPlan: api.createPlan,
          updatePlan: api.updatePlan,
        }}
        onClose={closeForm}
        onSaved={() => {
          // Si quieres forzar refresco del panel al guardar,
          // puedes manejar un "key" o levantar un estado para que RondasPlansPanel recargue.
        }}
      />
    </section>
  );
}
