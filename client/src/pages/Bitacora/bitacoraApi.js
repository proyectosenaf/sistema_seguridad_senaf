import { api } from "../../lib/api"; // o como tengas configurado tu cliente

export async function fetchBitacora(params = {}) {
  const qs = new URLSearchParams(params).toString();
  const { data } = await api.get(`/bitacora/v1/events?${qs}`);
  return data;
}
