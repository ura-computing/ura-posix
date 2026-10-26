/** Sobrus export pages (app.pharma.sobrus.com/reports/…):
 *  1. « Télécharger en CSV »: the file still downloads AND the same file goes to PharmaGest, named with
 *     its dates (« Sobrus - Ventes 2025-01-01 - 2025-12-31.csv »).
 *  2. « Importer tout l'historique » (popup): achats then ventes, year by year, shown step by step on
 *     the page (`imports.ts`, `spotlight.ts`).
 *  The card bottom right follows it all (`card.ts`). */
import { readLang } from "@/i18n/config";
import { onJobsChange, readJobs } from "@/utils/jobs";
import { EXPORT_LINK, FULL_EXPORT_KEY, type FullExport } from "@/utils/sobrusExport";

import { drawCard } from "./card";
import { importClicked, readFullExport, runFullExport } from "./imports";
import { onView, setView } from "./state";

document.addEventListener(
  "click",
  (e) => {
    const link = (e.target as Element | null)?.closest<HTMLAnchorElement>(EXPORT_LINK);
    if (link) void importClicked(link.href, link.download || "export.csv"); // the page's own download goes on
  },
  true,
);

onView(drawCard);
onJobsChange((jobs) => setView({ jobs }));
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes[FULL_EXPORT_KEY]) {
    setView({ full: (changes[FULL_EXPORT_KEY].newValue as FullExport | undefined) ?? null });
  }
});
void Promise.all([readLang(), readFullExport(), readJobs()]).then(([lang, full, jobs]) => {
  setView({ lang, full, jobs });
  void runFullExport();
});
