/** « Scanner / Rechercher un code barre »: scan with the USB reader (it types the code + Entrée)
 *  or type a barcode / PID + Entrée → that product's sheet; else « Aucun produit … », ready for
 *  the next scan. Mounted only while open: the field starts empty each time. */
import { useState, type FormEvent } from "react";
import { ScanBarcode, Search, X } from "lucide-react";

import { Button } from "@/_components/atoms/Button";
import { Dialog, DialogContent } from "@/_components/atoms/Dialog";
import { DialogBody, DialogFooter, DialogHeader } from "@/_components/molecules/DialogShell";
import { Input } from "@/_components/atoms/Input";
import { useT } from "@/i18n/I18nProvider";

import { useBarcodeLookup } from "./barcodeLookup";

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
      <form className="flex flex-col" onSubmit={(e) => void submit(e)}>
        <DialogHeader
          icon={<ScanBarcode className="size-4" />}
          title={t("products.scan")}
          subtitle={t("products.scanHint")}
          onClose={onClose}
        />
        <DialogBody>
          <Input
            autoFocus
            aria-label={t("products.scanInput")}
            placeholder={t("products.scanInput")}
            value={code}
            onValueChange={setCode}
            className="font-mono"
          />
          {notFound && (
            <p role="alert" className="text-sm font-medium text-error">
              {t("products.scanNotFound", { code: notFound })}
            </p>
          )}
        </DialogBody>
        <DialogFooter>
          <Button variant="secondary" onClick={onClose}>
            <X className="size-4" />
            {t("common.cancel")}
          </Button>
          <Button type="submit" variant="primary" disabled={!code.trim()} isLoading={isSearching}>
            <Search className="size-4" />
            {t("products.scanSearch")}
          </Button>
        </DialogFooter>
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
