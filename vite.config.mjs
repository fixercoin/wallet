import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import fs from "fs";

export default defineConfig({
  plugins: [
    react(),
    {
      name: "copy-functions",
      apply: "build",
      enforce: "post",
      generateBundle() {
        // Copy functions directory to dist after build
        const functionsDir = "functions";
        const distFunctionsDir = "dist/functions";

        if (fs.existsSync(functionsDir)) {
          if (fs.existsSync(distFunctionsDir)) {
            fs.rmSync(distFunctionsDir, { recursive: true, force: true });
          }
          fs.cpSync(functionsDir, distFunctionsDir, { recursive: true });
          console.log("✓ Copied functions directory to dist for Cloudflare Pages");
        }
      },
    },
  ],
  resolve: {
    alias: {
      "@": path.resolve(new URL(".", import.meta.url).pathname, "client"),
    },
  },
  server: {
    host: true,
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:3000",
        changeOrigin: true,
        rewrite: (path) => path,
      },
    },
  },
});
