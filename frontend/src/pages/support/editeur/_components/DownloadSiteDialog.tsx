/** « Télécharger le site »: the address where the site will live (the owner's wish typed in), then the ZIP. A new
 *  key each time: a site already online must be put back with the new file. */
import { useState } from "react";
import { Download } from "lucide-react";

import { Button } from "@/_components/atoms/Button";
import { Dialog, DialogContent } from "@/_components/atoms/Dialog";
import { Callout } from "@/_components/molecules/Callout";
import { DialogBody, DialogFooter, DialogHeader } from "@/_components/molecules/DialogShell";
import { TextField } from "@/_components/molecules/TextField";
import { useT } from "@/i18n/I18nProvider";

export function DownloadSiteDialog({
  initialDomain,
  isDownloading,
  onClose,
  onDownload,
}: {
  initialDomain: string;
  isDownloading: boolean;
  onClose: () => void;
  onDownload: (domain: string) => Promise<unknown>;
}) {
  const t = useT();
  const [domain, setDomain] = useState(initialDomain);
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg gap-0 overflow-hidden p-0">
        <DialogHeader
          icon={<Download className="size-4" />}
          title={t("store.download")}
          subtitle={t("store.downloadHint")}
          onClose={onClose}
        />
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (domain.trim()) void onDownload(domain.trim()).then(onClose);
          }}
        >
          <DialogBody>
            <TextField
              label={t("store.siteDomain")}
              hint={t("store.siteDomainHint")}
              placeholder="pharmacie-exemple.ma"
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              autoFocus
            />
            <Callout tone="warning">{t("store.newKeyWarning")}</Callout>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={onClose}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={!domain.trim()} isLoading={isDownloading}>
              <Download className="size-4" />
              {t("store.download")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
