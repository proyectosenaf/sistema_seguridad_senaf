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
      ...user,
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
      isSuperAdmin:
        user?.isSuperAdmin === true ||
        user?.superadmin === true ||
        user?.user?.isSuperAdmin === true ||
        user?.user?.superadmin === true,
    };
  }

  return {
    ...user,
    can: user?.can && typeof user.can === "object" ? user.can : {},
    superadmin: user?.superadmin === true || user?.isSuperAdmin === true,
    isSuperAdmin: user?.isSuperAdmin === true || user?.superadmin === true,
  };
}

function toFixedNumber(value, digits = 6) {
  const num = Number(value);
  if (!Number.isFinite(num)) return null;
  return Number(num.toFixed(digits));
}

function buildGuardIdentity(user) {
  const id = user?._id || user?.id || user?.sub || null;
  const name =
    user?.fullName ||
    user?.nombre ||
    user?.name ||
    user?.displayName ||
    user?.username ||
    "";
  const email = user?.email || "";
  const role =
    user?.role?.name ||
    user?.role?.label ||
    user?.role ||
    (Array.isArray(user?.roles) ? user.roles.join(", ") : user?.roles || "");

  return {
    id: id ? String(id) : null,
    name: String(name || "").trim(),
    email: String(email || "").trim(),
    role: String(role || "").trim(),
    label:
      String(name || "").trim() ||
      String(email || "").trim() ||
      "Guardia desconocido",
  };
}

function buildMapsUrls(lat, lon) {
  const okLat = Number.isFinite(Number(lat));
  const okLon = Number.isFinite(Number(lon));
  if (!okLat || !okLon) return { googleMapsUrl: "", wazeUrl: "" };

  const latLng = `${lat},${lon}`;
  return {
    googleMapsUrl: `https://www.google.com/maps?q=${encodeURIComponent(latLng)}`,
    wazeUrl: `https://waze.com/ul?ll=${encodeURIComponent(
      latLng
    )}&navigate=yes`,
  };
}

async function getCurrentGeo(extraOptions = {}) {
  if (
    typeof navigator === "undefined" ||
    !("geolocation" in navigator) ||
    !navigator.geolocation
  ) {
    return null;
  }

  const options = {
    enableHighAccuracy: true,
    timeout: 10000,
    maximumAge: 0,
    ...extraOptions,
  };

  return await new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = pos?.coords || {};
        const lat = toFixedNumber(coords.latitude, 6);
        const lon = toFixedNumber(coords.longitude, 6);
        const accuracy = toFixedNumber(coords.accuracy, 2);
        const altitude = toFixedNumber(coords.altitude, 2);
        const heading = toFixedNumber(coords.heading, 2);
        const speed = toFixedNumber(coords.speed, 2);
        const capturedAt = new Date(
          pos?.timestamp || Date.now()
        ).toISOString();
        const { googleMapsUrl, wazeUrl } = buildMapsUrls(lat, lon);

        resolve({
          lat,
          lon,
          accuracy,
          altitude,
          heading,
          speed,
          capturedAt,
          source: "browser-geolocation",
          googleMapsUrl,
          wazeUrl,
          coordsText:
            Number.isFinite(lat) && Number.isFinite(lon)
              ? `${lat}, ${lon}`
              : "",
        });
      },
      () => resolve(null),
      options
    );
  });
}

async function panicApiCompat(payload) {
  if (!rondasqrApi || typeof rondasqrApi.panic !== "function") {
    throw new Error("rondasqrApi no implementa panic");
  }

  try {
    return await rondasqrApi.panic(payload);
  } catch (err) {
    const gpsOnly =
      payload?.gps && typeof payload.gps === "object"
        ? {
            lat: payload.gps.lat ?? null,
            lon: payload.gps.lon ?? null,
          }
        : null;

    if (gpsOnly?.lat != null && gpsOnly?.lon != null) {
      return await rondasqrApi.panic(gpsOnly);
    }

    return await rondasqrApi.panic(null);
  }
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
      const guard = buildGuardIdentity(principal);
      const geo = await getCurrentGeo({
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      });

      const payload = {
        type: "panic",
        kind: "panic",
        source: "panic_button",
        title: "🚨 Alerta de pánico",
        message: "Alerta de pánico enviada",
        body: "Alerta de pánico enviada",
        incidentText: "Alerta de pánico enviada",
        emittedAt: new Date().toISOString(),
        guard,
        guardId: guard.id,
        guardName: guard.name,
        guardEmail: guard.email,
        gps: geo
          ? {
              lat: geo.lat,
              lon: geo.lon,
              accuracy: geo.accuracy,
              altitude: geo.altitude,
              heading: geo.heading,
              speed: geo.speed,
              capturedAt: geo.capturedAt,
              source: geo.source,
              coordsText: geo.coordsText,
            }
          : null,
        location: geo
          ? {
              lat: geo.lat,
              lon: geo.lon,
              accuracy: geo.accuracy,
              coordsText: geo.coordsText,
              googleMapsUrl: geo.googleMapsUrl,
              wazeUrl: geo.wazeUrl,
              capturedAt: geo.capturedAt,
            }
          : null,
        links: geo
          ? {
              googleMapsUrl: geo.googleMapsUrl,
              wazeUrl: geo.wazeUrl,
            }
          : null,
      };

      await panicApiCompat(payload);

      emitLocalPanic({
        ...payload,
        user: guard.label,
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