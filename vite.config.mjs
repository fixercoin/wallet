import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(new URL(import.meta.url)));

let apiServer = null;

export default defineConfig({
  base: "./",
  plugins: [
    react(),
    {
      name: "express-server",
      apply: "serve",
      async configureServer(server) {
        // Load and initialize the Express server
        const { createServer: createExpressServer } = await import(
          "./server/index.ts"
        );
        apiServer = await createExpressServer();
        console.log("[Vite] ✅ Express server initialized");

        // Register middleware
        return () => {
          server.middlewares.use((req, res, next) => {
            // Only handle /api and /health requests with the Express app
            if (req.url.startsWith("/api") || req.url === "/health") {
              apiServer(req, res, next);
            } else {
              next();
            }
          });
        };
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
});
