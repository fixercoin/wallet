import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174,
    proxy: {
      "/api": {
        target: process.env.VITE_P2P_URL || "http://localhost:8787",
        changeOrigin: true,
      },
      "/ws": {
        target: process.env.VITE_P2P_URL || "http://localhost:8787",
        ws: true,
        changeOrigin: true,
      },
    },
  },
});
