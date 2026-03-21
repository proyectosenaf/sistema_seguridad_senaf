import { UI } from "../utils/accesos.constants.js";
import {
  sxCard,
  sxGhostBtn,
  sxInput,
  sxSuccessBtn,
} from "../utils/accesos.helpers.js";

export default function ObservacionMovimientoModal({
  open,
  obsTipo,
  obsFila,
  obsValue,
  setObsValue,
  onClose,
  onSave,
}) {
  if (!open) return null;

  return (
    <div
      className={UI.modalOverlayTop}
      style={{ background: "rgba(2, 6, 23, 0.5)" }}
    >
      <div
        className="w-full max-w-md rounded-[22px] p-4 sm:p-6"
        style={sxCard()}
      >
        <h2
          className="text-base sm:text-lg font-semibold mb-3 sm:mb-4"
          style={{ color: "var(--text)" }}
        >
          {obsTipo === "ENTRADA" ? "Registrar entrada" : "Registrar salida"}
        </h2>

        <p
          className="text-xs sm:text-sm mb-3"
          style={{ color: "var(--text-muted)" }}
        >
          {obsFila?.empleado?.nombreCompleto || ""}
        </p>

        <div className="space-y-2">
          <label className="block text-sm" style={{ color: "var(--text-muted)" }}>
            Observación
          </label>
          <textarea
            className={UI.fieldInput}
            style={sxInput()}
            rows={3}
            placeholder="Escribe una observación (opcional)"
            value={obsValue}
            onChange={(e) => setObsValue(e.target.value)}
          />
        </div>

        <div className="flex flex-col sm:flex-row justify-end gap-2 mt-4">
          <button
            type="button"
            className={UI.btnGhost}
            style={sxGhostBtn()}
            onClick={onClose}
          >
            Cancelar
          </button>

          <button
            type="button"
            className={UI.btnSuccess}
            style={sxSuccessBtn()}
            onClick={onSave}
          >
            Guardar
          </button>
        </div>
      </div>
    </div>
  );
}