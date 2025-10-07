import { createServer } from "./index";
import express from "express";
import * as nodePath from "path";

(async () => {
  // Create the API app
  const apiApp = await createServer();
  const port = process.env.PORT || 3000;

  // Create the root app and mount API under /api (match dev behavior)
  const app = express();
  app.use("/api", apiApp);

  // In production, serve the built SPA files
  const __dirname = import.meta.dirname;
  const distPath = nodePath.join(__dirname, "../spa");

  // Serve static assets
  app.use(express.static(distPath));

  // SPA fallback for non-API routes
  app.get("*", (req, res) => {
    // Do not intercept API or health endpoints
    if (req.path.startsWith("/api/")) {
      return res.status(404).json({ error: "API endpoint not found" });
    }
    res.sendFile(nodePath.join(distPath, "index.html"));
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
