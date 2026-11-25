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

/** 63 × 38 mm, black on white: the name (2 lines at most), then the price alone on its row (big, right), then the
 *  barcode and the pharmacy's name. Nothing overflows: each part has its own row. */
function Label({ sheet, pharmacy }: { sheet: ProductSheet; pharmacy: string }) {
  const { ppv, counter_price: net } = sheet.prices;
  const code = sheet.barcode1 ?? sheet.barcode2;
  const price = net ?? ppv;
  return (
    <div className="grid h-[38mm] w-[63mm] grid-rows-[auto_1fr_auto] overflow-hidden rounded-[1.5mm] border border-black/25 bg-white px-[3mm] py-[2.5mm] text-black">
      <span className="line-clamp-2 text-[9pt] font-semibold uppercase leading-[1.15] tracking-tight">
        {sheet.product}
      </span>
      <span className="flex items-baseline justify-end gap-[2mm] self-center">
        {net != null && ppv != null && (
          <span className="text-[9pt] text-black/60 line-through">{formatMADStr(ppv)}</span>
        )}
        {price != null && (
          <span className="text-[18pt] font-extrabold leading-none tabular-nums">{formatMADStr(price)}</span>
        )}
      </span>
      <span className="flex items-end justify-between gap-[2mm]">
        {code ? (
          <span className="flex flex-col items-center gap-[0.5mm]">
            <BarcodeImage code={code} className="h-[8mm] w-[32mm] p-0" />
            <span className="font-mono text-[6.5pt] leading-none tracking-[0.15em]">{code}</span>
          </span>
        ) : (
          <span />
        )}
        <span className="truncate pb-[0.3mm] text-right text-[6.5pt] text-black/70">{pharmacy}</span>
      </span>
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
