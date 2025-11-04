import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  base: "./",
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "client"),       // UI source
      "@shared": path.resolve(__dirname, "shared"), // Shared logic
      "@lib": path.resolve(__dirname, "shared/lib") // Replaces "@/lib"
    },
  },
  build: {
    outDir: "dist/spa",
    emptyOutDir: true,
  },
  server: {
    host: true,
    port: 5173,
  },
});
