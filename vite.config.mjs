import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { fileURLToPath } from "url";
import { WebSocketServer } from "ws";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let apiServer = null;

export default defineConfig({
  base: "./",
  plugins: [
    react(),
    {
      name: "express-server",
      apply: "serve",
      async configureServer(server) {
        const { createServer: createExpressServer } = await import("./server/index.ts");
        apiServer = await createExpressServer();

        server.middlewares.use((req, res, next) => {
          if (req.url.startsWith("/api") || req.url === "/health") {
            return apiServer(req, res, next);
          }
          next();
        });

        const wss = new WebSocketServer({ noServer: true });
        const rooms = new Map();

        server.httpServer?.on("upgrade", (request, socket, head) => {
          const match = request.url?.match(/^\/ws\/(.+)$/);
          if (!match) return;

          wss.handleUpgrade(request, socket, head, (ws) => {
            const roomId = decodeURIComponent(match[1]);
            if (!rooms.has(roomId)) rooms.set(roomId, new Set());
            const users = rooms.get(roomId);
            users.add(ws);

            ws.on("close", () => {
              users.delete(ws);
              if (users.size === 0) rooms.delete(roomId);
            });
          });
        });
      },
    },
  ],

  resolve: {
    alias: {
      "@": path.resolve(__dirname, "client"),       // ✅ Your UI
      "@shared": path.resolve(__dirname, "shared"), // ✅ Shared logic folder
      "@lib": path.resolve(__dirname, "shared/lib") // ✅ This replaces "@/lib"
    },
  },

  build: {
    outDir: "dist/spa",
    emptyOutDir: true,
  },
  server: {
    hmr: { overlay: false },
  },
});
