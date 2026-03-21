export const API_BASE = (
  import.meta.env.VITE_API_BASE_URL ||
  import.meta.env.VITE_API_URL ||
  "http://localhost:8080/api"
).replace(/\/$/, "");

export const CATALOGS = {
  sexos: `${API_BASE}/catalogos/acceso/sexos`,
  estados: `${API_BASE}/catalogos/acceso/estados`,
  departamentos: `${API_BASE}/catalogos/acceso/departamentos`,
  cargos: `${API_BASE}/catalogos/acceso/cargos`,
  marcasVehiculos: `${API_BASE}/catalogos/vehiculos/marcas`,
  modelosVehiculos: `${API_BASE}/catalogos/vehiculos/modelos`,
};

export const PERMS = {
  READ: "accesos.records.read",
  WRITE: "accesos.records.write",
  EXPORT: "accesos.reports.export",
};

export const UI = {
  page: "space-y-6 layer-content",

  title: "text-xl sm:text-3xl font-semibold tracking-tight",
  subtitle: "mt-1 text-xs sm:text-sm",

  card: "rounded-[20px]",
  cardSoft: "rounded-[20px]",
  section: "rounded-[24px] overflow-hidden",
  sectionHeader:
    "px-4 py-3 flex flex-col gap-2 border-b sm:flex-row sm:items-center sm:justify-between",

  input:
    "w-full rounded-[14px] px-3 sm:px-4 py-2 text-sm outline-none transition",
  fieldInput:
    "w-full rounded-[12px] px-3 py-2 text-sm outline-none transition",
  fieldSelect:
    "w-full rounded-[12px] px-3 py-2 text-sm outline-none transition",

  tableWrap: "overflow-x-auto",
  table: "min-w-full text-xs sm:text-sm",
  thead: "text-left",
  tbody: "",
  rowHover: "transition-colors",

  mutedBox: "rounded-[14px] px-3 py-2 text-xs sm:text-sm",

  btnPrimary:
    "inline-flex items-center justify-center gap-2 rounded-[14px] px-3 py-2 text-xs sm:text-sm font-medium transition",
  btnSuccess:
    "inline-flex items-center justify-center gap-2 rounded-[14px] px-3 py-2 text-xs sm:text-sm font-medium transition",
  btnDanger:
    "inline-flex items-center justify-center gap-2 rounded-[14px] px-3 py-2 text-xs sm:text-sm font-medium transition",
  btnInfo:
    "inline-flex items-center justify-center gap-2 rounded-[14px] px-3 py-2 text-xs sm:text-sm font-medium transition",
  btnGhost: "px-4 py-2 rounded-[12px] text-sm transition",
  btnLink: "text-[11px] sm:text-xs transition-colors",

  modalOverlay:
    "fixed inset-0 z-[60] flex items-center justify-center px-3",
  modalOverlayHigh:
    "fixed inset-0 z-[70] flex items-center justify-center px-3",
  modalOverlayTop:
    "fixed inset-0 z-[75] flex items-center justify-center px-3",

  modalBox: "w-full rounded-[22px]",
  modalHeader:
    "flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4",

  label: "text-xs sm:text-sm",
  helper: "text-[11px] sm:text-xs",
  subtleBar: "px-4 py-2 text-[11px] sm:text-xs font-semibold uppercase",
};