// src/server.js
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import EventEmitter from 'events';
import { errors as celebrateErrors } from 'celebrate';

import apiRoutes from './routes/index.js';
import { env } from './config/env.js';
import { connectDB } from './config/db.js';
import { corsMw } from './middleware/cors.js';
import { apiLimiter } from './middleware/rateLimiter.js';
import { errorHandler, notFound } from './middleware/errorHandler.js';
import 'express-async-errors';

// ⬇️ NUEVO: cron que marca “missed” y crea/cierra alertas
import { startMissedCheckCron } from './jobs/missedCheck.js';

// ----------------------------------------------------------------------------
// App + middlewares HTTP
// ----------------------------------------------------------------------------
const app = express();
app.set('trust proxy', 1);

app.use(helmet());
if (env.node !== 'production') app.use(morgan('dev'));
app.use(compression());
app.use(express.json({ limit: '2mb' }));
app.use(corsMw);
app.use('/api', apiLimiter);

// Healthchecks
app.get('/api/health', (_req, res) => res.json({ ok: true }));
app.get('/health', (_req, res) => res.json({ ok: true }));

// ----------------------------------------------------------------------------
// Tiempo real (Socket.IO) + EventBus interno
// ----------------------------------------------------------------------------
export const bus = new EventEmitter();

const server = http.createServer(app);

function normalizeOrigins() {
  if (Array.isArray(env.corsOrigins) && env.corsOrigins.length) return env.corsOrigins;
  if (Array.isArray(env.corsOrigin) && env.corsOrigin.length) return env.corsOrigin;
  if (typeof env.corsOrigin === 'string' && env.corsOrigin.trim() !== '') {
    return env.corsOrigin.split(',').map(s => s.trim());
  }
  if (env.node !== 'production') return ['http://localhost:3000', 'http://localhost:5173'];
  return [];
}

const allowedOrigins = normalizeOrigins();

export const io = new SocketIOServer(server, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    credentials: true,
  },
});

// ✅ io disponible desde controllers como req.app.get("io") y req.io
app.set('io', io);
app.use((req, _res, next) => { req.io = io; next(); });

// Conexión sockets
io.on('connection', (socket) => {
  socket.emit('hello', { ok: true, ts: Date.now() });
});

// Reemite eventos del bus a sockets (compatibilidad)
[
  'email:new',
  'message:new',
  'appointment:new',
  'bitacora:new',
  'notifications:count-updated',
  'ronda:iniciada',
].forEach((evt) => {
  bus.on(evt, (payload) => io.emit(evt, payload));
});

// ----------------------------------------------------------------------------
// Rutas de la API
// ----------------------------------------------------------------------------
app.use('/api', apiRoutes);

// ----------------------------------------------------------------------------
// Errores
// ----------------------------------------------------------------------------
app.use(notFound);          // 404
app.use(celebrateErrors()); // 400 de celebrate
app.use(errorHandler);      // handler global

// ----------------------------------------------------------------------------
// Inicio + apagado elegante
// ----------------------------------------------------------------------------
const start = async () => {
  if (!env?.port) {
    console.warn('[api] WARN: env.port no está definido. Usando 4000 por defecto.');
    env.port = 4000;
  }

  await connectDB();

  server.listen(env.port, async () => {
    console.log(`[api] http://localhost:${env.port}`);
    console.log(`[io] CORS origins: ${allowedOrigins.length ? allowedOrigins.join(', ') : '(ninguno)'}`);

    // (Opcional) monitor legacy si lo tienes
    try {
      const mod = await import('./jobs/rondas.monitor.js');
      if (typeof mod.startRondasMonitor === 'function') {
        mod.startRondasMonitor({ io });
        console.log('[monitor] Rondas monitor iniciado.');
      }
    } catch {
      // Silencioso
    }

    // ⏱️ Arranca el cron de “missed checks” (cada 2 min)
    startMissedCheckCron({ cron: '*/2 * * * *', logger: console });
  });

  const shutdown = (signal) => async () => {
    try {
      console.log(`\n[api] ${signal} recibido. Cerrando…`);
      io.close();
      server.close(() => {
        console.log('[api] HTTP detenido.');
        process.exit(0);
      });
      setTimeout(() => process.exit(0), 5000).unref();
    } catch (e) {
      console.error('[api] Error al cerrar:', e);
      process.exit(1);
    }
  };

  process.on('SIGINT', shutdown('SIGINT'));
  process.on('SIGTERM', shutdown('SIGTERM'));

  process.on('unhandledRejection', (err) => {
    console.error('[api] UnhandledRejection:', err);
  });
  process.on('uncaughtException', (err) => {
    console.error('[api] UncaughtException:', err);
  });
};

start();
