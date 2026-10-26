/** Chrome Manifest V3. Hosts: the Sobrus export pages (where the CSV is downloaded) and the
 *  PharmaGest backend (VITE_BACKEND_URL, read at build time). The extension uses the cookies of the
 *  PharmaGest session open in the browser: no password stored in the extension. */
import { defineManifest } from "@crxjs/vite-plugin";

import pkg from "./package.json";

export const makeManifest = (backendUrl: string) =>
  defineManifest({
    manifest_version: 3,
    name: "PharmaGest — Import Sobrus",
    description: "Envoie les exports Sobrus (achats, ventes, stock) vers PharmaGest dès leur téléchargement.",
    version: pkg.version,
    action: { default_popup: "index.html" },
    permissions: ["storage"],
    host_permissions: [
      "https://app.pharma.sobrus.com/*",
      "https://*.sobrus.com/*",
      `${backendUrl.replace(/\/$/, "")}/*`,
    ],
    background: { service_worker: "src/background/index.ts", type: "module" },
    content_scripts: [
      {
        matches: ["https://app.pharma.sobrus.com/reports/*"],
        js: ["src/content/sobrus.ts"],
        run_at: "document_idle",
      },
    ],
  });
