import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { fileURLToPath } from "url";
import { WebSocketServer } from "ws";

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

        // Lightweight in-memory WebSocket rooms at /ws/:roomId for dev
        const wss = new WebSocketServer({ noServer: true });
        const rooms = new Map(); // roomId -> Set<WebSocket>

        server.httpServer?.on("upgrade", (request, socket, head) => {
          try {
            const url = request.url || "";
            const match = url.match(/^\/ws\/(.+)$/);
            if (!match) return; // not our WS route

            wss.handleUpgrade(request, socket, head, (ws) => {
              const roomId = decodeURIComponent(match[1]);
              if (!rooms.has(roomId)) rooms.set(roomId, new Set());
              const set = rooms.get(roomId);
              set.add(ws);

              ws.on("message", (data) => {
                let msg;
                try {
                  msg = JSON.parse(data.toString());
                } catch {
                  return;
                }
                if (msg && msg.type === "chat") {
                  const payload = JSON.stringify({
                    kind: "chat",
                    data: {
                      id: Math.random().toString(36).slice(2),
                      text: String(msg.text || ""),
                      at: Date.now(),
                    },
                  });
                  for (const client of set) {
                    try {
                      client.send(payload);
                    } catch {}
                  }
                } else if (msg && msg.kind === "notification") {
                  const payload = JSON.stringify({
                    kind: "notification",
                    data: msg.data,
                  });
                  for (const client of set) {
                    try {
                      client.send(payload);
                    } catch {}
                  }
                } else if (msg && msg.type === "ping") {
                  try {
                    ws.send(JSON.stringify({ kind: "pong", ts: Date.now() }));
                  } catch {}
                }
              });

              ws.on("close", () => {
                set.delete(ws);
                if (set.size === 0) rooms.delete(roomId);
              });
            });
          } catch (e) {
            // ignore ws errors
          }
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
