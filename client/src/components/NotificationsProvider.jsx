// client/src/components/NotificationsProvider.jsx
import React from "react";
import api from "../lib/api.js";
import { getSocket } from "../lib/notifications.js";

export const NotificationsContext = React.createContext(null);

export default function NotificationsProvider({ children }) {
  const [counts, setCounts] = React.useState({
    email: 0,
    message: 0,
    appointment: 0,
    total: 0,
  });

  React.useEffect(() => {
    let active = true;

    const applyTotal = (total) => {
      if (!active) return;
      const n = Number(total || 0);
      setCounts({
        email: 0,
        message: 0,
        appointment: 0,
        total: n,
      });
    };

    const fetchCounts = async () => {
      try {
        // baseURL = http://localhost:4000/api → /notifications/count
        const { data } = await api.get("/notifications/count");
        applyTotal(data?.count ?? 0);
      } catch {
        // silencioso
      }
    };

    // Carga inicial
    fetchCounts();

    // Socket
    const s = getSocket();
    const onCountUpdated = (payload) => {
      // Backend emite { count } desde notify.js
      if (
        payload &&
        typeof payload === "object" &&
        "count" in payload
      ) {
        applyTotal(payload.count);
        return;
      }

      // Soporta otros formatos antiguos si algún día los usaste
      if (
        payload &&
        typeof payload === "object" &&
        ("unread" in payload || "alerts" in payload)
      ) {
        const unread = Number(payload.unread || 0);
        const alerts = Number(payload.alerts || 0);
        const total = Number(payload.total ?? unread + alerts);
        if (!active) return;
        setCounts({
          email: 0,
          message: 0,
          appointment: 0,
          total,
          unread,
          alerts,
        });
        return;
      }

      if (
        payload &&
        typeof payload === "object" &&
        ("email" in payload ||
          "message" in payload ||
          "appointment" in payload)
      ) {
        if (!active) return;
        setCounts({
          email: Number(payload.email || 0),
          message: Number(payload.message || 0),
          appointment: Number(payload.appointment || 0),
          total: Number(payload.total || 0),
        });
        return;
      }

      // Si no reconocemos el payload, reconstruimos desde el backend
      fetchCounts();
    };

    s.on("notifications:count-updated", onCountUpdated);

    // Estos eventos extra son opcionales; si no los usas no pasa nada
    s.on("email:new", fetchCounts);
    s.on("message:new", fetchCounts);
    s.on("appointment:new", fetchCounts);

    return () => {
      active = false;
      s.off("notifications:count-updated", onCountUpdated);
      s.off("email:new", fetchCounts);
      s.off("message:new", fetchCounts);
      s.off("appointment:new", fetchCounts);
    };
  }, []);

  const clear = async () => {
    try {
      // backend: POST /api/notifications/read-all -> { ok, updated }
      await api.post("/notifications/read-all");
      setCounts({
        email: 0,
        message: 0,
        appointment: 0,
        total: 0,
      });
    } catch {
      // silencioso
    }
  };

  return (
    <NotificationsContext.Provider value={{ counts, clear }}>
      {children}
    </NotificationsContext.Provider>
  );
}
