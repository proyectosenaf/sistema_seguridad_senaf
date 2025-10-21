import mongoose from "mongoose";
import { env } from "./env.js";

/**
 * Resuelve nombre de base de datos a partir de la URI o variable directa.
 */
function resolveDbName(uri) {
  if (process.env.MONGO_DB_NAME) return process.env.MONGO_DB_NAME;
  if (typeof uri === "string") {
    const m = uri.match(/\/([^/?]+)(\?|$)/);
    if (m?.[1]) return decodeURIComponent(m[1]);
  }
  return "senafdb"; // 👉 nombre actualizado para el entorno empresarial
}

/**
 * Conecta a MongoDB Atlas con manejo de errores y reconexión.
 */
export async function connectDB() {
  const uri = env.mongoUri;
  if (!uri) {
    console.error("[db] ❌ No se definió MONGODB_URI o MONGO_URI en .env");
    process.exit(1);
  }

  const dbName = resolveDbName(uri);
  mongoose.set("strictQuery", true);

  try {
    const conn = await mongoose.connect(uri, {
      dbName,
      autoIndex: env.node !== "production",
      serverSelectionTimeoutMS: 10000,
      maxPoolSize: 20,
      appName: "senaf-api",
    });

    console.log(
      `[db] ✅ Conectado a MongoDB Atlas → ${conn.connection.host}/${conn.connection.name}`
    );

    mongoose.connection.on("error", (err) => console.error("[db] Error:", err));
    mongoose.connection.on("disconnected", () =>
      console.warn("[db] ⚠️ Desconectado de MongoDB")
    );
    mongoose.connection.on("reconnected", () =>
      console.log("[db] 🔁 Reconexion a MongoDB")
    );
  } catch (err) {
    console.error("[db] ❌ Error de conexión:", err?.message || err);
    process.exit(1);
  }
}
