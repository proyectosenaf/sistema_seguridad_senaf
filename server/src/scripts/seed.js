// server/src/scripts/seed.js
import 'dotenv/config';
import mongoose from 'mongoose';
import { connectDB } from '../config/db.js';

// ---------- Utilidades ----------
const oid = () => new mongoose.Types.ObjectId();

const WANT = (() => {
  // Define qué dominios sembrar: SEED_SCOPE=all | rondas,incidentes,visitas,...
  const scopes = (process.env.SEED_SCOPE || 'rondas')
    .split(',')
    .map(s => s.trim().toLowerCase());
  return new Set(scopes);
})();
const wants = (key) => WANT.has('all') || WANT.has(key);

// import dinámico “opcional”: si el archivo no existe, devuelve null
async function optionalImport(path) {
  try {
    const mod = await import(path);
    return mod?.default ?? mod;
  } catch (e) {
    if (e?.code === 'ERR_MODULE_NOT_FOUND') {
      console.warn(`[seed] Módulo opcional no encontrado: ${path} (OK, se omite)`);
      return null;
    }
    throw e;
  }
}

// ---------- SEED RONDAS ----------
async function seedRondas() {
  if (!wants('rondas')) return;

  const Route         = await optionalImport('../models/Route.js');
  const RondaShift    = await optionalImport('../models/RondaShift.js');
  const RondaEvent    = await optionalImport('../models/RondaEvent.js');
  const Guard         = await optionalImport('../models/Guard.js');
  const RondaAssign   = await optionalImport('../models/RondaAssignment.js'); // tu modelo de asignaciones

  if (!Route) {
    console.warn('[seed:rondas] No hay modelo Route.js aún. Se omite Rondas.');
    return;
  }

  if (process.env.SEED_RESET === '1') {
    console.log('[seed:rondas] SEED_RESET=1 → limpiando colecciones Route/RondaShift/RondaEvent/RondaAssignment…');
    await Promise.allSettled([
      Route?.deleteMany?.({}) ?? Promise.resolve(),
      RondaShift?.deleteMany?.({}) ?? Promise.resolve(),
      RondaEvent?.deleteMany?.({}) ?? Promise.resolve(),
      RondaAssign?.deleteMany?.({}) ?? Promise.resolve(),
    ]);
  }

  // ---------- Crear rutas demo si no hay ----------
  const count = await Route.countDocuments({});
  if (count > 0) {
    console.log(`[seed:rondas] Ya existen ${count} rutas. No se crean duplicados.`);
  } else {
    const siteA = oid();
    const siteB = oid();

    const routes = [
      {
        siteId: siteA,
        name: 'Perímetro General - Turno Noche',
        code: 'R-PERIM-NOCHE',
        checkpoints: [
          {
            code: 'A1',
            name: 'Portón Norte',
            order: 1,
            allowedMethods: ['qr', 'nfc'],
            expectedSecondsFromStart: 60,
            graceSeconds: 120,
            requirePhoto: false,
            requireNote: false,
            tags: ['entrada', 'vehículos'],
          },
          {
            code: 'A2',
            name: 'Estacionamiento',
            order: 2,
            allowedMethods: ['qr'],
            expectedSecondsFromStart: 5 * 60,
            graceSeconds: 120,
            requirePhoto: true,
            requireNote: false,
            tags: ['patrulla'],
          },
          {
            code: 'A3',
            name: 'Bodega',
            order: 3,
            allowedMethods: ['qr', 'nfc'],
            expectedSecondsFromStart: 10 * 60,
            graceSeconds: 180,
            requirePhoto: false,
            requireNote: true,
            tags: ['sensibles'],
          },
        ],
        windows: [{ dow: [0,1,2,3,4,5,6], start: '20:00', end: '06:00' }],
        sla: { lateThresholdSeconds: 180, missingThresholdSeconds: 600 },
        active: true,
        createdBy: 'seed',
        updatedBy: 'seed',
      },
      {
        siteId: siteB,
        name: 'Puntos Críticos - Diurno',
        code: 'R-CRIT-DIA',
        checkpoints: [
          {
            code: 'B1',
            name: 'Sala de Servidores',
            order: 1,
            allowedMethods: ['qr', 'nfc'],
            expectedSecondsFromStart: 120,
            graceSeconds: 120,
            requirePhoto: false,
            requireNote: true,
            tags: ['TI'],
          },
          {
            code: 'B2',
            name: 'Recepción',
            order: 2,
            allowedMethods: ['qr'],
            expectedSecondsFromStart: 6 * 60,
            graceSeconds: 120,
            requirePhoto: false,
            requireNote: false,
            tags: ['acceso'],
          },
        ],
        windows: [{ dow: [1,2,3,4,5], start: '08:00', end: '18:00' }],
        sla: { lateThresholdSeconds: 180, missingThresholdSeconds: 600 },
        active: true,
        createdBy: 'seed',
        updatedBy: 'seed',
      },
    ];

    await Route.insertMany(routes);
    console.log(`[seed:rondas] Rutas creadas: ${routes.length}`);
  }

  // ---------- (Opcional) Crear guardia demo + asignación ----------
  if (process.env.SEED_CREATE_ASSIGNMENTS === '1') {
    if (!Guard) {
      console.warn('[seed:rondas] Guard.js no existe. Se omiten guardias/asignaciones.');
      return;
    }
    // Si no existe el modelo de asignación, no pasa nada.
    if (!RondaAssign) {
      console.warn('[seed:rondas] RondaAssignment.js no existe. Se omite crear asignaciones.');
      return;
    }

    const guardExternalId = process.env.SEED_GUARD_EXTERNAL_ID || 'guard-demo@acme';
    let guard = await Guard.findOne({ externalId: guardExternalId });
    if (!guard) {
      guard = await Guard.create({ externalId: guardExternalId, name: guardExternalId });
      console.log('[seed:rondas] Guardia creado:', guard._id, '-', guard.externalId);
    } else {
      console.log('[seed:rondas] Guardia existente:', guard._id, '-', guard.externalId);
    }

    const oneRoute = await Route.findOne({}).lean();
    if (!oneRoute) {
      console.warn('[seed:rondas] No hay rutas para asignar.');
      return;
    }

    // Evita duplicar asignaciones activas al mismo guardia/ruta
    const existingAsg = await RondaAssign.findOne({ routeId: oneRoute._id, guardId: guard._id, active: true });
    if (existingAsg) {
      console.log('[seed:rondas] Asignación ya existente:', existingAsg._id);
    } else {
      // Si tu schema de asignaciones es con "schedule" (como en el controlador nuevo)
      const doc = await RondaAssign.create({
        siteId: oneRoute.siteId,
        routeId: oneRoute._id,
        guardId: guard._id,
        guardExternalId: guard.externalId,
        active: true,
        schedule: {
          freqMinutes: 120,
          daysOfWeek: [1, 2, 3, 4, 5],
          window: { start: '00:00', end: '23:59' },
          tz: 'UTC',
        },
      });
      console.log('[seed:rondas] Asignación creada:', doc._id);
    }
  }
}

// ---------- STUBS p/ otros dominios (solo si tienes modelos) ----------
async function seedIncidentes() {
  if (!wants('incidentes')) return;
  // OJO: tu modelo es Incident.js (nuevo) o Incidente.js (viejo)?
  const Incident = await optionalImport('../models/Incident.js') || await optionalImport('../models/Incidente.js');
  if (!Incident) return;
  // Aquí podrías insertar 1–2 incidentes demo si lo deseas.
}

async function seedVisitas() {
  if (!wants('visitas')) return;
  const Visita = await optionalImport('../models/Visita.js');
  if (!Visita) return;
  // Inserta datos demo si lo deseas…
}

// ---------- MAIN ----------
async function main() {
  await connectDB();

  await seedRondas();
  await seedIncidentes();
  await seedVisitas();

  console.log('[seed] Listo.');
}

(async () => {
  try {
    await main();
  } catch (err) {
    console.error('[seed] Error:', err);
    process.exitCode = 1;
  } finally {
    try {
      await mongoose.connection.close();
      await mongoose.disconnect();
    } catch {}
  }
})();
