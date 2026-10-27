import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const localApiTarget = process.env.PARCELSENSE_API_TARGET ?? "http://127.0.0.1:8000";

export default defineConfig({
  base: "./",
  plugins: [react()],
  server: {
    proxy: {
      "/api": localApiTarget,
    },
  },
  build: {
    target: "es2022",
    sourcemap: false,
  },
});
