// client/src/lib/apiRoutes.js
import axios from "axios";
import dayjs from "dayjs";

const API = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000/api";

export function routesApi(tokenGetter) {
  const client = axios.create({ baseURL: `${API}/routes` });
  client.interceptors.request.use(async (cfg) => {
    const token = await tokenGetter?.();
    if (token) cfg.headers.Authorization = `Bearer ${token}`;
    return cfg;
  });

  return {
    list: (params) => client.get("/", { params }).then(r => r.data),
    get: (id) => client.get(`/${id}`).then(r => r.data),
    create: (payload) => client.post("/", payload).then(r => r.data),
    update: (id, payload) => client.patch(`/${id}`, payload).then(r => r.data),
    remove: (id) => client.delete(`/${id}`).then(r => r.data),
    upsertCheckpoint: (id, cp) => client.put(`/${id}/checkpoints`, cp).then(r => r.data),
    deleteCheckpoint: (id, code) => client.delete(`/${id}/checkpoints`, { params:{ code }}).then(r => r.data),
  };
}

export function reportsApi(tokenGetter) {
  const client = axios.create({ baseURL: `${API}/reports-advanced` });
  client.interceptors.request.use(async (cfg) => {
    const token = await tokenGetter?.();
    if (token) cfg.headers.Authorization = `Bearer ${token}`;
    return cfg;
  });

  return {
    sla: (from, to, routeId) => client.get("/sla", { params: { from, to, routeId } }).then(r => r.data),
    slaExcelUrl: (from, to, routeId) =>
      `${API}/reports-advanced/sla.xlsx?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}${routeId?`&routeId=${routeId}`:""}`,
    slaPdfUrl: (from, to, routeId) =>
      `${API}/reports-advanced/sla.pdf?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}${routeId?`&routeId=${routeId}`:""}`,
  };
}
