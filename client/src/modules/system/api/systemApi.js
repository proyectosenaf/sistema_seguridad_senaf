import api from "../../../lib/api.js";

export const systemApi = {
  async listBackups() {
    const { data } = await api.get("/system/backups");
    return data;
  },

  async createBackup() {
    const { data } = await api.post("/system/backups/create");
    return data;
  },

  async restoreBackup(name) {
    const { data } = await api.post("/system/backups/restore", { name });
    return data;
  },

  async deleteBackup(name) {
    const { data } = await api.delete(
      `/system/backups/${encodeURIComponent(name)}`
    );
    return data;
  },

  async downloadBackup(name) {
    const response = await api.get(
      `/system/backups/download/${encodeURIComponent(name)}`,
      {
        responseType: "blob",
      }
    );

    return response.data;
  },
};

export default systemApi;