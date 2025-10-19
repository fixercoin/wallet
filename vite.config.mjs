import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(new URL(import.meta.url)));

let apiServer = null;

export default {
  base: "./",
  plugins: [
    react(),
    {
      name: "express-server",
      apply: "serve",
      async configureServer(server) {
        // Load and initialize the Express server
        try {
          const { createServer: createExpressServer } = await import(
            "./server/index.ts"
          );
          apiServer = await createExpressServer();
          console.log("[Vite] ✅ Express server initialized");
        } catch (err) {
          console.error("[Vite] ❌ Failed to initialize Express:", err);
          throw err;
        }

        // Register middleware BEFORE other middleware
        server.middlewares.use((req, res, next) => {
          // Only handle /api and /health requests with the Express app
          if (req.url.startsWith("/api") || req.url === "/health") {
            console.log(
              `[Vite Middleware] Routing ${req.method} ${req.url} to Express`,
            );
            return apiServer(req, res, next);
          }
          next();
        });

        // Don't return anything - middleware is already registered
      },
    },
  ],
  build: {
    outDir: "dist/spa",
    emptyOutDir: true,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "client"),
      "@shared": path.resolve(__dirname, "shared"),
      "@utils": path.resolve(__dirname, "utils"),
    },
  },
};
