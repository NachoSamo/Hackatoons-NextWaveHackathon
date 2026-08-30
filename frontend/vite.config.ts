import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Dev proxy: the frontend calls "/api/..." and "/health"; Vite forwards to the
// backend on :8000 so there is no CORS in local dev.
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api": "http://localhost:8000",
      "/health": "http://localhost:8000",
    },
  },
});
