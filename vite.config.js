import path from "path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// Frontend lives in frontend/, built into dist/ (served by backend/server.js)
export default defineConfig({
    root: "frontend",
    plugins: [react(), tailwindcss()],
    resolve: {
        alias: { "@": path.resolve(__dirname, "frontend/src") }
    },
    build: {
        outDir: "../dist",
        emptyOutDir: true
    },
    server: {
        proxy: { "/api": "http://localhost:3000" }
    }
});
