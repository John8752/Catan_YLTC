import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const backend = `http://127.0.0.1:${process.env.E2E_API_PORT ?? "8787"}`;

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  server: {
    proxy: {
      // Preserve the browser's Host for the server's same-origin CSRF check.
      "/api": { target: backend, changeOrigin: false },
      "/ws": {
        target: backend.replace("http:", "ws:"),
        ws: true,
        changeOrigin: false,
      },
    },
  },
});
