module.exports = {
  apps: [
    {
      name: "senaf",
      script: "src/server.js",
      cwd: "./api",

      env_production: {
        NODE_ENV: "production",
        PORT: 4000,

        // Mongo
        MONGODB_URI: "mongodb+srv://proyectosenaf_db_user:SENAFdb2025@senafcluster.vwwt8sy.mongodb.net/senafseg?retryWrites=true&w=majority",

        // ✅ JWT HS256 (lo que tu middleware/IAM usan)
        JWT_SECRET: "***", // 32+ chars

        // OTP / seguridad
        OTP_TTL_MINUTES: "10",
        OTP_MAX_ATTEMPTS: "5",

        // SMTP
        SMTP_HOST: "***",
        SMTP_PORT: "587",
        SMTP_SECURE: "0",
        SMTP_USER: "***",
        SMTP_PASS: "***",
        SMTP_FROM: "SENAF <proyectosenaf@gmail.com>",

        IAM_DEV_ALLOW_ALL: "0",
      },
    },
  ],
};