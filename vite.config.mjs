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
        try {
          const { createServer: createExpressServer } = await import("./server/index.ts");
          apiServer = await createExpressServer();
          console.log("[Vite] ✅ Express server initialized");
        } catch (err) {
          console.error("[Vite] ❌ Failed to initialize Express:", err);
          throw err;
        }

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

            ws.on("message", (data) => {
              let msg;
              try {
                msg = JSON.parse(data.toString());
              } catch {
                return;
              }

              const broadcast = (payload) => {
                for (const client of users) client.send(JSON.stringify(payload));
              };

              if (msg.type === "chat") {
                broadcast({
                  kind: "chat",
                  data: {
                    id: Math.random().toString(36).slice(2),
                    text: msg.text ?? "",
                    at: Date.now(),
                  },
                });
              } else if (msg.kind === "notification") {
                broadcast({ kind: "notification", data: msg.data });
              } else if (msg.type === "ping") {
                ws.send(JSON.stringify({ kind: "pong", ts: Date.now() }));
              }
            });

            ws.on("close", () => {
              users.delete(ws);
              if (users.size === 0) rooms.delete(roomId);
            });
          });
        });
      },
    },
  ],
  build: {
    outDir: "dist/spa",
    emptyOutDir: true,
  },
  server: {
    hmr: { overlay: false },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),          // ✅ FIXED
      "@shared": path.resolve(__dirname, "shared"),
      "@utils": path.resolve(__dirname, "utils"),
    },
  },
});
