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
        stayOnFinish={true}
        origin="ronda"
        prefillZone="gps"        // ✅ autollenado de zona (GPS)
        prefillReporter="auth0"  // ✅ autoselección del guardia por email Auth0
        extraData={{
          fromRonda: true,
          roundId: roundId || null,
          siteId: siteId || null,
        }}
      />
    </div>
  );
}
