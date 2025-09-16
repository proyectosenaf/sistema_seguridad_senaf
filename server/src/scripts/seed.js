// server/src/scripts/seed.js
import mongoose from "mongoose";
import { config } from "dotenv";
config(); // carga variables desde server/.env

import { connectDB } from "../config/db.js";

// Modelos existentes en tu proyecto
import Incidente from "../models/Incidente.js";
import Visita from "../models/Visita.js";
import Ronda from "../models/Ronda.js";
import Acceso from "../models/Acceso.js";
import Bitacora from "../models/Bitacora.js";
import Evaluacion from "../models/Evaluacion.js";

// Util para campos de auditoría compatibles con tus esquemas
function user(name = "Seeder", email = "seed@example.com") {
  return { sub: "seed|local", name, email };
}

async function seed() {
  // 1) Conexión (idempotente)
  await connectDB();

  // 2) Limpieza (si quieres conservar datos, comenta esta sección)
  // OJO: deleteMany([]) no borra índices ni colecciones, solo documentos.
  await Promise.allSettled([
    Incidente.deleteMany({}),
    Visita.deleteMany({}),
    Ronda.deleteMany({}),
    Acceso.deleteMany({}),
    Bitacora.deleteMany({}),
    Evaluacion.deleteMany({})
  ]);

  // 3) Inserciones (cada bloque protegido por try/catch para no abortar todo)
  try {
    await Incidente.insertMany([
      {
        titulo: "Puerta forzada en bodega",
        tipo: "Robo",
        descripcion: "Candado dañado",
        prioridad: "alta",
        estado: "abierto",
        fechaHora: new Date(),
        createdBy: user("Admin")
      },
      {
        titulo: "Corte eléctrico sector A",
        tipo: "Falla técnica",
        descripcion: "Planta en marcha",
        prioridad: "media",
        estado: "en_progreso",
        fechaHora: new Date(),
        createdBy: user("Admin")
      }
    ]);
  } catch (e) {
    console.warn("[seed] Incidente.insertMany() warning:", e.message);
  }

  try {
    await Visita.insertMany([
      {
        nombre: "Carlos Pérez",
        documento: "0801-XXXX-XXXX",
        empresa: "Cliente X",
        motivo: "Reunión",
        anfitrion: "Milton",
        createdBy: user()
      },
      {
        nombre: "Ana Gómez",
        documento: "0802-XXXX-XXXX",
        motivo: "Entrega",
        anfitrion: "Recepción",
        createdBy: user()
      }
    ]);
  } catch (e) {
    console.warn("[seed] Visita.insertMany() warning:", e.message);
  }

  try {
    await Acceso.insertMany([
      {
        persona: "Colaborador 123",
        tipo: "entrada",
        area: "Principal",
        metodo: "tarjeta",
        autorizadoPor: user("Supervisor")
      },
      {
        persona: "Colaborador 123",
        tipo: "salida",
        area: "Principal",
        metodo: "tarjeta",
        autorizadoPor: user("Supervisor")
      }
    ]);
  } catch (e) {
    console.warn("[seed] Acceso.insertMany() warning:", e.message);
  }

  try {
    await Ronda.create({
      guardia: user("Guardia A"),
      turno: "noche",
      puntos: [
        { nombre: "Perímetro norte", estado: "ok" },
        { nombre: "Estacionamiento", estado: "incidencia", nota: "vidrio roto" }
      ],
      createdBy: user("Supervisor") // si tu esquema lo admite
    });
  } catch (e) {
    console.warn("[seed] Ronda.create() warning:", e.message);
  }

  try {
    await Bitacora.create({
      titulo: "Cambio de turno",
      detalle: "Entrega llaves y radio",
      categoria: "operativo",
      autor: user("Supervisor")
    });
  } catch (e) {
    console.warn("[seed] Bitacora.create() warning:", e.message);
  }

  try {
    await Evaluacion.create({
      guardia: user("Guardia A"),
      evaluador: user("Supervisor"),
      puntuacion: 88,
      observaciones: "Buen desempeño"
    });
  } catch (e) {
    console.warn("[seed] Evaluacion.create() warning:", e.message);
  }

  console.log("[seed] Datos de ejemplo insertados correctamente.");
}

(async () => {
  try {
    await seed();
  } catch (e) {
    console.error("[seed] Error:", e);
    process.exitCode = 1;
  } finally {
    // Cierre limpio
    try {
      await mongoose.connection.close();
      await mongoose.disconnect();
    } catch {}
  }
})();
