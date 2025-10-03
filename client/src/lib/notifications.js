import api from "./api"; // axios preconfigurado con baseURL = http://localhost:4000

export async function getNotificationCounts() {
  const { data } = await api.get("/api/notifications/counts");
  return data;
}
