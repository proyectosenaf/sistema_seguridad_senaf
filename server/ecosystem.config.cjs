module.exports = {
  apps: [
    {
      name: "senaf-api",
      script: "src/server.js",
      cwd: __dirname,

      env_production: {
        NODE_ENV: "production",
        PORT: 4000,

        // ✅ OBLIGATORIO (Atlas / Producción)
        MONGODB_URI: "mongodb+srv://USUARIO:PASS@cluster0.xxxxx.mongodb.net/senaf?retryWrites=true&w=majority",

        // Opcional (si usas Auth0 en backend)
        // AUTH0_DOMAIN: "tu-dominio.auth0.com",
        // AUTH0_AUDIENCE: "https://tu-api",

        IAM_DEV_ALLOW_ALL: "0",
      },
    },
  ],
};
