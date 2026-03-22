import React, { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Html5Qrcode } from "html5-qrcode";

const API_BASE = (
  import.meta.env.VITE_API_BASE_URL ||
  import.meta.env.VITE_API_URL ||
  "http://localhost:4000/api"
).replace(/\/$/, "");

const SCAN_QR_API_URL = `${API_BASE}/citas/scan-qr`;

const SCANNER_REGION_ID = "senaf-cita-qr-reader";
const DUPLICATE_SCAN_COOLDOWN_MS = 3500;

function sxCard(extra = {}) {
  return {
    background: "color-mix(in srgb, var(--card) 90%, transparent)",
    border: "1px solid var(--border)",
    boxShadow: "var(--shadow-md)",
    backdropFilter: "blur(12px) saturate(130%)",
    WebkitBackdropFilter: "blur(12px) saturate(130%)",
    ...extra,
  };
}

function sxCardSoft(extra = {}) {
  return {
    background: "color-mix(in srgb, var(--card-solid) 88%, transparent)",
    border: "1px solid var(--border)",
    boxShadow: "var(--shadow-sm)",
    ...extra,
  };
}

function sxGhostBtn(extra = {}) {
  return {
    background: "color-mix(in srgb, var(--card-solid) 88%, transparent)",
    color: "var(--text)",
    border: "1px solid var(--border)",
    boxShadow: "var(--shadow-sm)",
    ...extra,
  };
}

function sxPrimaryBtn(extra = {}) {
  return {
    background: "linear-gradient(135deg, #2563eb, #06b6d4)",
    color: "#fff",
    border: "1px solid transparent",
    boxShadow: "0 10px 20px color-mix(in srgb, #2563eb 22%, transparent)",
    ...extra,
  };
}

function sxSuccessBox(extra = {}) {
  return {
    background: "color-mix(in srgb, #22c55e 10%, transparent)",
    color: "#86efac",
    border: "1px solid color-mix(in srgb, #22c55e 28%, transparent)",
    ...extra,
  };
}

function sxErrorBox(extra = {}) {
  return {
    background: "color-mix(in srgb, #ef4444 10%, transparent)",
    color: "#fca5a5",
    border: "1px solid color-mix(in srgb, #ef4444 28%, transparent)",
    ...extra,
  };
}

function sxInfoBox(extra = {}) {
  return {
    background: "color-mix(in srgb, #3b82f6 10%, transparent)",
    color: "#93c5fd",
    border: "1px solid color-mix(in srgb, #3b82f6 28%, transparent)",
    ...extra,
  };
}

function normalizeQrText(value) {
  return String(value || "").trim();
}

function prettyEstado(value) {
  const raw = String(value || "").trim().toLowerCase();

  const map = {
    solicitada: "Programada",
    programada: "Programada",
    "en revisión": "En revisión",
    en_revision: "En revisión",
    autorizada: "Autorizada",
    denegada: "Denegada",
    cancelada: "Cancelada",
    dentro: "Dentro",
    finalizada: "Finalizada",
  };

  return map[raw] || String(value || "—").trim() || "—";
}

function EstadoPill({ estado }) {
  const normalized = prettyEstado(estado);

  let style = {
    background: "color-mix(in srgb, #f59e0b 12%, transparent)",
    color: "#fde68a",
    border: "1px solid color-mix(in srgb, #f59e0b 36%, transparent)",
  };

  if (normalized === "Dentro" || normalized === "Autorizada") {
    style = {
      background: "color-mix(in srgb, #22c55e 12%, transparent)",
      color: "#86efac",
      border: "1px solid color-mix(in srgb, #22c55e 36%, transparent)",
    };
  } else if (normalized === "Denegada" || normalized === "Cancelada") {
    style = {
      background: "color-mix(in srgb, #ef4444 12%, transparent)",
      color: "#fca5a5",
      border: "1px solid color-mix(in srgb, #ef4444 36%, transparent)",
    };
  } else if (normalized === "En revisión") {
    style = {
      background: "color-mix(in srgb, #3b82f6 12%, transparent)",
      color: "#93c5fd",
      border: "1px solid color-mix(in srgb, #3b82f6 36%, transparent)",
    };
  } else if (normalized === "Finalizada") {
    style = {
      background: "color-mix(in srgb, #64748b 18%, transparent)",
      color: "#cbd5e1",
      border: "1px solid color-mix(in srgb, #64748b 36%, transparent)",
    };
  }

  return (
    <span
      className="px-2 py-1 rounded-full text-xs font-semibold inline-flex items-center justify-center"
      style={style}
    >
      {normalized}
    </span>
  );
}

