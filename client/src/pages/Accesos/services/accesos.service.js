import { api } from "../../../lib/api";

export async function getAccesoItems() {
  try {
    const { data } = await api.get("/acceso/empleados-vehiculos");
    if (Array.isArray(data?.items)) return data.items;
  } catch {}

  const { data } = await api.get("/acceso/empleados");
  return Array.isArray(data?.items) ? data.items : [];
}

export async function getVehiculosVisitas() {
  const { data } = await api.get("/visitas/vehiculos-en-sitio");
  return Array.isArray(data?.items) ? data.items : [];
}

export async function getMovimientosManual() {
  const { data } = await api.get("/acceso/movimientos-manual");
  return Array.isArray(data?.items) ? data.items : [];
}

export async function createMovimientoManual(body) {
  const { data } = await api.post("/acceso/movimientos-manual", body);
  return data;
}

export async function patchVehiculoEnEmpresa(id, enEmpresa) {
  const { data } = await api.patch(`/acceso/vehiculos/${encodeURIComponent(id)}/en-empresa`, {
    enEmpresa,
  });
  return data;
}

export async function deleteEmpleado(id) {
  const { data } = await api.delete(`/acceso/empleados/${encodeURIComponent(id)}`);
  return data;
}