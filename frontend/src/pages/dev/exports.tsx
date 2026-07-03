/** Route container for /exports — history of past project exports.
 *
 *  The ZIP export pipeline is not yet implemented in the backend, so this
 *  route currently shows an empty state. As soon as the export endpoint
 *  lands, swap `rows={[]}` for the fetched list. */
import { toast } from "sonner";

import { ExportsTable } from "./_components/ExportsTable";


export default function DevExportsRoute() {
  return (
    <ExportsTable
      rows={[]}
      onRedownload={() => toast.info("Re-téléchargement — pipeline d'export à venir")}
    />
  );
}
