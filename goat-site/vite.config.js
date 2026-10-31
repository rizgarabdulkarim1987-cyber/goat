import { defineConfig } from "vite";
import { resolve } from "node:path";

// every page is its own entry so `vite build` ships them all
const pages = ["index", "about", "work", "contact", "blog", "music", "search", "social"];

export default defineConfig({
  build: {
    target: "esnext", // main.js waits for the backend with a top-level await
    rollupOptions: { input: Object.fromEntries(pages.map((p) => [p, resolve(import.meta.dirname, `${p}.html`)])) },
  },
});
