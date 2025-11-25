// src/modules/rondasqr/guard/IncidentForm.jsx
import React from "react";
import IncidenteForm from "../../incidentes/IncidenteForm.jsx";

/**
 * Este componente NO tiene lógica propia.
 * Solo reutiliza el mismo formulario general de incidentes,
 * pero ajustado para usarse dentro del módulo de Rondas.
 */
export default function IncidentFormGuard({ roundId, siteId }) {
  return (
    <div className="mt-4">
      <IncidenteForm
        // ✅ No navegar a /incidentes/lista al terminar, solo limpiar
        stayOnFinish={true}
        // ✅ Marcamos el origen para que el backend sepa que vino de una ronda
        origin="ronda"
        // ✅ Aquí puedes mandar info extra de la ronda
        extraData={{
          fromRonda: true,
          roundId: roundId || null,
          siteId: siteId || null,
        }}
      />
    </div>
  );
}
