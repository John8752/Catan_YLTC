import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

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
      "/api": { target: "http://localhost:8787", changeOrigin: false },
      "/ws": {
        target: "ws://localhost:8787",
        ws: true,
        changeOrigin: false,
      },
    },
  },
});
