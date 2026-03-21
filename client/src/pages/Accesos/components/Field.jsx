import { UI } from "../utils/accesos.constants.js";

export default function Field({ label, children, span = 1 }) {
  return (
    <div className={`space-y-1.5 ${span === 2 ? "md:col-span-2" : ""}`}>
      <label className={UI.label} style={{ color: "var(--text-muted)" }}>
        {label}
      </label>
      {children}
    </div>
  );
}