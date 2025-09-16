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

// ----------------------------------------------------------------------------
// App + middlewares HTTP
// ----------------------------------------------------------------------------
const app = express();

app.use(helmet());
if (env.node !== 'production') app.use(morgan('dev'));
app.use(compression());
app.use(express.json({ limit: '2mb' }));
app.use(corsMw);
app.use('/api', apiLimiter);

// Healthcheck muy útil para monitoreo/load balancers
app.get('/api/health', (_req, res) => res.json({ ok: true }));

// ----------------------------------------------------------------------------
// Tiempo real (Socket.IO) + EventBus interno
// ----------------------------------------------------------------------------
export const bus = new EventEmitter(); // otros módulos emiten aquí

const server = http.createServer(app);

// Permite origenes definidos en tu CORS; fallback a localhost en dev
const allowedOrigins =
  (env.corsOrigins && env.corsOrigins.length) ?
    env.corsOrigins :
    ['http://localhost:3000','http://localhost:5173'];

export const io = new SocketIOServer(server, {
  cors: { origin: allowedOrigins, methods: ['GET','POST','PATCH','DELETE'] },
});

// Conexión básica de sockets
io.on('connection', (socket) => {
  // aquí podrías autenticar sockets si lo necesitas
  socket.emit('hello', { ok: true, ts: Date.now() });
});

// Reemite eventos del bus a todos los sockets
[
  'email:new',
  'message:new',
  'appointment:new',
  'bitacora:new',
  'notifications:count-updated',
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
app.use(celebrateErrors()); // errores de celebrate (400 con detalle)
app.use(errorHandler);      // handler global

// ----------------------------------------------------------------------------
// Inicio + apagado elegante
// ----------------------------------------------------------------------------
const start = async () => {
  await connectDB();

  server.listen(env.port, () => {
    console.log(`[api] http://localhost:${env.port}`);
  });

  const shutdown = (signal) => async () => {
    try {
      console.log(`\n[api] ${signal} recibido. Cerrando…`);
      io.close();          // cierra sockets
      server.close(() => { // cierra HTTP
        console.log('[api] HTTP detenido.');
        process.exit(0);
      });
      // Si en 5s no cerró, fuerza salida
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
