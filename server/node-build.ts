import { createServer } from "./index";
import express from "express";
import * as nodePath from "path";
import { initializeKVStorage } from "./lib/kv-storage";

(async () => {
  // Initialize KV storage for persistent order data
  initializeKVStorage();

  // Create the API app (routes already have /api prefix)
  const app = await createServer();
  const port = process.env.PORT || 3000;

  // In production, serve the built SPA files
  const __dirname = import.meta.dirname;
  const distPath = nodePath.join(__dirname, "../spa");
  const isDevelopment = process.env.NODE_ENV !== "production";

  // Only serve static assets if they exist (production mode)
  try {
    const fs = await import("fs");
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));

      // SPA fallback: serve index.html for non-API routes
      app.get("*", (req, res) => {
        if (!req.path.startsWith("/api")) {
          res.sendFile(nodePath.join(distPath, "index.html"));
        } else {
          res.status(404).json({
            error: "API endpoint not found",
            path: req.path,
          });
        }
      });
    }
  } catch {
    // Ignore
  }

  // Development mode: proxy to Vite dev server for SPA
  if (isDevelopment) {
    app.get("/", async (req, res) => {
      try {
        const response = await fetch("http://localhost:5173/");
        const html = await response.text();
        res.setHeader("Content-Type", "text/html");
        res.send(html);
      } catch (err) {
        res.status(500).json({
          error: "Frontend development server not available",
          details: "Make sure Vite is running on port 5173",
        });
      }
    });
  }

  // 404 fallback for unmapped routes
  app.use((req, res) => {
    res.status(404).json({
      error: "API endpoint not found",
      path: req.path,
      method: req.method,
    });
  });

  app.listen(port, () => {
    console.log(`🚀 Fusion Starter server running on port ${port}`);
    console.log(`📱 Frontend: http://localhost:${port}`);
    console.log(`🔧 API: http://localhost:${port}/api`);
  });

  // Graceful shutdown
  process.on("SIGTERM", () => {
    console.log("🛑 Received SIGTERM, shutting down gracefully");
    process.exit(0);
  });

  process.on("SIGINT", () => {
    console.log("🛑 Received SIGINT, shutting down gracefully");
    process.exit(0);
  });
})();
