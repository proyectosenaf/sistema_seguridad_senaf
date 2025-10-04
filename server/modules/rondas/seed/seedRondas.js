import "dotenv/config";
import mongoose from "mongoose";
import Zone from "../models/Zone.model.js";
import CP from "../models/Checkpoint.model.js";

const MONGO = process.env.MONGODB_URI || "mongodb://localhost:27017/senafseg";

async function seed() {
  console.log("[seed] uri:", MONGO);
  await mongoose.connect(MONGO);
  console.log("[seed] conectado");

  await Zone.deleteMany({});
  await CP.deleteMany({});
  console.log("[seed] colecciones vaciadas");

  const zonas = await Zone.insertMany([
    { code: "ZONA-001", name: "Perímetro Norte",        description: "Del portón norte a garita central", active: true },
    { code: "ZONA-002", name: "Perímetro Sur",          description: "Atrás del complejo / estacionamiento sur", active: true },
    { code: "ZONA-003", name: "Área Administrativa",    description: "Oficinas, pasillos y recepción", active: true },
    { code: "ZONA-004", name: "Bodegas y Talleres",     description: "Zona industrial y de almacenamiento", active: true },
    { code: "ZONA-005", name: "Estacionamientos",       description: "Parqueo de empleados y visitantes", active: true },
  ]);

  const cps = zonas.map((z, i) => ({
    zoneId: z._id,
    code: `CP-${z.code}`,
    name: `Punto principal ${i + 1}`,
    order: 1,
    qrPayload: `senaf:rondas:checkpoint:${z.code}`,
    expectedSecondsFromStart: 0,
    graceSeconds: 120,
    active: true,
  }));
  await CP.insertMany(cps);

  console.log("[seed] listo: zonas:", zonas.length, "cps:", cps.length);
  await mongoose.disconnect();
}

seed().catch(e => { console.error(e); process.exit(1); });
