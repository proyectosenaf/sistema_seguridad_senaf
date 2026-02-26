import * as dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const candidates = [
  process.env.DOTENV_PATH ? resolve(process.env.DOTENV_PATH) : null,
  resolve(__dirname, "../../server.env"),
  resolve(__dirname, "../../.env"),
].filter(Boolean);

let loaded = false;
for (const p of candidates) {
  const r = dotenv.config({ path: p });
  if (!r.error) {
    loaded = true;
    console.log(`[env] ✅ Loaded ${p.replace(process.cwd(), ".")}`);
    break;
  }
}
if (!loaded) {
  console.warn("[env] ⚠️ No .env/server.env file loaded; relying on process.env");
}

function splitCsv(v) {
  return (v || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export const env = {
  node: process.env.NODE_ENV || "development",

  // Puerto (DO App Platform usa PORT)
  port: Number(process.env.PORT || process.env.API_PORT || 4000),

  // Mongo
  mongoUri: process.env.MONGODB_URI || process.env.MONGO_URI || null,

  // CORS
  corsOrigin: splitCsv(process.env.CORS_ORIGINS || process.env.CORS_ORIGIN),

  // Auth local (HS256)
  jwtSecret: process.env.JWT_SECRET || "dev_secret",

  // Flags útiles
  disableAuth: process.env.DISABLE_AUTH === "1",
};

if (!env.mongoUri) console.error("[env] ❌ Missing mongoUri (define MONGODB_URI)");
if (!process.env.JWT_SECRET) {
  console.warn("[env] ⚠️ JWT_SECRET no definido; usando dev_secret (NO recomendado en producción)");
}