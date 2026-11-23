/** « Codes »: the codes that name this product (Sobrus PID, barcodes 1 and 2) with « Copier »,
 *  barcode 1 drawn, and « Scanner / Rechercher un code barre ». The owner changes the barcodes
 *  here too (« Modifier »); the PID never. */
import { useState, type ReactNode } from "react";
import { ScanBarcode } from "lucide-react";

import { Button } from "@/_components/atoms/Button";
import type { ProductSheet } from "@/types";
import { useT } from "@/i18n/I18nProvider";

import { ScanDialog } from "../../_components/ScanDialog";
import { BarcodeImage } from "./BarcodeImage";
import { CopyButton } from "./CopyButton";
import { EditHint, Editable, SectionEditActions } from "./Editable";
import { SectionCard } from "@/_components/molecules/SectionCard";
import { Callout } from "@/_components/molecules/Callout";

function InfoNote({ children }: { children: ReactNode }) {
  return <Callout tone="info">{children}</Callout>;
}

/** One identifier: label, then its value in a box + « Copier » (an input in edit mode). */
function CodeRow({ label, value, copy }: { label: string; value: ReactNode; copy: ReactNode }) {
  return (
    <div className="grid items-center gap-2 sm:grid-cols-[140px_minmax(0,1fr)]">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="flex min-h-12 items-center justify-between gap-3 rounded-md border border-border bg-surface-subtle px-3 py-1.5 text-base text-foreground">
        <span className="min-w-0 break-all font-mono">{value}</span>
        {copy}
      </dd>
    </div>
  );
}

export function CodesTab({ sheet }: { sheet: ProductSheet }) {
  const t = useT();
  const [scanning, setScanning] = useState(false);
  const missing = <span className="font-sans text-muted-foreground">{t("products.notAvailable")}</span>;
  const barcodes = [
    { n: 1 as const, field: "barcode1" as const, code: sheet.barcode1 },
    { n: 2 as const, field: "barcode2" as const, code: sheet.barcode2 },
  ];
  const drawn = sheet.barcode1 ?? sheet.barcode2;
  return (
    <div className="max-w-3xl">
      <SectionCard title={t("products.identifiers")} actions={<SectionEditActions section="codes" />}>
        <EditHint sections={["codes"]} />
        <InfoNote>{t("products.pidInfo")}</InfoNote>
        <dl className="flex flex-col gap-3">
          <CodeRow
            label={t("col.pid")}
            value={sheet.pid}
            copy={<CopyButton value={sheet.pid} label={t("products.copyPid")} />}
          />
          {barcodes.map(({ n, field, code }) => (
            <CodeRow
              key={field}
              label={t("products.barcodeN", { n })}
              value={
                <Editable field={field} label={t("products.barcodeN", { n })} section="codes">
                  {code ?? missing}
                </Editable>
              }
              copy={<CopyButton value={code} label={t("products.copyBarcodeN", { n })} />}
            />
          ))}
        </dl>
        {drawn && (
          <div className="flex flex-col items-center gap-1 py-2">
            <BarcodeImage code={drawn} className="h-20 w-60" />
            <span className="font-mono text-sm text-foreground">{drawn}</span>
          </div>
        )}
        <Button size="lg" onClick={() => setScanning(true)} className="w-full">
          <ScanBarcode className="size-5" />
          {t("products.scan")}
        </Button>
        <ScanDialog open={scanning} onClose={() => setScanning(false)} />
      </SectionCard>
    </div>
  );
}
