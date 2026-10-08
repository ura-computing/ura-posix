/** « Scanner / Rechercher un code barre »: scan with the USB reader (it types the code + Entrée)
 *  or type a barcode / PID + Entrée → that product's sheet; else « Aucun produit … », ready for
 *  the next scan. Mounted only while open: the field starts empty each time. */
import { useState, type FormEvent } from "react";
import { ScanBarcode, Search, X } from "lucide-react";

import { AsyncButton } from "@/_components/AsyncButton";
import { Dialog, DialogContent } from "@/_components/dialog";
import { useT } from "@/i18n/I18nProvider";

import { useBarcodeLookup } from "../hooks";

function ScanForm({ onClose }: { onClose: () => void }) {
  const t = useT();
  const { lookup, isSearching } = useBarcodeLookup();
  const [code, setCode] = useState("");
  const [notFound, setNotFound] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const typed = code.trim();
    if (!typed) return;
    const found = await lookup(typed);
    if (found) onClose();
    else if (found === false) {
      setNotFound(typed);
      setCode("");
    }
  };

  return (
    <DialogContent className="max-w-md">
      <form className="flex flex-col gap-4 p-5" onSubmit={(e) => void submit(e)}>
        <h3 className="flex items-center gap-2 text-[17px] font-semibold text-foreground">
          <ScanBarcode className="size-5 text-primary" />
          {t("products.scan")}
        </h3>
        <p className="text-sm text-muted-foreground">{t("products.scanHint")}</p>
        <input
          autoFocus
          aria-label={t("products.scanInput")}
          placeholder={t("products.scanInput")}
          value={code}
          onChange={(e) => setCode(e.target.value)}
          className="h-12 w-full rounded-md border border-input bg-surface-subtle px-3 font-mono text-base text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        />
        {notFound && (
          <p role="alert" className="text-sm font-medium text-error">
            {t("products.scanNotFound", { code: notFound })}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <AsyncButton variant="secondary" onClick={onClose}>
            <X className="size-4" />
            {t("common.cancel")}
          </AsyncButton>
          <AsyncButton type="submit" variant="primary" disabled={!code.trim()} isLoading={isSearching}>
            <Search className="size-4" />
            {t("products.scanSearch")}
          </AsyncButton>
        </div>
      </form>
    </DialogContent>
  );
}

export function ScanDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <ScanForm onClose={onClose} />
    </Dialog>
  );
}
