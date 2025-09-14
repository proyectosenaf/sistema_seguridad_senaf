import mongoose from "mongoose";
import { config } from "dotenv";
config(); // lee server/.env

import "./../config/db.js"; // asegura connectDB si lo exportas con efecto
// O si tu connectDB no se autoejecuta:
import { connectDB } from "../config/db.js";
import Incidente from "../models/Incidente.js";
import Visita from "../models/Visita.js";
import Ronda from "../models/Ronda.js";
import Acceso from "../models/Acceso.js";
import Bitacora from "../models/Bitacora.js";
import Evaluacion from "../models/Evaluacion.js";

function user(name="Seeder") {
  return { sub:"seed|local", name, email:"seed@example.com" };
}

async function seed() {
  await connectDB?.(); // por si no se conectó aún
  await Promise.all([
    Incidente.deleteMany({}), Visita.deleteMany({}), Ronda.deleteMany({}),
    Acceso.deleteMany({}), Bitacora.deleteMany({}), Evaluacion.deleteMany({}),
  ]);

  await Incidente.insertMany([
    { titulo:"Puerta forzada en bodega", tipo:"Robo", descripcion:"Candado dañado", prioridad:"alta", estado:"abierto", fechaHora:new Date(), createdBy:user("Admin") },
    { titulo:"Corte eléctrico sector A", tipo:"Falla técnica", descripcion:"Planta en marcha", prioridad:"media", estado:"en_progreso", fechaHora:new Date(), createdBy:user("Admin") },
  ]);

  await Visita.insertMany([
    { nombre:"Carlos Pérez", documento:"0801-...", empresa:"Cliente X", motivo:"Reunión", anfitrion:"Milton", createdBy:user() },
    { nombre:"Ana Gómez", documento:"0802-...", motivo:"Entrega", anfitrion:"Recepción", createdBy:user() },
  ]);

  await Acceso.insertMany([
    { persona:"Colaborador 123", tipo:"entrada", area:"Principal", metodo:"tarjeta", autorizadoPor:user() },
    { persona:"Colaborador 123", tipo:"salida", area:"Principal", metodo:"tarjeta", autorizadoPor:user() },
  ]);

  await Ronda.create({
    guardia: user("Guardia A"),
    turno: "noche",
    puntos: [
      { nombre:"Perímetro norte", estado:"ok" },
      { nombre:"Estacionamiento", estado:"incidencia", nota:"vidrio roto" },
    ],
  });

  await Bitacora.create({ titulo:"Cambio de turno", detalle:"Entrega llaves y radio", categoria:"operativo", autor:user("Supervisor") });

  await Evaluacion.create({ guardia:user("Guardia A"), evaluador:user("Supervisor"), puntuacion:88, observaciones:"Buen desempeño" });

  console.log("[seed] OK");
  await mongoose.disconnect();
}
seed().catch(e=>{ console.error(e); process.exit(1); });
// node src/scripts/seed.js