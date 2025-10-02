import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// IMPORTANT: tell Vite the app is served under /app/
export default defineConfig({
  base: "/app/",
  plugins: [react()],
  server: { host: true, port: 5173 }
});