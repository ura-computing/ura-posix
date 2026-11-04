/** « 2. … exclus » of one tab: what this kind left out of Comptabilité, newest first. One click
 *  « Réintégrer » puts it back; « Ajouter une note » writes why (Entrée saves, Échap cancels). */
import { useState } from "react";
import { Pencil, Undo2 } from "lucide-react";

import { Button } from "@/_components/atoms/Button";
import { Input } from "@/_components/atoms/Input";
import { DataTable, type ColumnDef } from "@/_components/organisms/DataTable";
import { useT } from "@/i18n/I18nProvider";
import { formatDate, formatMAD } from "@/utils/format";

import type { ExcludedRow, ExclusionKind, ExclusionTarget } from "../hooks";

const TITLE: Record<ExclusionKind, string> = {
  product: "ps.listProduct",
  bl: "ps.listBl",
  line: "ps.listLine",
  supplier: "ps.listSupplier",
};

/** The note, or « Ajouter une note »; a click → a box (Entrée / leaving it saves, Échap cancels). */
function NoteCell({
  row,
  onSave,
}: {
  row: ExcludedRow;
  onSave: (target: ExclusionTarget, notes: string) => Promise<unknown>;
}) {
  const t = useT();
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(row.notes ?? "");
  if (editing) {
    const save = () => {
      setEditing(false);
      if (text.trim() !== (row.notes ?? "")) void onSave(row.target, text.trim());
    };
    return (
      <Input
        autoFocus
        value={text}
        onValueChange={setText}
        onBlur={save}
        onKeyDown={(e) => {
          if (e.key === "Enter") save();
          if (e.key === "Escape") {
            setText(row.notes ?? "");
            setEditing(false);
          }
        }}
        aria-label={t("ps.note")}
        placeholder={t("ps.notePlaceholder")}
        maxLength={500}
      />
    );
  }
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => {
        setText(row.notes ?? "");
        setEditing(true);
      }}
      className="max-w-full justify-start px-1.5 text-sm font-normal"
    >
      {row.notes ? (
        <span className="truncate text-foreground" title={row.notes}>
          {row.notes}
        </span>
      ) : (
        <span className="text-muted-foreground">
          <Pencil className="mr-1 inline size-3.5" />
          {t("ps.addNote")}
        </span>
      )}
    </Button>
  );
}

export function ExcludedList({
  kind,
  rows,
  isLoading,
  isError,
  onRetry,
  isReintegrating,
  onReintegrate,
  onSaveNote,
}: {
  kind: ExclusionKind;
  rows: ExcludedRow[];
  isLoading: boolean;
  /** The lists could not load: no count, « Réessayer » in place of the table. */
  isError: boolean;
  onRetry: () => void;
  isReintegrating: boolean;
  onReintegrate: (target: ExclusionTarget) => void;
  onSaveNote: (target: ExclusionTarget, notes: string) => Promise<unknown>;
}) {
  const t = useT();
  const shown = rows.filter((r) => r.target.kind === kind);

  const columns: ColumnDef<ExcludedRow>[] = [
    {
      key: "name",
      label: t("ps.colWhat"),
      width: 320,
      sortable: false,
      render: (r) => (
        <div className="flex min-w-0 flex-col">
          <span className="truncate text-sm font-medium text-foreground" title={r.name}>
            {r.name}
          </span>
          <span className="truncate text-xs text-muted-foreground" title={r.detail}>
            {r.detail}
          </span>
        </div>
      ),
    },
    ...(kind === "product"
      ? []
      : [
          {
            key: "total",
            label: t("col.total"),
            width: 120,
            align: "right" as const,
            sortable: false,
            render: (r: ExcludedRow) => (
              <span className="font-mono text-sm tabular-nums">{r.total != null ? formatMAD(r.total) : "—"}</span>
            ),
          },
        ]),
    {
      key: "notes",
      label: t("ps.note"),
      width: 260,
      sortable: false,
      render: (r) => <NoteCell key={`${r.key}:${r.notes ?? ""}`} row={r} onSave={onSaveNote} />,
    },
    {
      key: "created_at",
      label: t("ps.exclusLe"),
      width: 120,
      sortable: false,
      render: (r) => <span className="text-xs text-muted-foreground">{formatDate(r.created_at)}</span>,
    },
    {
      key: "_action",
      label: "",
      width: 150,
      sortable: false,
      align: "right",
      render: (r) => (
        <Button variant="secondary" type="button" disabled={isReintegrating} onClick={() => onReintegrate(r.target)}>
          <Undo2 className="size-4" /> {t("ps.reintegrer")}
        </Button>
      ),
    },
  ];

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-base font-semibold text-foreground">
        {t(TITLE[kind])}
        {!isLoading && !isError && ` (${shown.length})`}
      </h2>
      <DataTable<ExcludedRow>
        rows={shown}
        columns={columns}
        isLoading={isLoading}
        isError={isError}
        onRetry={onRetry}
        emptyTitle={t("ps.emptyExcluded")}
        emptyHint={t("ps.emptyExcludedHint")}
        rowKey={(r) => r.key}
      />
    </section>
  );
}
