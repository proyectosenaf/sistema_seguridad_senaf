module.exports = {
  apps: [
    {
      name: "senaf",
      script: "src/server.js",
      cwd: "./api",

      env_production: {
        NODE_ENV: "production",
        PORT: 4000,

        // 🔹 MongoDB Atlas (producción)
        MONGODB_URI:"mongodb+srv://proyectosenaf_db_user:SENAFdb2025@senafcluster.vwwt8sy.mongodb.net/senafseg?retryWrites=true&w=majority" ,


        // 🔹 Auth0 (si lo usas)
        AUTH0_DOMAIN: "dev-0046gqmh011jo75x.us.auth0.com",
        AUTH0_AUDIENCE: "https://senaf",

        // 🔹 Opcional
        IAM_DEV_ALLOW_ALL: "0"
      }
    }
  ]
};
