import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import { errors as celebrateErrors } from 'celebrate';
import apiRoutes from './routes/index.js';
import { env } from './config/env.js';
import { connectDB } from './config/db.js';
import { corsMw } from './middleware/cors.js';
import { apiLimiter } from './middleware/rateLimiter.js';
import { errorHandler, notFound } from './middleware/errorHandler.js';
import 'express-async-errors';

const app = express();

// Security & middlewares
app.use(helmet());
if (env.node !== 'production') app.use(morgan('dev'));
app.use(compression());
app.use(express.json({ limit: '2mb' }));
app.use(corsMw);
app.use('/api', apiLimiter);

// Routes
app.use('/api', apiRoutes);

// Errors
app.use(notFound);
app.use(celebrateErrors());
app.use(errorHandler);

const start = async () => {
  await connectDB();
  app.listen(env.port, () => console.log(`[api] http://localhost:${env.port}`));
};

start();