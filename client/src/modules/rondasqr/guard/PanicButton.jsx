// client/src/modules/rondasqr/guard/PanicButton.jsx
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { rondasqrApi } from "../api/rondasqrApi.js";
import { emitLocalPanic } from "../utils/panicBus.js";
import { useAuth } from "../../../pages/auth/AuthProvider.jsx";

function resolvePrincipal(user) {
  if (!user || typeof user !== "object") return null;

  if (user.user && typeof user.user === "object") {
    return {
      ...user.user,
      can:
        user?.can && typeof user.can === "object"
          ? user.can
          : user?.user?.can && typeof user.user.can === "object"
          ? user.user.can
          : {},
      superadmin:
        user?.superadmin === true ||
        user?.isSuperAdmin === true ||
        user?.user?.superadmin === true ||
        user?.user?.isSuperAdmin === true,
    };
  }

  return {
    ...user,
    can: user?.can && typeof user.can === "object" ? user.can : {},
    superadmin: user?.superadmin === true || user?.isSuperAdmin === true,
  };
}

export default function PanicButton() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const principal = resolvePrincipal(user) || {};
  const [sending, setSending] = useState(false);

  async function sendPanic() {
    if (sending) return;

    setSending(true);
    try {
      let gps = null;

      if (typeof navigator !== "undefined" && "geolocation" in navigator) {
        gps = await new Promise((resolve) => {
          navigator.geolocation.getCurrentPosition(
            (p) =>
              resolve({
                lat: Number(p.coords.latitude),
                lon: Number(p.coords.longitude),
              }),
            () => resolve(null),
            { enableHighAccuracy: true, timeout: 5000 }
          );
        });
      }

      await rondasqrApi.panic(gps);

      emitLocalPanic({
        source: "panic_button",
        title: "🚨 Alerta de pánico",
        message: "Alerta de pánico enviada",
        user: principal?.name || principal?.email || "",
      });

      alert("🚨 Alerta de pánico enviada.");
      navigate("/rondasqr/scan", { replace: true });
    } catch (e) {
      console.error("[PanicButton] panic error:", e?.message || e);
      alert(
        e?.payload?.message ||
          e?.payload?.error ||
          e?.message ||
          "No se pudo enviar la alerta de pánico."
      );
    } finally {
      setSending(false);
    }
  }

  return (
    <button
      type="button"
      onClick={sendPanic}
      disabled={sending}
      className="bg-red-600 text-white px-6 py-4 rounded-2xl w-full disabled:opacity-60 disabled:cursor-not-allowed"
    >
      {sending ? "ENVIANDO..." : "ALERTA"}
    </button>
  );
}
