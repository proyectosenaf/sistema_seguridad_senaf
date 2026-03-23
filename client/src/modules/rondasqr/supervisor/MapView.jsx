// src/modules/rondasqr/supervisor/MapView.jsx
import React, { useMemo } from "react";
import { MapContainer, TileLayer, Polyline, Marker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

const defaultIcon = new L.Icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

const panicIcon = new L.DivIcon({
  className: "custom-panic-marker",
  html: `
    <div style="
      width:20px;
      height:20px;
      border-radius:9999px;
      background:#dc2626;
      border:3px solid #fecaca;
      box-shadow:0 0 0 6px rgba(220,38,38,.18);
    "></div>
  `,
  iconSize: [20, 20],
  iconAnchor: [10, 10],
});

function asText(v) {
  return String(v || "").trim();
}

function numberOrNull(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function pickCoords(item) {
  const locCoords = Array.isArray(item?.loc?.coordinates) ? item.loc.coordinates : null;
  if (locCoords && locCoords.length >= 2) {
    const lon = numberOrNull(locCoords[0]);
    const lat = numberOrNull(locCoords[1]);
    if (lat != null && lon != null) return { lat, lon };
  }

  const lat = numberOrNull(
    item?.gps?.lat ??
      item?.location?.lat ??
      item?.lat ??
      item?.latitude
  );
  const lon = numberOrNull(
    item?.gps?.lon ??
      item?.gps?.lng ??
      item?.location?.lon ??
      item?.location?.lng ??
      item?.lon ??
      item?.lng ??
      item?.longitude
  );

  if (lat != null && lon != null) return { lat, lon };
  return null;
}

function pickType(item) {
  return asText(item?.type || item?.eventType || item?.kind || "mark").toLowerCase();
}

function pickTitle(item, index) {
  return (
    item?.title ||
    item?.text ||
    item?.message ||
    item?.pointName ||
    item?.point?.name ||
    `Marca #${index + 1}`
  );
}

function pickGuard(item) {
  return (
    item?.guardName ||
    item?.guard?.name ||
    item?.officerName ||
    item?.officerEmail ||
    item?.guardEmail ||
    item?.user ||
    "—"
  );
}

function buildMapLink(lat, lon) {
  if (lat == null || lon == null) return "";
  return `https://www.google.com/maps?q=${encodeURIComponent(`${lat}, ${lon}`)}`;
}

export default function MapView({ items = [] }) {
  const points = useMemo(() => {
    return (Array.isArray(items) ? items : [])
      .map((item, index) => {
        const coords = pickCoords(item);
        if (!coords) return null;

        const type = pickType(item);
        const title = pickTitle(item, index);
        const when = item?.at || item?.date || item?.createdAt || null;

        return {
          index,
          raw: item,
          lat: coords.lat,
          lon: coords.lon,
          position: [coords.lat, coords.lon],
          type,
          title,
          guard: pickGuard(item),
          siteName: item?.siteName || item?.site?.name || "—",
          roundName: item?.roundName || item?.round?.name || "—",
          pointName: item?.pointName || item?.point?.name || item?.qr || "—",
          when,
          mapsUrl: buildMapLink(coords.lat, coords.lon),
        };
      })
      .filter(Boolean);
  }, [items]);

  const routeCoords = useMemo(
    () =>
      points
        .filter((p) => !["panic", "fall", "inactivity", "immobility"].includes(p.type))
        .map((p) => p.position),
    [points]
  );

  if (!points.length) {
    return (
      <div className="text-sm text-white/70">
        No hay ubicaciones para graficar.
      </div>
    );
  }

  const center = points[points.length - 1]?.position || points[0].position;

  return (
    <div className="h-[360px] rounded-xl overflow-hidden border border-white/10">
      <MapContainer center={center} zoom={16} style={{ height: "100%", width: "100%" }}>
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

        {routeCoords.length >= 2 ? <Polyline positions={routeCoords} /> : null}

        {points.map((p) => {
          const isAlert = ["panic", "fall", "inactivity", "immobility"].includes(p.type);

          return (
            <Marker
              key={`${p.index}-${p.lat}-${p.lon}-${p.type}`}
              position={p.position}
              icon={isAlert ? panicIcon : defaultIcon}
            >
              <Popup>
                <div className="text-sm min-w-[220px]">
                  <div className="font-bold">{p.title}</div>
                  <div className="mt-1">Tipo: {p.type || "mark"}</div>
                  <div>Guardia: {p.guard}</div>
                  <div>Sitio: {p.siteName}</div>
                  <div>Ronda: {p.roundName}</div>
                  <div>Punto: {p.pointName}</div>
                  <div>
                    Coordenadas: {p.lat}, {p.lon}
                  </div>
                  {p.when ? <div>Fecha: {new Date(p.when).toLocaleString()}</div> : null}
                  {p.mapsUrl ? (
                    <div className="mt-2">
                      <a
                        href={p.mapsUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="underline"
                      >
                        Abrir en Google Maps
                      </a>
                    </div>
                  ) : null}
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
}