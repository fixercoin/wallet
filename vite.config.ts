
import { defineConfig, Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { createServer } from "./server";

export default defineConfig(({ mode }) => ({
  server: {
    host: "0.0.0.0",
    port: 8080,
    hmr: false, // Disable HMR to avoid websocket 'Invalid frame header' errors
    fs: {
      allow: ["./client", "./shared"],
      deny: [".env", ".env.*", "*.{crt,pem}", "**/.git/**", "server/**"],
    },
  },

  build: {
    outDir: "dist/spa",     // ✅ Build output folder
    base: "./",             // ✅ Ensures assets use relative paths (for Cloudflare + Netlify)
    emptyOutDir: true,      // ✅ Clears old builds
    sourcemap: false,       // Optional: disable source maps for smaller build
  },

  plugins: [react(), expressPlugin()],

  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./client"),
      "@shared": path.resolve(__dirname, "./shared"),
      buffer: "buffer",
      process: "process/browser",
      crypto: "crypto-browserify",
      stream: "stream-browserify",
    },
  },

  define: {
    global: "globalThis",
  },

  optimizeDeps: {
    include: ["buffer", "process", "crypto-browserify", "stream-browserify"],
  },
}));

function expressPlugin(): Plugin {
  return {
    name: "express-plugin",
    apply: "serve",
    async configureServer(server) {
      const app = await createServer();
      server.middlewares.use("/api", app);
    },
  };
}
