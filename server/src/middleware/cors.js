// src/middleware/cors.js
import cors from "cors";
import { env } from "../config/env.js";

/**
 * Normaliza env.corsOrigin para aceptar:
 * - un string (ej: "http://localhost:3000")
 * - varios separados por coma (ej: "http://localhost:3000,http://localhost:5173")
 * - un array directo en env.corsOrigins
 */
function getAllowedOrigins() {
  if (Array.isArray(env.corsOrigins) && env.corsOrigins.length > 0) {
    return env.corsOrigins;
  }
  if (typeof env.corsOrigin === "string" && env.corsOrigin.trim() !== "") {
    return env.corsOrigin.split(",").map((s) => s.trim());
  }
  // Fallback en desarrollo
  if (env.node !== "production") {
    return ["http://localhost:3000", "http://localhost:5173"];
  }
  return []; // producción sin orígenes explícitos = bloquear todo
}

const allowedOrigins = getAllowedOrigins();

export const corsMw = cors({
  origin: (origin, callback) => {
    if (!origin) {
      // Permite llamadas sin origin (ej: Postman, curl)
      return callback(null, true);
    }
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error(`CORS bloqueado: origen ${origin} no permitido`));
  },
  credentials: true,
});
