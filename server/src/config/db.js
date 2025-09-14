// server/db.js
import mongoose from 'mongoose';
import { env } from './env.js';

export const connectDB = async () => {
  try {
    // Opcional en Mongoose >=7, pero no molesta
    mongoose.set('strictQuery', true);

    await mongoose.connect(env.mongoUri, {
      dbName: env.mongoDbName || 'senafseg',            // 👈 fuerza la DB
      autoIndex: env.node !== 'production',
      serverSelectionTimeoutMS: 10000,
    });

    console.log(
      `[db] Connected to MongoDB -> ${mongoose.connection.host}/${mongoose.connection.name}`
    );
  } catch (err) {
    console.error('[db] Mongo connection error:', err.message);
    process.exit(1);
  }
};
