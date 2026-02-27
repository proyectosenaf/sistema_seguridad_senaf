// client/src/modules/controldeacceso/api/controlAccesoApi.js

const ROOT = (
  import.meta.env.VITE_API_BASE_URL || "http://localhost:8080/api"
).replace(/\/$/, "");

// Base del módulo de control de acceso (empleados, etc.)
const CONTROL_BASE = `${ROOT}/controldeacceso/v1`;

// Usaremos también el módulo de visitas para los vehículos de visitantes
const VISITAS_BASE = `${ROOT}/visitas/v1`;

async function handleJsonResponse(res) {
  if (!res.ok) {
    let msg = "Error de servidor";
    try {
      const data = await res.json();
      msg = data.message || msg;
    } catch (_) {}
    throw new Error(msg);
  }
  return res.json();
}

export const controlAccesoApi = {
  // 👉 Empleados (lo que ya tenías)
  async listarEmpleados() {
    const res = await fetch(`${CONTROL_BASE}/empleados`, {
      credentials: "include",
    });
    return handleJsonResponse(res);
  },

  async toggleEstadoEmpleado(idEmpleado) {
    const res = await fetch(`${CONTROL_BASE}/empleados/${idEmpleado}/toggle-estado`, {
      method: "PATCH",
      credentials: "include",
    });
    return handleJsonResponse(res);
  },

  // 👉 Vehículos de visitas dentro de la empresa
  async listarVehiculosVisitasEnSitio() {
    const res = await fetch(`${VISITAS_BASE}/vehiculos-en-sitio`, {
      credentials: "include",
    });
    return handleJsonResponse(res);
  },
};
