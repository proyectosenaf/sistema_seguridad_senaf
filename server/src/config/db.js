// src/config/db.js
import mongoose from "mongoose";
import { env } from "./env.js"; // ✅ misma carpeta

/**
 * Resuelve el nombre de la base de datos:
 * - Usa MONGO_DB_NAME si está definido.
 * - Si no, lo intenta extraer de la URI (.../senafseg?retryWrites=true).
 * - Si no encuentra, usa 'senafseg' por defecto.
 */
function resolveDbName(uri) {
  if (process.env.MONGO_DB_NAME) return process.env.MONGO_DB_NAME;
  if (typeof uri === "string") {
    const m = uri.match(/\/([^/?]+)(\?|$)/);
    if (m?.[1]) return decodeURIComponent(m[1]);
  }
  return "senafseg";
}

export async function connectDB() {
  const uri = env.mongoUri;

  if (!uri) {
    console.error(
      "[db] Mongo URI not set. Define MONGODB_URI (o MONGO_URI) en tu .env/server.env."
    );
    process.exit(1);
  }

  const dbName = resolveDbName(uri);

  // Opcional en Mongoose >= 7 (mantiene compat)
  mongoose.set("strictQuery", true);

  try {
    const conn = await mongoose.connect(uri, {
      dbName,                               // 👉 fuerza la DB si no estaba en la URI
      autoIndex: env.node !== "production", // índices auto en dev
      serverSelectionTimeoutMS: 10000,
    });

    console.log(
      `[db] Connected to MongoDB -> ${conn.connection.host}/${conn.connection.name}`
    );

    // Eventos útiles
    mongoose.connection.on("error", (err) => {
      console.error("[db] Connection error:", err);
    });
    mongoose.connection.on("disconnected", () => {
      console.warn("[db] Disconnected from MongoDB");
    });
    mongoose.connection.on("reconnected", () => {
      console.log("[db] Reconnected to MongoDB");
    });
  } catch (err) {
    console.error("[db] Mongo connection error:", err?.message || err);
    process.exit(1);
  }
}
