/** Route container for /exports — history of past project exports.
 *
 *  The ZIP export pipeline is not yet implemented in the backend, so this
 *  route currently shows an empty state. As soon as the export endpoint
 *  lands, swap `rows={[]}` for the fetched list. */
import { toast } from "sonner";

import { useT } from "@/i18n/I18nProvider";
import { ExportsTable } from "./_components/ExportsTable";


export default function DevExportsRoute() {
  const t = useT();
  return (
    <ExportsTable
      rows={[]}
      onRedownload={() => toast.info(t("store.redownloadSoon"))}
    />
  );
}
