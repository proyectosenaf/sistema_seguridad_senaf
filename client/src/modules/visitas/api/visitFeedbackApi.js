import api from "../../../lib/api.js";

export const visitFeedbackApi = {
  async getPendingMine() {
    const { data } = await api.get("/visitas/v1/feedback/mine/pending");
    return data?.items || [];
  },

  async submit(payload) {
    const { data } = await api.post("/visitas/v1/feedback", payload);
    return data?.item || null;
  },

  async getMetrics(params = {}) {
    const { data } = await api.get("/visitas/v1/feedback/metrics", {
      params,
    });
    return data?.item || null;
  },

  async list(params = {}) {
    const { data } = await api.get("/visitas/v1/feedback/list", {
      params,
    });

    return {
      items: data?.items || [],
      meta: data?.meta || {
        page: 1,
        limit: 20,
        total: 0,
        pages: 0,
      },
      ok: !!data?.ok,
    };
  },
};