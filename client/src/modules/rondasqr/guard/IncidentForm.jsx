// src/modules/rondasqr/guard/IncidentForm.jsx
import React from "react";
import IncidenteForm from "../../incidentes/IncidenteForm.jsx";

/**
 * Wrapper para reutilizar el formulario general de incidentes
 * dentro del módulo de RondasQR, sin navegar fuera del flujo.
 */
export default function IncidentFormGuard({ roundId, siteId }) {
  return (
    <div className="mt-4">
      <IncidenteForm
        stayOnFinish={true} // ✅ al terminar solo limpia
        origin="ronda"
        extraData={{
          fromRonda: true,
          roundId: roundId || null,
          siteId: siteId || null,
        }}
      />
    </div>
  );
}
