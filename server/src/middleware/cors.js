import cors from 'cors';
import { env } from '../config/env.js';

export const corsMw = cors({
  origin: env.corsOrigin,
  credentials: true,
});