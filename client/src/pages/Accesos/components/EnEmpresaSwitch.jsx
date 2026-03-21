function Pill({ ok, disabled, onClick, okText = "Sí", noText = "No" }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] sm:text-xs transition ${
        disabled ? "opacity-50 cursor-not-allowed" : ""
      }`}
      style={{
        background: ok
          ? "color-mix(in srgb, #22c55e 12%, transparent)"
          : "color-mix(in srgb, #ef4444 12%, transparent)",
        color: ok ? "#16a34a" : "#dc2626",
      }}
    >
      <span
        className="h-2.5 w-2.5 rounded-full"
        style={{ background: ok ? "#16a34a" : "#dc2626" }}
      />
      {ok ? okText : noText}
    </button>
  );
}

export default function EnEmpresaSwitch({ value, onChange, disabled }) {
  return (
    <div className="flex items-center gap-1 sm:gap-2">
      <Pill
        ok={!!value}
        disabled={disabled}
        onClick={() => {
          if (!disabled) onChange(!value);
        }}
        okText="Sí"
        noText="No"
      />

      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          if (!disabled) onChange(!value);
        }}
        title="Cambiar estado de En Empresa"
        className="focus:outline-none"
        style={{ cursor: disabled ? "not-allowed" : "pointer" }}
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 64 64"
          xmlns="http://www.w3.org/2000/svg"
          className="w-4 h-4 sm:w-5 sm:h-5 animate-bounce"
        >
          <rect width="64" height="64" fill="#0A0F24" />
          <g
            stroke="#2DC4B6"
            strokeWidth="4"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          >
            <polyline points="20 36 32 24 44 36" />
            <polyline points="20 28 32 40 44 28" />
          </g>
        </svg>
      </button>
    </div>
  );
}