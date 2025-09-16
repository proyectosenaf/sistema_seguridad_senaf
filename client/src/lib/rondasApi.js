import axios from "axios";

function computeApiBase() {
  const env = import.meta.env.VITE_API_BASE_URL;
  if (env) return env;
  const u = new URL(window.location.origin);
  if (u.port === "3000" || u.port === "5173") u.port = "4000";
  return `${u.origin}/api`;
}

export const baseURL = computeApiBase();
const api = axios.create({ baseURL, timeout: 8000 });

api.interceptors.response.use(
  (r) => r,
  (err) => {
    const msg = err?.response?.data?.error || err?.message || "Network Error";
    return Promise.reject(new Error(msg));
  }
);

export const RondasAPI = {
  async getRoutes() {
    try {
      const { data } = await api.get("/rondas/routes");
      return Array.isArray(data) ? data : [];
    } catch {
      return [];
    }
  },
  async getActive() {
    try {
      const { data } = await api.get("/rondas/shifts/active");
      return Array.isArray(data) ? data : [];
    } catch {
      return [];
    }
  },
  async startShift(routeId, guardId) {
    const { data } = await api.post("/rondas/shifts/start", { routeId, guardId });
    return data;
  },
  async finishShift(id) {
    const { data } = await api.post(`/rondas/shifts/${id}/finish`);
    return data;
  },
  async check(payload) {
    const { data } = await api.post("/rondas/check", payload);
    return data;
  },
};
