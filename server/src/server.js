// src/server.js
import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import compression from "compression";
import http from "http";
import { Server as SocketIOServer } from "socket.io";
import mongoose from "mongoose";
import { registerRondasModule } from "../modules/rondas/index.js"; // 👈 ruta correcta

const app = express();
app.set("trust proxy", 1);

// CORS (igual a como lo tenías)
function parseOrigins(str) {
  if (!str) return null;
  return String(str).split(",").map(s => s.trim()).filter(Boolean);
}
const devDefaults = ["http://localhost:5173", "http://localhost:3000"];
const origins =
  parseOrigins(process.env.CORS_ORIGINS || process.env.CORS_ORIGIN) ||
  (process.env.NODE_ENV !== "production" ? devDefaults : null);

app.use(cors({ origin: origins || true, credentials: true }));
app.use(helmet());
if (process.env.NODE_ENV !== "production") app.use(morgan("dev"));
app.use(compression());
app.use(express.json({ limit: "2mb" }));

app.get("/api/health", (_req, res) => res.json({ ok: true, service: "senaf-api", ts: Date.now() }));
app.get("/health", (_req, res) => res.json({ ok: true }));

const server = http.createServer(app);
const io = new SocketIOServer(server, {
  cors: { origin: origins || true, methods: ["GET", "POST"], credentials: true },
});

// opcional: exponer io en req
app.use((req, _res, next) => { req.io = io; next(); });

// 🔌 DB y registro del módulo
await mongoose.connect(process.env.MONGODB_URI, { autoIndex: true });
console.log("[db] MongoDB conectado");

registerRondasModule({ app, io, basePath: "/api/rondas/v1" });

io.on("connection", s => {
  console.log("[io] client:", s.id);
  s.emit("hello", { ok: true, ts: Date.now() });
  s.on("disconnect", () => console.log("[io] bye:", s.id));
});

// 404
app.use((_req, res) => res.status(404).json({ ok: false, error: "Not implemented" }));

const PORT = Number(process.env.API_PORT || process.env.PORT || 4000);
server.listen(PORT, () => {
  console.log(`[api] http://localhost:${PORT}`);
  console.log(`[cors] origins: ${origins ? origins.join(", ") : "(allow all)"}`);
});

// graceful shutdown
["SIGINT", "SIGTERM"].forEach(sig =>
  process.on(sig, () => {
    console.log(`\n[api] ${sig} recibido. Cerrando…`);
    io.close();
    server.close(() => {
      console.log("[api] HTTP detenido.");
      process.exit(0);
    });
    setTimeout(() => process.exit(0), 5000).unref();
  })
);

process.on("unhandledRejection", err => console.error("[api] UnhandledRejection:", err));
process.on("uncaughtException", err => console.error("[api] UncaughtException:", err));
