import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(new URL(".", import.meta.url).pathname, "client"),
    },
  },
  build: {
    outDir: "dist",
    assetsDir: "assets",
    sourcemap: false,
    minify: "terser",
  },
  server: {
    host: true,
    port: 5173,
    proxy: {
      "/api": {
        target: "https://fixorium-api.khanbabusargodha.workers.dev",
        changeOrigin: true,
        rewrite: (path) => path,
        secure: true,
      },
    },
  },
});
