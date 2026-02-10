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
        MONGODB_URI:"mongodb+srv://proyectosenaf_db_user:SENAFdb2025@senafcluster.vwwt8sy.mongodb.net/senafseg?retryWrites=true&w=majority" ,


        // Opcional (si usas Auth0 en backend)
        // AUTH0_DOMAIN: "dev-0046gqmh011jo75x.us.auth0.com",
        // AUTH0_AUDIENCE: "https://senaf",

        IAM_DEV_ALLOW_ALL: "0",
      },
    },
  ],
};
