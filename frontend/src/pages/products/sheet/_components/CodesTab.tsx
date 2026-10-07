/** « Codes »: the codes that name this product (Sobrus PID, barcodes). */
import { DataTable, type ColumnDef } from "@/_components/DataTable";
import type { ProductSheet } from "@/types";
import { useT, type TFn } from "@/i18n/I18nProvider";

import { Editable } from "./Editable";
import { SheetCard } from "./SheetCard";

interface CodeRow {
  type: string;
  code: string | null;
  /** Barcodes: the owner can change them (« Modifier »); the PID never. */
  field?: "barcode1" | "barcode2";
}

const columns = (t: TFn): ColumnDef<CodeRow>[] => [
  { key: "type", label: t("products.codeType"), width: 200, sortable: false, render: (r) => r.type },
  {
    key: "code",
    label: t("products.code"),
    width: 260,
    sortable: false,
    render: (r) => {
      const code = r.code ? (
        <span className="font-mono">{r.code}</span>
      ) : (
        <span className="text-muted-foreground">—</span>
      );
      return r.field ? (
        <span className="flex justify-start">
          <Editable field={r.field} label={r.type}>
            {code}
          </Editable>
        </span>
      ) : (
        code
      );
    },
  },
];

export function CodesTab({ sheet }: { sheet: ProductSheet }) {
  const t = useT();
  const rows: CodeRow[] = [
    { type: t("products.pidLabel"), code: sheet.pid },
    { type: t("products.barcode1"), code: sheet.barcode1, field: "barcode1" },
    { type: t("products.barcode2"), code: sheet.barcode2, field: "barcode2" },
  ];
  return (
    <SheetCard title={t("products.codes")}>
      <DataTable<CodeRow> rows={rows} columns={columns(t)} rowKey={(r) => r.type} />
    </SheetCard>
  );
}
