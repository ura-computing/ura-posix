import { defineConfig, loadEnv } from "vite";
import { fileURLToPath, URL } from "node:url";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { crx } from "@crxjs/vite-plugin";

import { makeManifest } from "./manifest.config";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  return {
    plugins: [react(), tailwindcss(), crx({ manifest: makeManifest(env.VITE_BACKEND_URL || "http://localhost:8000") })],
    resolve: {
      alias: {
        "@": fileURLToPath(new URL("./src", import.meta.url)),
      },
    },
    // ../frontend: the app's CSV reader (utils/csv.ts) and color tokens (styles/tokens.css).
    server: { fs: { allow: [".."] } },
  };
});
