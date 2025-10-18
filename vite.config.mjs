import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(new URL(import.meta.url)));

let apiServer = null;
let apiServerPromise = null;

export default defineConfig({
  base: "./",
  plugins: [
    react(),
    {
      name: "express-server",
      apply: "serve",
      async configureServer(server) {
        // Initialize the Express server once
        if (!apiServerPromise) {
          apiServerPromise = (async () => {
            try {
              const { createServer: createExpressServer } = await import(
                "./server/index.ts"
              );
              const app = await createExpressServer();
              console.log("[Vite] ✅ Express server initialized");
              return app;
            } catch (err) {
              console.error("[Vite] ❌ Failed to initialize Express server:", err);
              throw err;
            }
          })();
        }

        return () => {
          server.middlewares.use(async (req, res, next) => {
            // Only handle /api requests with the Express app
            if (req.url.startsWith("/api") || req.url === "/health") {
              try {
                if (!apiServer) {
                  apiServer = await apiServerPromise;
                }
                apiServer(req, res, next);
              } catch (err) {
                console.error("[Vite] Express middleware error:", err);
                res.status(500).json({ error: "Internal server error" });
              }
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
