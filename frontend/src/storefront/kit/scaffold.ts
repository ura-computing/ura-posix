/** The fixed files of a downloaded store site (the templates and `StoreApp.tsx` are added as they are in the app).
 *  `npm install && npm run build` → `dist/`, to put on any static host at the domain typed by Support. */

const FONTS =
  "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600&family=Fraunces:wght@500;600&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@500;600&family=Plus+Jakarta+Sans:wght@400;500;600&family=Playfair+Display:wght@500;600&family=Spectral:wght@400;500&display=swap";

export const scaffold = (storeName: string): Record<string, string> => ({
  "package.json": `${JSON.stringify(
    {
      name: "pharmagest-store",
      private: true,
      type: "module",
      scripts: { dev: "vite", build: "vite build", preview: "vite preview --port 4173" },
      dependencies: {
        "framer-motion": "^12.42.0",
        "lucide-react": "^1.21.0",
        react: "^19.2.6",
        "react-dom": "^19.2.6",
      },
      devDependencies: {
        "@tailwindcss/vite": "^4.3.1",
        "@types/react": "^19.2.14",
        "@types/react-dom": "^19.2.3",
        "@vitejs/plugin-react": "^6.0.1",
        tailwindcss: "^4.3.1",
        typescript: "~6.0.2",
        vite: "^8.0.12",
      },
    },
    null,
    2,
  )}\n`,
  "vite.config.ts": `import { fileURLToPath, URL } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
});
`,
  "tsconfig.json": `${JSON.stringify(
    {
      compilerOptions: {
        target: "ES2022",
        lib: ["ES2022", "DOM", "DOM.Iterable"],
        module: "ESNext",
        moduleResolution: "bundler",
        jsx: "react-jsx",
        strict: true,
        skipLibCheck: true,
        types: ["vite/client"],
        paths: { "@/*": ["./src/*"] },
      },
      include: ["src"],
    },
    null,
    2,
  )}\n`,
  "index.html": `<!doctype html>
<html lang="fr">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${storeName.replace(/[<&>"]/g, "")}</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link rel="stylesheet" href="${FONTS}" />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
`,
  "src/main.tsx": `import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import "./index.css";
import { StoreApp } from "./storefront/kit/StoreApp";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <StoreApp />
  </StrictMode>,
);
`,
  "src/index.css": `@import "tailwindcss";\n`,
  "src/utils/format.ts": `/** Prices in MAD, French style: « 1 234,00 MAD ». */
const MAD = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "MAD" });

export function formatMADStr(n: number | null | undefined): string {
  return n == null ? "—" : MAD.format(n);
}
`,
  // Recipes start with a tab (Make's rule).
  Makefile: [
    ".PHONY: all help install dev build preview deploy stop logs clean",
    "",
    "all: build  ## make = build the site (dist/)",
    "",
    "help:     ## The commands",
    '\t@grep -E "^[a-z]+:.*##" Makefile | sed "s/:.*## / → /"',
    "",
    "install:  ## Install what the site needs (once)",
    "\tnpm install",
    "",
    "dev:      ## Try the site while changing it (http://localhost:5173)",
    "\tnpm run dev",
    "",
    "build: install  ## Make the site to publish: the dist/ folder",
    "\tnpm run build",
    "",
    "preview: build  ## See the built site (http://localhost:4173)",
    "\tnpm run preview",
    "",
    "deploy:   ## Put the site online with Docker (nginx, port PORT of .env)",
    "\tdocker compose up -d --build",
    "",
    "stop:     ## Stop the online site",
    "\tdocker compose down",
    "",
    "logs:     ## The site's server log",
    "\tdocker compose logs -f",
    "",
    "clean:    ## Remove what install / build made",
    "\trm -rf node_modules dist",
    "",
  ].join("\n"),
  ".gitignore": "node_modules\ndist\n",
  ".dockerignore": "node_modules\ndist\n.git\n",
  // Build with Node, serve with nginx (stable 1.30.7: the 18 Nov 2026 security fixes, nginx2root).
  Dockerfile: `FROM node:22-alpine AS build
WORKDIR /app
COPY package.json ./
RUN npm install
COPY . .
RUN npm run build

FROM nginx:1.30.7-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
`,
  "nginx.conf": `server_tokens off;

server {
    listen 80;
    server_name _;
    root /usr/share/nginx/html;
    index index.html;

    gzip on;
    gzip_types text/css application/javascript application/json image/svg+xml;

    # A location with its own add_header drops the server's: the safety headers go in each one.
    # Built files have their hash in their name: kept a year by browsers.
    location /assets/ {
        add_header Cache-Control "public, immutable" always;
        add_header X-Content-Type-Options nosniff always;
        expires 1y;
        try_files $uri =404;
    }

    # The page itself: always fresh (one page, the address holds the rest).
    location / {
        add_header Cache-Control "no-cache" always;
        add_header X-Content-Type-Options nosniff always;
        add_header X-Frame-Options SAMEORIGIN always;
        add_header Referrer-Policy strict-origin-when-cross-origin always;
        try_files $uri /index.html;
    }
}
`,
  "docker-compose.yml": `services:
  store:
    build: .
    ports:
      - "\${PORT:-80}:80"
    restart: unless-stopped
`,
  "README.md": `# ${storeName} — boutique en ligne

Site vitrine de la pharmacie. Les produits, prix, promos, packs et réglages viennent en direct de PharmaGest :
ce que la pharmacie change apparaît tout de suite, sans republier le site.

## Publier

\`\`\`bash
make install       # une fois
make               # construit le site : dossier dist/
make preview       # voir le site construit (http://localhost:4173)
make deploy        # mettre en ligne avec Docker (nginx), port PORT du .env
make help          # toutes les commandes
\`\`\`

Mettez le dossier \`dist/\` sur un hébergement statique **à l'adresse prévue** (celle du fichier \`.env\`) :
PharmaGest refuse les appels venant d'une autre adresse.

## .env

| Variable | Rôle |
|---|---|
| \`VITE_PHARMAGEST_API_URL\` | l'adresse de PharmaGest |
| \`VITE_PHARMAGEST_STORE_KEY\` | la clé du site (une nouvelle clé remplace l'ancienne : republiez alors le site) |
| \`VITE_PHARMAGEST_DOMAIN\` | l'adresse du site (pour mémoire) |
| \`PORT\` | le port de \`make deploy\` (80 ; mettez le HTTPS devant : Caddy, Traefik, un load balancer…) |

Essai en local : demandez au Support une clé pour \`localhost:4173\`, puis \`make preview\`.
`,
});

/** « localhost:4173 » → PORT=4173 (a local try); a real domain → 80. */
export const envFile = (apiUrl: string, key: string, domain: string) =>
  `VITE_PHARMAGEST_API_URL=${apiUrl}\nVITE_PHARMAGEST_STORE_KEY=${key}\nVITE_PHARMAGEST_DOMAIN=${domain}\nPORT=${domain.split(":")[1] ?? "80"}\n`;
