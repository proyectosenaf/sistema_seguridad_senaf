// src/modules/rondasqr/guard/ScanPage.jsx
import React, { useState, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import SidebarGuard from "./SidebarGuard.jsx";
import { rondasqrApi } from "../api/rondasqrApi";

export default function ScanPage() {
  const nav = useNavigate();
  const { pathname, hash } = useLocation();

  // pestaña activa derivada de la ruta
  const tab = useMemo(() => {
    if (pathname.endsWith("/qr")) return "qr";
    if (pathname.endsWith("/msg")) return "msg";
    if (pathname.endsWith("/fotos")) return "fotos";
    return "home";
  }, [pathname]);

  const [msg, setMsg] = useState("");
  const [photos, setPhotos] = useState([null, null, null, null, null]);
  const [sendingAlert, setSendingAlert] = useState(false);
  const [sendingMsg, setSendingMsg] = useState(false);
  const [sendingPhotos, setSendingPhotos] = useState(false);

  // si el usuario entra por "#alert" desde el menú → dispara alerta
  React.useEffect(() => {
    if (hash === "#alert") {
      (async () => {
        await sendAlert();
        nav("/rondasqr/scan", { replace: true });
      })();
    }
  }, [hash, nav]);

  async function sendAlert() {
    if (sendingAlert) return;
    setSendingAlert(true);
    try {
      let gps;
      if ("geolocation" in navigator) {
        await new Promise((resolve) => {
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              gps = { lat: pos.coords.latitude, lon: pos.coords.longitude };
              resolve();
            },
            () => resolve(),
            { enableHighAccuracy: true, timeout: 5000 }
          );
        });
      }
      await rondasqrApi.panic(gps);
      alert("🚨 Alerta de pánico enviada.");
    } catch (e) {
      console.error("[panic]", e);
      alert("No se pudo enviar la alerta.");
    } finally {
      setSendingAlert(false);
    }
  }

  async function sendMessage() {
    if (sendingMsg) return;
    if (!msg.trim()) return alert("Escribe un mensaje.");
    setSendingMsg(true);
    try {
      await rondasqrApi.postIncident({ text: msg.trim() });
      alert("✅ Mensaje enviado.");
      setMsg("");
      nav("/rondasqr/scan");
    } catch (e) {
      console.error("[incident]", e);
      alert("No se pudo enviar el mensaje.");
    } finally {
      setSendingMsg(false);
    }
  }

  async function sendPhotos() {
    if (sendingPhotos) return;
    const base64s = photos.filter(Boolean);
    if (!base64s.length) return alert("Selecciona al menos una foto.");
    setSendingPhotos(true);
    try {
      await rondasqrApi.postIncident({ text: "Fotos de ronda", photosBase64: base64s });
      alert("📤 Fotos enviadas.");
      setPhotos([null, null, null, null, null]);
      nav("/rondasqr/scan");
    } catch (e) {
      console.error("[photos]", e);
      alert("No se pudieron enviar las fotos.");
    } finally {
      setSendingPhotos(false);
    }
  }

  return (
    <div className="flex h-screen bg-gradient-to-br from-[#001e3c] to-[#004c80] text-white">
      <SidebarGuard />

      <main className="flex-1 flex flex-col overflow-y-auto p-6">
        {/* Encabezado */}
        <div className="bg-[#0b4c7c] rounded-2xl px-6 py-3 mb-5 shadow-lg flex justify-between items-center">
          <div className="text-2xl font-bold">Visión General</div>
          <div className="text-sm">
            Intervalo de tiempo: <span className="font-semibold">4h:00m</span>
          </div>
        </div>

        {/* HOME */}
        {tab === "home" && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* ALERTA */}
            <div className="bg-[#012d55]/40 rounded-2xl p-6 shadow-xl text-center">
              <button
                onClick={sendAlert}
                disabled={sendingAlert}
                className={`w-44 h-44 rounded-full text-2xl font-extrabold shadow-2xl border-4 ${
                  sendingAlert
                    ? "bg-red-400 border-red-200 cursor-not-allowed"
                    : "bg-red-600 hover:bg-red-500 border-red-300"
                }`}
              >
                {sendingAlert ? "ENVIANDO…" : "ALERTA"}
              </button>
              <div className="text-sm mt-2 text-white/90">Oprima en caso de emergencia</div>

              <div className="mt-6 grid gap-3">
                <button
                  onClick={() => nav("/rondasqr/scan/qr")}
                  className="bg-[#0068b3] hover:bg-[#0a75c5] text-white font-medium py-2 rounded-lg shadow"
                >
                  Registrar Punto Control
                </button>
                <button
                  onClick={() => nav("/rondasqr/scan/msg")}
                  className="bg-[#0068b3] hover:bg-[#0a75c5] text-white font-medium py-2 rounded-lg shadow"
                >
                  Mensaje Incidente
                </button>
                <button
                  onClick={() => nav("/rondasqr/scan/fotos")}
                  className="bg-[#0068b3] hover:bg-[#0a75c5] text-white font-medium py-2 rounded-lg shadow"
                >
                  Enviar Fotos
                </button>
              </div>
            </div>

            {/* Escanear punto (preview) */}
            <div className="bg-[#012d55]/40 rounded-2xl p-6 shadow-xl">
              <h3 className="font-semibold text-lg mb-3">Escanear Punto</h3>
              <div className="aspect-[3/2] bg-black/70 rounded-xl border-4 border-yellow-500 flex items-center justify-center text-yellow-400 text-4xl">
                ☐
              </div>
              <div className="mt-4 flex gap-3">
                <button
                  onClick={() => nav("/rondasqr/scan/qr")}
                  className="flex-1 bg-green-600 hover:bg-green-500 py-2 rounded-lg font-semibold shadow"
                >
                  Escanear
                </button>
                <button className="flex-1 bg-orange-600 hover:bg-orange-500 py-2 rounded-lg font-semibold shadow">
                  Finalizar
                </button>
              </div>
            </div>

            {/* Enviar Fotos rápido */}
            <QuickPhotos
              photos={photos}
              setPhotos={setPhotos}
              onSend={sendPhotos}
              sending={sendingPhotos}
            />
          </div>
        )}

        {/* QR */}
        {tab === "qr" && (
          <div className="bg-[#012d55]/40 rounded-2xl p-6 shadow-xl">
            <h3 className="font-semibold text-lg mb-3">Registrador / Escanear Punto</h3>
            <div className="aspect-[3/2] bg-black/70 rounded-xl border-4 border-yellow-500 flex items-center justify-center text-yellow-400 text-4xl mb-4">
              ☐ {/* aquí luego integras el scanner real */}
            </div>
            <div className="flex gap-3">
              <button className="px-4 py-2 rounded-lg bg-green-600 hover:bg-green-500">
                Escanear
              </button>
              <button onClick={() => nav("/rondasqr/scan")} className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20">
                Volver
              </button>
            </div>
          </div>
        )}

        {/* MENSAJE */}
        {tab === "msg" && (
          <div className="bg-[#012d55]/40 rounded-2xl p-6 shadow-xl">
            <h3 className="text-lg font-semibold mb-3">Mensaje / Incidente</h3>
            <textarea
              className="w-full rounded-lg bg-black/30 border border-white/10 px-3 py-2 text-white"
              rows={5}
              placeholder="Describa el incidente..."
              value={msg}
              onChange={(e) => setMsg(e.target.value)}
            />
            <div className="mt-4 flex justify-end gap-3">
              <button
                onClick={() => nav("/rondasqr/scan")}
                className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20"
              >
                Cancelar
              </button>
              <button
                onClick={sendMessage}
                disabled={sendingMsg}
                className={`px-4 py-2 rounded-lg ${
                  sendingMsg
                    ? "bg-emerald-400 cursor-not-allowed"
                    : "bg-emerald-600 hover:bg-emerald-500"
                }`}
              >
                {sendingMsg ? "Enviando…" : "Enviar"}
              </button>
            </div>
          </div>
        )}

        {/* FOTOS */}
        {tab === "fotos" && (
          <div className="bg-[#012d55]/40 rounded-2xl p-6 shadow-xl">
            <h3 className="font-semibold text-lg mb-3">Enviar Fotos</h3>
            <PhotoPicker photos={photos} setPhotos={setPhotos} idPrefix="foto2" />
            <div className="mt-4 flex justify-end gap-3">
              <button
                onClick={() => nav("/rondasqr/scan")}
                className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20"
              >
                Cancelar
              </button>
              <button
                onClick={sendPhotos}
                disabled={sendingPhotos}
                className={`px-4 py-2 rounded-lg ${
                  sendingPhotos ? "bg-blue-400 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-500"
                }`}
              >
                {sendingPhotos ? "Enviando…" : "Enviar"}
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function QuickPhotos({ photos, setPhotos, onSend, sending }) {
  return (
    <div className="bg-[#012d55]/40 rounded-2xl p-6 shadow-xl">
      <h3 className="font-semibold text-lg mb-3">Enviar fotos</h3>
      <PhotoPicker photos={photos} setPhotos={setPhotos} idPrefix="foto" />
      <button
        onClick={onSend}
        disabled={sending}
        className={`w-full text-white mt-3 py-2 rounded-lg ${
          sending ? "bg-blue-400 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-500"
        }`}
      >
        {sending ? "Enviando…" : "Enviar"}
      </button>
    </div>
  );
}

function PhotoPicker({ photos, setPhotos, idPrefix }) {
  return (
    <>
      {photos.map((f, i) => (
        <div key={i} className="flex items-center justify-between mb-2">
          <span className="text-sm">Toma foto {i + 1}</span>
          <div className="flex gap-2">
            <input
              type="file"
              accept="image/*"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const base64 = await fileToBase64(file);
                setPhotos((p) => {
                  const n = [...p];
                  n[i] = base64;
                  return n;
                });
              }}
              className="hidden"
              id={`${idPrefix}-${i}`}
            />
            <label
              htmlFor={`${idPrefix}-${i}`}
              className="bg-blue-600 hover:bg-blue-500 text-white px-3 py-1 rounded-md cursor-pointer"
            >
              Seleccionar
            </label>
            <button
              onClick={() => setPhotos((p) => p.map((f2, idx) => (idx === i ? null : f2)))}
              className="bg-red-600 hover:bg-red-500 text-white px-3 py-1 rounded-md"
            >
              Eliminar
            </button>
          </div>
        </div>
      ))}
    </>
  );
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}
