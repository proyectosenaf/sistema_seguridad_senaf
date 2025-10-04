// src/server.js
import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import compression from "compression";

const app = express();
app.set("trust proxy", 1);

// -------- CORS --------
function parseOrigins(str) {
  if (!str) return null;
  return String(str)
    .split(",")
    .map(s => s.trim())
    .filter(Boolean);
}
const devDefaults = ["http://localhost:5173", "http://localhost:3000"];
const origins =
  parseOrigins(process.env.CORS_ORIGINS) ||
  (process.env.NODE_ENV !== "production" ? devDefaults : null);

app.use(
  cors({
    origin: origins || true, // en prod: define CORS_ORIGINS; aquí true permite todo
    credentials: true,
  })
);

// -------- Middlewares --------
app.use(helmet());
if (process.env.NODE_ENV !== "production") app.use(morgan("dev"));
app.use(compression());
app.use(express.json({ limit: "2mb" }));

// -------- Healthchecks --------
app.get("/api/health", (_req, res) =>
  res.json({ ok: true, service: "senaf-api", ts: Date.now() })
);
app.get("/health", (_req, res) => res.json({ ok: true }));

// -------- 404 genérico --------
app.use((_req, res) => res.status(404).json({ ok: false, error: "Not implemented" }));

// -------- Start / Shutdown --------
const PORT = Number(process.env.PORT) || 4000;
const server = app.listen(PORT, () => {
  console.log(`[api] http://localhost:${PORT}`);
  console.log(
    `[cors] origins: ${
      origins ? origins.join(", ") : "(allow all)"
    }`
  );
});

["SIGINT", "SIGTERM"].forEach(sig =>
  process.on(sig, () => {
    console.log(`\n[api] ${sig} recibido. Cerrando…`);
    server.close(() => {
      console.log("[api] HTTP detenido.");
      process.exit(0);
    });
    setTimeout(() => process.exit(0), 5000).unref();
  })
);

process.on("unhandledRejection", err => console.error("[api] UnhandledRejection:", err));
process.on("uncaughtException", err => console.error("[api] UncaughtException:", err));
