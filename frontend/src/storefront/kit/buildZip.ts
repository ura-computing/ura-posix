/** « Télécharger le site »: the store's source, made in the browser and downloaded (nothing is kept on the server):
 *  the models, the pages (`ui/`) + `StoreApp.tsx` as they are in the app, the shared types, the fixed files (`scaffold.ts`) and the
 *  `.env` with the new key. The sources load only now (`import.meta.glob` lazy, `?raw`). */
import { envFile, scaffold } from "./scaffold";

const TEMPLATES = import.meta.glob("../templates/**/*.{ts,tsx}", { query: "?raw", import: "default" });
const UI = import.meta.glob("../ui/*.{ts,tsx}", { query: "?raw", import: "default" });
const KIT = import.meta.glob("./StoreApp.tsx", { query: "?raw", import: "default" });
const TYPES = import.meta.glob("../../types/storeWebsite.ts", { query: "?raw", import: "default" });

/** Same place as in the app: "../ui/Home.tsx" → "src/storefront/ui/Home.tsx",
 *  "./StoreApp.tsx" → "src/storefront/kit/StoreApp.tsx", "../../types/storeWebsite.ts" → "src/types/storeWebsite.ts". */
const zipPath = (path: string) =>
  path.startsWith("../../")
    ? `src/${path.slice(6)}`
    : path.startsWith("../")
      ? `src/storefront/${path.slice(3)}`
      : `src/storefront/kit/${path.slice(2)}`;

export async function downloadSite({
  storeName,
  apiUrl,
  key,
  domain,
}: {
  storeName: string;
  apiUrl: string;
  key: string;
  domain: string;
}) {
  const { default: JSZip } = await import("jszip");
  const zip = new JSZip();
  const folder = zip.folder(domain.replace(/[^a-z0-9.-]/gi, "-")) ?? zip;
  for (const [path, text] of Object.entries(scaffold(storeName))) folder.file(path, text);
  folder.file(".env", envFile(apiUrl, key, domain));
  for (const sources of [TEMPLATES, UI, KIT, TYPES]) {
    for (const [path, load] of Object.entries(sources)) folder.file(zipPath(path), (await load()) as string);
  }
  const blob = await zip.generateAsync({ type: "blob" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `${domain}.zip`;
  link.click();
  URL.revokeObjectURL(link.href);
}
