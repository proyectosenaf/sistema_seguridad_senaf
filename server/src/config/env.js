// src/config/env.js
import * as dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Intenta cargar variables de entorno en este orden:
// 1) DOTENV_PATH (si la defines)
// 2) server.env (en raíz del backend)
// 3) .env      (en raíz del backend)
const candidates = [
  process.env.DOTENV_PATH && resolve(process.env.DOTENV_PATH),
  resolve(__dirname, "../../server.env"),
  resolve(__dirname, "../../.env"),
].filter(Boolean);

let loaded = false;
for (const p of candidates) {
  const r = dotenv.config({ path: p });
  if (!r.error) {
    loaded = true;
    console.log(`[env] loaded ${p.replace(process.cwd(), ".")}`);
    break;
  }
}
if (!loaded) {
  console.warn("[env] no .env/server.env file loaded; relying on process.env");
}

function splitCsv(v) {
  return (v || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export const env = {
  node: process.env.NODE_ENV || "development",
  port: Number(process.env.API_PORT || 4000),

  // Mongo
  mongoUri: process.env.MONGODB_URI || process.env.MONGO_URI || null,

  // Auth0
  auth0: {
    domain: process.env.AUTH0_DOMAIN,
    audience: process.env.AUTH0_AUDIENCE,
  },

  // CORS: array de orígenes permitidos (puede ser vacío)
  corsOrigin: splitCsv(process.env.CORS_ORIGIN),
};

// Avisos claros en consola (no detiene la app, solo guía)
if (!env.mongoUri) {
  console.error("[env] Missing mongoUri (define MONGODB_URI o MONGO_URI)");
}
if (!env.auth0.domain || !env.auth0.audience) {
  console.warn("[env] AUTH0_DOMAIN o AUTH0_AUDIENCE no definidos (si usas auth fallará con 401)");
}
