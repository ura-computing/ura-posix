/** « Étiquette »: the product's shelf label — its name, its barcode, its price (PPV; with the owner's « Remise
 *  comptoir »: the PPV crossed out and the price after discount), the pharmacy's name. How many copies (« − » / « + »),
 *  then « Imprimer »: the browser's print window prints only the labels (`.print-area`, styles/globals.css), 3 per
 *  row, 63 × 38 mm each. */
import { useState } from "react";
import { createPortal } from "react-dom";
import { Printer } from "lucide-react";

import { Button } from "@/_components/atoms/Button";
import { Dialog, DialogContent } from "@/_components/atoms/Dialog";
import { DialogBody, DialogFooter, DialogHeader } from "@/_components/molecules/DialogShell";
import { QuantityField } from "@/_components/molecules/QuantityField";
import { useMe } from "@/hooks/useMe";
import { useT } from "@/i18n/I18nProvider";
import type { ProductSheet } from "@/types/products";
import { formatMADStr } from "@/utils/format";

import { BarcodeImage } from "./BarcodeImage";

function Label({ sheet, pharmacy }: { sheet: ProductSheet; pharmacy: string }) {
  const { ppv, counter_price: net } = sheet.prices;
  const code = sheet.barcode1 ?? sheet.barcode2;
  return (
    <div className="flex h-[38mm] w-[63mm] flex-col justify-between overflow-hidden rounded border border-black/30 bg-white p-[2.5mm] text-black">
      <span className="line-clamp-2 text-[11pt] font-bold leading-tight">{sheet.product}</span>
      <span className="flex items-end justify-between gap-2">
        {code ? (
          <span className="flex flex-col items-center">
            <BarcodeImage code={code} className="h-[11mm] w-[30mm] p-0" />
            <span className="font-mono text-[7pt]">{code}</span>
          </span>
        ) : (
          <span />
        )}
        <span className="flex flex-col items-end leading-none">
          {net != null && ppv != null && <span className="text-[9pt] line-through">{formatMADStr(ppv)}</span>}
          <span className="text-[15pt] font-extrabold">{formatMADStr(net ?? ppv)}</span>
        </span>
      </span>
      <span className="truncate text-[7pt]">{pharmacy}</span>
    </div>
  );
}

function LabelForm({ sheet, onClose }: { sheet: ProductSheet; onClose: () => void }) {
  const t = useT();
  const { me } = useMe();
  const [copies, setCopies] = useState("1");
  const n = Math.max(1, Math.min(100, Number(copies) || 1));
  const pharmacy = me?.pharmacy?.name ?? "";
  return (
    <DialogContent className="max-w-md">
      <DialogHeader
        icon={<Printer className="size-4" />}
        title={t("label.title")}
        subtitle={sheet.product}
        onClose={onClose}
      />
      <DialogBody className="items-center">
        <Label sheet={sheet} pharmacy={pharmacy} />
        {sheet.prices.ppv == null && <p className="text-sm text-warning">{t("label.noPrice")}</p>}
        <QuantityField
          label={t("label.copies")}
          value={copies}
          onChange={setCopies}
          min={1}
          max={100}
          decreaseLabel={t("label.less")}
          increaseLabel={t("label.more")}
        />
      </DialogBody>
      <DialogFooter>
        <Button variant="secondary" onClick={onClose}>
          {t("common.cancel")}
        </Button>
        <Button onClick={() => window.print()}>
          <Printer className="size-4" />
          {t("label.print")}
        </Button>
      </DialogFooter>
      {createPortal(
        <div className="print-area hidden grid-cols-3 gap-[2mm] print:grid">
          {Array.from({ length: n }, (_, i) => (
            <Label key={i} sheet={sheet} pharmacy={pharmacy} />
          ))}
        </div>,
        document.body,
      )}
    </DialogContent>
  );
}

export function LabelDialog({ sheet, open, onClose }: { sheet: ProductSheet; open: boolean; onClose: () => void }) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      {open && <LabelForm sheet={sheet} onClose={onClose} />}
    </Dialog>
  );
}
