import 'dotenv/config';

export const env = {
  node: process.env.NODE_ENV || 'development',
  port: Number(process.env.API_PORT || 4000),
  mongoUri: process.env.MONGODB_URI,
  auth0: {
    domain: process.env.AUTH0_DOMAIN,
    audience: process.env.AUTH0_AUDIENCE,
  },
  corsOrigin: (process.env.CORS_ORIGIN || '*').split(',').map(s=>s.trim()),
};

['mongoUri', 'auth0.domain', 'auth0.audience'].forEach((k) => {
  const value = k.split('.').reduce((acc, part) => acc?.[part], env);
  if (!value) console.warn(`[env] Missing ${k}`);
});