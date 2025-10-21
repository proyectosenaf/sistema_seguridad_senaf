import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 3000,
    open: false,
    proxy: {
      // 🔁 Todo lo que empiece con /api se redirige al backend en desarrollo
      "/api": {
        target: "http://localhost:4000",
        changeOrigin: true,
      },
    },
  },
});
