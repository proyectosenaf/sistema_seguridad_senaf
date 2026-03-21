export function sxCard(extra = {}) {
  return {
    background: "color-mix(in srgb, var(--card) 90%, transparent)",
    border: "1px solid var(--border)",
    boxShadow: "var(--shadow-md)",
    backdropFilter: "blur(12px) saturate(130%)",
    WebkitBackdropFilter: "blur(12px) saturate(130%)",
    ...extra,
  };
}

export function sxCardSolid(extra = {}) {
  return {
    background: "color-mix(in srgb, var(--card-solid) 90%, transparent)",
    border: "1px solid var(--border)",
    boxShadow: "var(--shadow-sm)",
    ...extra,
  };
}

export function sxInput(extra = {}) {
  return {
    background: "var(--input-bg)",
    color: "var(--text)",
    border: "1px solid var(--input-border)",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,.04)",
    ...extra,
  };
}

export function sxGhostBtn(extra = {}) {
  return {
    background: "color-mix(in srgb, var(--card-solid) 88%, transparent)",
    color: "var(--text)",
    border: "1px solid var(--border)",
    boxShadow: "var(--shadow-sm)",
    ...extra,
  };
}

export function sxPrimaryBtn(extra = {}) {
  return {
    background: "linear-gradient(135deg, #2563eb, #06b6d4)",
    color: "#fff",
    border: "1px solid transparent",
    boxShadow: "0 10px 20px color-mix(in srgb, #2563eb 22%, transparent)",
    ...extra,
  };
}

export function sxSuccessBtn(extra = {}) {
  return {
    background: "linear-gradient(135deg, #16a34a, #22c55e)",
    color: "#fff",
    border: "1px solid transparent",
    boxShadow: "0 10px 20px color-mix(in srgb, #16a34a 22%, transparent)",
    ...extra,
  };
}

export function sxDangerBtn(extra = {}) {
  return {
    background: "linear-gradient(135deg, #dc2626, #ef4444)",
    color: "#fff",
    border: "1px solid transparent",
    boxShadow: "0 10px 20px color-mix(in srgb, #dc2626 22%, transparent)",
    ...extra,
  };
}

export function sxInfoBtn(extra = {}) {
  return {
    background: "linear-gradient(135deg, #0891b2, #06b6d4)",
    color: "#fff",
    border: "1px solid transparent",
    boxShadow: "0 10px 20px color-mix(in srgb, #0891b2 22%, transparent)",
    ...extra,
  };
}

export function sxMutedBox(extra = {}) {
  return {
    background: "color-mix(in srgb, #ef4444 10%, var(--card-solid))",
    color: "#dc2626",
    border: "1px solid color-mix(in srgb, #ef4444 30%, var(--border))",
    ...extra,
  };
}

export function sxSectionBar(extra = {}) {
  return {
    background: "color-mix(in srgb, var(--panel) 78%, transparent)",
    color: "var(--text-muted)",
    borderBottom: "1px solid var(--border)",
    ...extra,
  };
}

export function normalizeCatalogItems(data) {
  const raw = Array.isArray(data)
    ? data
    : Array.isArray(data?.items)
    ? data.items
    : Array.isArray(data?.data)
    ? data.data
    : [];

  return raw
    .map((item) => {
      if (typeof item === "string") return item.trim();
      return String(
        item?.label ??
          item?.name ??
          item?.nombre ??
          item?.value ??
          item?.codigo ??
          ""
      ).trim();
    })
    .filter(Boolean);
}

export async function fetchCatalog(url) {
  const res = await fetch(url, {
    credentials: "include",
    headers: { Accept: "application/json" },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data?.ok === false) {
    throw new Error(data?.error || "No se pudo cargar catálogo");
  }
  return normalizeCatalogItems(data);
}

export function normalizeItems(employeesRaw) {
  const employees = Array.isArray(employeesRaw) ? employeesRaw : [];
  const rows = [];

  for (const e of employees) {
    const empleado = {
      _id: e._id,
      nombreCompleto: e.nombreCompleto || e.nombre || "",
      id_persona:
        e.id_persona || e.idPersona || e.codigoInterno || e.idInterno || "",
      departamento: e.departamento || e.depto || "",
      fotoUrl: e.foto_empleado || e.fotoUrl || e.foto || "",
      activo: typeof e.activo === "boolean" ? e.activo : true,
      dni: e.dni || "",
      sexo: e.sexo || "",
      direccion: e.direccion || "",
      telefono: e.telefono || "",
      cargo: e.cargo || "",
      fechaNacimiento: e.fechaNacimiento || "",
      fechaIngreso: e.fechaIngreso || "",
    };

    const vehs = Array.isArray(e.vehiculos) ? e.vehiculos : [];

    if (vehs.length === 0) {
      rows.push({ _id: `${e._id}-no-veh`, empleado, vehiculo: null });
      continue;
    }

    for (const v of vehs) {
      rows.push({
        _id: `${e._id}-${v._id || v.placa || Math.random().toString(36).slice(2)}`,
        empleado,
        vehiculo: {
          _id: v._id,
          modelo: v.modelo || v.marcaModelo || v.marca || "",
          placa: v.placa || v.noPlaca || "",
          enEmpresa: typeof v.enEmpresa === "boolean" ? v.enEmpresa : false,
        },
      });
    }
  }

  return rows;
}

export function formatDateTime(date) {
  const d = new Date(date);
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  const hours = String(d.getHours()).padStart(2, "0");
  const minutes = String(d.getMinutes()).padStart(2, "0");
  return `${day}/${month}/${year} ${hours}:${minutes}`;
}

export function formatDniInput(raw) {
  const digits = String(raw || "").replace(/\D/g, "");
  if (!digits) return "";
  const part1 = digits.slice(0, 4);
  const part2 = digits.slice(4, 8);
  const part3 = digits.slice(8, 13);
  if (digits.length <= 4) return part1;
  if (digits.length <= 8) return `${part1}-${part2}`;
  return `${part1}-${part2}-${part3}`;
}

export function formatTelefonoInput(raw) {
  const digits = String(raw || "").replace(/\D/g, "");
  if (!digits) return "";
  const part1 = digits.slice(0, 4);
  const part2 = digits.slice(4, 8);
  if (digits.length <= 4) return part1;
  return `${part1}-${part2}`;
}

export function safeVehiculoVisitaKey(v, idx) {
  return v?.id || v?._id || v?.placa || `veh-vis-${idx}`;
}