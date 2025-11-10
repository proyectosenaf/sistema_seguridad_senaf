// client/src/modules/rondasqr/utils/sendPanic.js
import { rondasqrApi } from "../api/rondasqrApi.js";

export async function sendPanicAndMaybeLocate() {
  let gps;

  // intentar geolocalización
  if ("geolocation" in navigator) {
    await new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          gps = {
            lat: pos.coords.latitude,
            lon: pos.coords.longitude,
          };
          resolve();
        },
        () => resolve(),
        { enableHighAccuracy: true, timeout: 5000 }
      );
    });
  }

  // enviar al backend
  await rondasqrApi.panic(gps);

  // feedback
  window.alert("🚨 Alerta de pánico enviada.");

  // si quieres redirigir SIEMPRE al mismo lugar después de enviar:
  // window.location.assign("/incidentes/nuevo");
}
