/** Route container for /exports — history of past project exports. */
import { toast } from "sonner";

import { MOCK_EXPORTS } from "@/fixtures/storeWebsite";

import { ExportsTable } from "./_components/ExportsTable";


export default function DevExportsRoute() {
  return (
    <ExportsTable
      rows={MOCK_EXPORTS}
      onRedownload={() => toast.info("Re-téléchargement simulé — backend à venir")}
    />
  );
}