function fmtDateTime(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("es-HN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function fmtDateOnly(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("es-HN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

function getTodayLocalYmd() {
  const now = new Date();
  const year = now.getFullYear();
  const month = `${now.getMonth() + 1}`.padStart(2, "0");
  const day = `${now.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getClientTimeZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Tegucigalpa";
  } catch {
    return "America/Tegucigalpa";
  }
}

function extractReadableError(data, fallback = "No se pudo validar el QR.") {
  return (
    data?.error ||
    data?.message ||
    data?.detail ||
    data?.reason ||
    fallback
  );
}

function extractResultItem(data) {
  if (!data || typeof data !== "object") return null;
  return data.item || data.cita || data.result || null;
}

function InfoRow({ label, value }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs" style={{ color: "var(--text-muted)" }}>
        {label}
      </span>
      <div className="text-sm break-words" style={{ color: "var(--text)" }}>
        {value}
      </div>
    </div>
  );
}

export default function CitasQrScannerPage() {
  const navigate = useNavigate();
  const scannerRef = useRef(null);
  const mountedRef = useRef(false);
  const lastProcessedRef = useRef({ text: "", at: 0 });

  const [scanEnabled, setScanEnabled] = useState(true);
  const [scannerReady, setScannerReady] = useState(false);
  const [processing, setProcessing] = useState(false);

  const [manualQrText, setManualQrText] = useState("");
  const [lastDecodedText, setLastDecodedText] = useState("");
  const [lastScanSource, setLastScanSource] = useState("—");

  const [result, setResult] = useState(null);
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const [scanCount, setScanCount] = useState(0);
  const [lastProcessedAt, setLastProcessedAt] = useState(null);

  const clientTimeZone = useMemo(() => getClientTimeZone(), []);
  const todayLocalYmd = useMemo(() => getTodayLocalYmd(), []);

  const clearMessages = useCallback(() => {
    setSuccessMsg("");
    setErrorMsg("");
  }, []);

  const resetScanState = useCallback(() => {
    clearMessages();
    setResult(null);
    setManualQrText("");
    setLastDecodedText("");
    setLastScanSource("—");
    lastProcessedRef.current = { text: "", at: 0 };
  }, [clearMessages]);

  const processQrText = useCallback(
    async (rawQrText, source = "camera") => {
      const qrText = normalizeQrText(rawQrText);
      if (!qrText) return;

      if (processing) return;

      const now = Date.now();
      const prev = lastProcessedRef.current;

      if (
        prev?.text === qrText &&
        now - Number(prev?.at || 0) < DUPLICATE_SCAN_COOLDOWN_MS
      ) {
        return;
      }

      lastProcessedRef.current = { text: qrText, at: now };

      setProcessing(true);
      setLastDecodedText(qrText);
      setLastScanSource(source);
      setLastProcessedAt(new Date().toISOString());
      clearMessages();

      try {
        const payload = {
          qrText,
          source,
          clientNowIso: new Date().toISOString(),
          clientDate: getTodayLocalYmd(),
          clientTimeZone,
        };

        const res = await fetch(SCAN_QR_API_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        });

        const data = await res.json().catch(() => null);
        const item = extractResultItem(data);

        if (!res.ok || !data?.ok) {
          setResult(item || null);
          setErrorMsg(
            extractReadableError(
              data,
              "QR inválido, vencido, ya utilizado o fuera del día permitido."
            )
          );
          return;
        }

        setResult(item || null);
        setSuccessMsg(
          data?.message ||
            "QR válido. El ingreso fue registrado correctamente."
        );
        setScanCount((v) => v + 1);
      } catch (err) {
        console.error("[CitasQrScannerPage] Error al escanear QR:", err);
        setResult(null);
        setErrorMsg("Error de red al procesar el QR.");
      } finally {
        if (mountedRef.current) {
          setProcessing(false);
        }
      }
    },
    [clientTimeZone, processing, clearMessages]
  );

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    let localScanner = null;

    async function startScanner() {
      if (!scanEnabled) return;

      try {
        setScannerReady(false);

        const scanner = new Html5Qrcode(SCANNER_REGION_ID);
        localScanner = scanner;
        scannerRef.current = scanner;

        await scanner.start(
          { facingMode: "environment" },
          {
            fps: 10,
            qrbox: { width: 240, height: 240 },
            aspectRatio: 1,
          },
          async (decodedText) => {
            if (cancelled || !mountedRef.current) return;
            await processQrText(decodedText, "camera");
          },
          () => {}
        );

        if (!cancelled && mountedRef.current) {
          setScannerReady(true);
          setErrorMsg("");
        }
      } catch (err) {
        console.error("[CitasQrScannerPage] No se pudo iniciar la cámara:", err);
        if (!cancelled && mountedRef.current) {
          setScannerReady(false);
          setErrorMsg(
            "No se pudo iniciar la cámara. Puedes pegar manualmente el contenido del QR."
          );
        }
      }
    }

    startScanner();

    return () => {
      cancelled = true;

      const scanner = scannerRef.current || localScanner;
      scannerRef.current = null;

      if (!scanner) return;

      Promise.resolve()
        .then(async () => {
          try {
            const state =
              typeof scanner.getState === "function" ? scanner.getState() : null;

            if (state === 2 || state === 3 || scanner.isScanning) {
              await scanner.stop();
            }
          } catch (err) {
            console.warn(
              "[CitasQrScannerPage] stop ignored:",
              err?.message || err
            );
          }

          try {
            await scanner.clear();
          } catch (err) {
            console.warn(
              "[CitasQrScannerPage] clear ignored:",
              err?.message || err
            );
          }
        })
        .catch(() => {});
    };
  }, [scanEnabled, processQrText]);

  const resultEstado = prettyEstado(result?.estado);
  const wasAccepted =
    !!successMsg ||
    resultEstado === "Dentro" ||
    result?.checkinOk === true ||
    result?.ingresoRegistrado === true;

  return (
    <div className="layer-content relative z-[1] flex flex-col gap-6 pb-10">
      <div className="mesh mesh--ribbon" />
      <div className="mesh mesh--br" />
      <div className="mesh mesh--lb" />

      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
        <div>
          <h1
            className="text-xl md:text-2xl font-bold"
            style={{ color: "var(--text)" }}
          >
            Escáner QR de Citas
          </h1>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            Escanea el QR del visitante. El backend debe validar que la cita sea
            del día, que el código siga vigente y registrar el ingreso automáticamente.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={resetScanState}
            className="text-xs px-3 py-2 rounded-md transition"
            style={sxGhostBtn()}
          >
            Limpiar resultado
          </button>

          <button
            onClick={() => navigate("/visitas/control")}
            className="text-xs hover:underline"
            style={{ color: "#60a5fa" }}
          >
            ← Volver a Gestión de Visitantes
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <section className="p-4 md:p-5 rounded-[24px]" style={sxCard()}>
          <div className="flex items-center justify-between gap-3 mb-4">
            <div>
              <h2
                className="text-base font-semibold"
                style={{ color: "var(--text)" }}
              >
                Cámara
              </h2>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                Apunta al código QR generado para la cita.
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                clearMessages();
                setScannerReady(false);
                setScanEnabled((v) => !v);
              }}
              className="px-3 py-2 rounded-md text-xs font-semibold transition"
              style={scanEnabled ? sxGhostBtn() : sxPrimaryBtn()}
            >
              {scanEnabled ? "Detener cámara" : "Iniciar cámara"}
            </button>
          </div>

          <div
            className="rounded-[20px] overflow-hidden"
            style={sxCardSoft({ minHeight: 320 })}
          >
            <div id={SCANNER_REGION_ID} className="w-full min-h-[320px]" />
          </div>

          <div className="mt-3 flex flex-col gap-2 text-xs">
            <div style={{ color: "var(--text-muted)" }}>
              {scannerReady
                ? "Cámara activa."
                : "Si la cámara no abre, usa la validación manual de abajo."}
            </div>

            <div style={{ color: "var(--text-muted)" }}>
              <strong>Zona horaria:</strong> {clientTimeZone}
            </div>

            <div style={{ color: "var(--text-muted)" }}>
              <strong>Fecha local del guardia:</strong> {todayLocalYmd}
            </div>
          </div>
        </section>

        <section className="p-4 md:p-5 rounded-[24px]" style={sxCard()}>
          <div className="mb-4">
            <h2
              className="text-base font-semibold"
              style={{ color: "var(--text)" }}
            >
              Resultado del escaneo
            </h2>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              El backend debe validar existencia, vigencia, fecha del día, estado
              de la cita y registrar el check-in automáticamente.
            </p>
          </div>

          {processing && (
            <div
              className="mb-3 rounded-[14px] px-3 py-2 text-sm"
              style={sxInfoBox()}
            >
              Procesando QR...
            </div>
          )}

          {!!successMsg && (
            <div
              className="mb-3 rounded-[14px] px-3 py-2 text-sm"
              style={sxSuccessBox()}
            >
              {successMsg}
            </div>
          )}

          {!!errorMsg && (
            <div
              className="mb-3 rounded-[14px] px-3 py-2 text-sm"
              style={sxErrorBox()}
            >
              {errorMsg}
            </div>
          )}

          <div
            className="mb-4 rounded-[18px] p-3 text-xs"
            style={sxCardSoft()}
          >
            <div style={{ color: "var(--text-muted)" }}>
              <strong>Último origen:</strong> {lastScanSource}
            </div>
            <div style={{ color: "var(--text-muted)" }}>
              <strong>Último QR leído:</strong>{" "}
              {lastDecodedText ? lastDecodedText : "—"}
            </div>
            <div style={{ color: "var(--text-muted)" }}>
              <strong>Último procesamiento:</strong>{" "}
              {lastProcessedAt ? fmtDateTime(lastProcessedAt) : "—"}
            </div>
            <div style={{ color: "var(--text-muted)" }}>
              <strong>Ingresos aprobados en esta sesión:</strong> {scanCount}
            </div>
          </div>

          {result ? (
            <div
              className="rounded-[20px] p-4 flex flex-col gap-3"
              style={sxCardSoft()}
            >
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div
                  className="text-sm font-semibold"
                  style={{ color: "var(--text)" }}
                >
                  Datos de la cita
                </div>

                <div className="flex items-center gap-2">
                  <EstadoPill estado={result.estado} />
                  {wasAccepted ? (
                    <span
                      className="px-2 py-1 rounded-full text-[11px] font-semibold"
                      style={{
                        background:
                          "color-mix(in srgb, #22c55e 12%, transparent)",
                        color: "#86efac",
                        border:
                          "1px solid color-mix(in srgb, #22c55e 36%, transparent)",
                      }}
                    >
                      ingreso registrado
                    </span>
                  ) : (
                    <span
                      className="px-2 py-1 rounded-full text-[11px] font-semibold"
                      style={{
                        background:
                          "color-mix(in srgb, #ef4444 12%, transparent)",
                        color: "#fca5a5",
                        border:
                          "1px solid color-mix(in srgb, #ef4444 36%, transparent)",
                      }}
                    >
                      no autorizado
                    </span>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                <InfoRow label="Visitante" value={result.nombre || "—"} />
                <InfoRow label="Documento" value={result.documento || "—"} />
                <InfoRow label="Empresa" value={result.empresa || "—"} />
                <InfoRow label="Empleado" value={result.empleado || "—"} />
                <InfoRow label="Motivo" value={result.motivo || "—"} />
                <InfoRow label="Estado" value={<EstadoPill estado={result.estado} />} />
                <InfoRow label="Fecha de cita" value={fmtDateOnly(result.citaAt)} />
                <InfoRow label="Hora de cita" value={fmtDateTime(result.citaAt)} />
                <InfoRow
                  label="Entrada registrada"
                  value={fmtDateTime(result.fechaEntrada || result.checkInAt)}
                />
                <InfoRow
                  label="Validado por"
                  value={result.checkedInByName || result.checkedInBy || "—"}
                />
                <InfoRow
                  label="Método"
                  value={result.checkedInMethod || result.metodoIngreso || "qr"}
                />
                <InfoRow
                  label="Observación"
                  value={
                    result.observacion ||
                    result.note ||
                    result.detail ||
                    "—"
                  }
                />
              </div>

              {!!result?.acompanantes?.length && (
                <div className="mt-2">
                  <div
                    className="text-xs font-semibold mb-1"
                    style={{ color: "var(--text-muted)" }}
                  >
                    Acompañantes
                  </div>
                  <ul
                    className="list-disc pl-5 text-sm"
                    style={{ color: "var(--text)" }}
                  >
                    {result.acompanantes.map((comp, idx) => (
                      <li key={`acomp-${idx}`}>
                        {comp?.nombre || "—"}
                        {comp?.documento ? ` — ${comp.documento}` : ""}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : (
            <div className="text-sm" style={{ color: "var(--text-muted)" }}>
              Aún no se ha procesado ningún QR.
            </div>
          )}

          <div
            className="mt-5 pt-4"
            style={{ borderTop: "1px solid var(--border)" }}
          >
            <div className="mb-2">
              <div
                className="text-sm font-semibold"
                style={{ color: "var(--text)" }}
              >
                Validación manual
              </div>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                Pega aquí el contenido del QR si la cámara no está disponible.
              </p>
            </div>

            <textarea
              value={manualQrText}
              onChange={(e) => setManualQrText(e.target.value)}
              className="w-full min-h-[100px] rounded-[14px] px-3 py-2 text-sm outline-none transition"
              style={{
                background: "var(--input-bg)",
                color: "var(--text)",
                border: "1px solid var(--input-border)",
                boxShadow: "inset 0 1px 0 rgba(255,255,255,.04)",
              }}
              placeholder="Ej. SENAF_CITA_QR::xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
            />

            <div className="mt-3 flex justify-end gap-3 flex-wrap">
              <button
                type="button"
                onClick={() => {
                  setManualQrText("");
                  clearMessages();
                }}
                className="px-3 py-2 rounded-md text-xs font-semibold transition"
                style={sxGhostBtn()}
              >
                Limpiar texto
              </button>

              <button
                type="button"
                onClick={() => processQrText(manualQrText, "manual")}
                disabled={!manualQrText.trim() || processing}
                className="px-3 py-2 rounded-md text-xs font-semibold transition disabled:opacity-60"
                style={sxPrimaryBtn()}
              >
                Validar manualmente
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}