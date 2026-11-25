import { useState } from "react";
import { Pencil, Trash2, Plus, UploadCloud, FileSpreadsheet } from "lucide-react";

import { ConfirmDialog } from "@/_components/molecules/ConfirmDialog";
import { DataTable, type ColumnDef } from "@/_components/organisms/DataTable";
import { FilterBar, type ActiveFilter } from "@/_components/organisms/FilterBar";
import { useT } from "@/i18n/I18nProvider";
import { cn } from "@/utils/cn";
import { formatMAD, formatNumStr, formatPct } from "@/utils/format";
import type { Medicament, MedicamentInput, ProductType, CatalogImportResponse } from "@/types/catalog";

import { CatalogStatsTiles } from "./_components/CatalogStatsTiles";
import { SobrusImportCard } from "./_components/SobrusImportCard";
import { useCatalogPage } from "./hooks";
import { Button } from "@/_components/atoms/Button";
import { Dialog, DialogContent } from "@/_components/atoms/Dialog";
import { Callout } from "@/_components/molecules/Callout";
import { DialogBody, DialogFooter, DialogHeader } from "@/_components/molecules/DialogShell";
import { ToggleChip } from "@/_components/molecules/ToggleChip";
import { TextField } from "@/_components/molecules/TextField";
import { TypeBadge } from "@/_components/molecules/TypeBadge";
import { Page } from "@/_components/templates/Page";

/** CSV import dialog for the admin catalog. File picker → submit → result toast. */

interface ImportCsvDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (file: File) => void;
  isLoading: boolean;
  lastResult?: CatalogImportResponse;
}

function ImportCsvDialog({ open, onClose, onSubmit, isLoading, lastResult }: ImportCsvDialogProps) {
  const t = useT();
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f && f.name.toLowerCase().endsWith(".csv")) setFile(f);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !isLoading && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader
          title={t("catalogue.importTitle")}
          subtitle={t("catalogue.importHelp", {
            headers: "Nom, Categorie, TVA, PPV, PPH, Code barre 1, Code barre 2, Laboratoire",
          })}
          onClose={isLoading ? undefined : onClose}
        />
        <DialogBody>
          <label
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            className={cn(
              "flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed px-6 py-12 text-center transition-colors",
              dragOver ? "border-primary bg-primary/5" : "border-border bg-surface-subtle/40 hover:bg-surface-subtle",
            )}
          >
            <input
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            {file ? (
              <>
                <FileSpreadsheet className="size-8 text-primary" aria-hidden />
                <span className="text-sm font-semibold text-foreground">{file.name}</span>
                <span className="font-mono text-xs text-muted-foreground">{formatNumStr(file.size / 1024, 1)} KB</span>
              </>
            ) : (
              <>
                <UploadCloud className="size-8 text-muted-foreground" aria-hidden />
                <span className="text-sm font-medium text-foreground">{t("catalogue.dropPrompt")}</span>
                <span className="text-xs text-muted-foreground">{t("catalogue.csvOnly")}</span>
              </>
            )}
          </label>

          {lastResult && (
            <div className="grid grid-cols-2 gap-2 rounded-md border border-border bg-card p-3 text-sm sm:grid-cols-4">
              <Stat label={t("catalogue.statRead")} value={lastResult.total_rows} />
              <Stat label={t("catalogue.statInserted")} value={lastResult.inserted} tone="success" />
              <Stat label={t("catalogue.statUpdated")} value={lastResult.updated} tone="info" />
              <Stat
                label={t("catalogue.statSkipped")}
                value={lastResult.skipped}
                tone={lastResult.skipped > 0 ? "warning" : "muted"}
              />
              {lastResult.errors.length > 0 && (
                <div className="sm:col-span-4 mt-1 max-h-32 overflow-auto rounded-md bg-warning/10 p-2 text-xs text-warning">
                  {lastResult.errors.map((e, i) => (
                    <div key={i}>• {t(`errors.${e.code}`, e.params)}</div>
                  ))}
                </div>
              )}
            </div>
          )}
        </DialogBody>
        <DialogFooter>
          <Button variant="secondary" type="button" onClick={onClose} disabled={isLoading}>
            {lastResult ? t("common.close") : t("common.cancel")}
          </Button>
          <Button
            type="button"
            variant="primary"
            disabled={!file}
            isLoading={isLoading}
            loadingText={t("catalogue.importing")}
            onClick={() => file && onSubmit(file)}
          >
            {t("common.import")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Stat({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: number;
  tone?: "default" | "success" | "info" | "warning" | "muted";
}) {
  const cls = {
    default: "text-foreground",
    success: "text-success",
    info: "text-info",
    warning: "text-warning",
    muted: "text-muted-foreground",
  }[tone];
  return (
    <div className="flex flex-col items-center">
      <span className={cn("font-mono text-xl font-bold tabular-nums", cls)}>{value}</span>
      <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</span>
    </div>
  );
}

/** Create + Edit form for a Medicament. Submits via the hook's create/update mutations. */

interface MedicamentFormDialogProps {
  open: boolean;
  onClose: () => void;
  initial: Medicament | null; // null → create mode; non-null → edit mode
  onSubmit: (body: MedicamentInput) => void;
  isLoading: boolean;
}

function blank(): MedicamentInput {
  return {
    product: "",
    tva: null,
    pph: null,
    ppv: null,
    category: null,
    barcode1: null,
    barcode2: null,
    laboratoire: null,
    product_type: null,
  };
}

function fromMedicament(m: Medicament): MedicamentInput {
  return {
    product: m.product,
    tva: m.tva,
    pph: m.pph,
    ppv: m.ppv,
    category: m.category,
    barcode1: m.barcode1,
    barcode2: m.barcode2,
    laboratoire: m.laboratoire,
    product_type: m.product_type,
  };
}

/** Category looks like "Médicament" — accent-insensitive, ignores the "(xx%)"
 *  margin suffix Sobrus concatenates. Mirrors the backend keyword match. */
function looksLikeMedicament(category: string | null | undefined): boolean {
  return !!category && /[ée]dicament/i.test(category);
}

/** First number in a TVA label: "TVA (20.00%)" → 20, "Exonéré (0.00%)" → 0. */
function tvaPercent(tva: string | null | undefined): number {
  const m = tva ? String(tva).match(/[\d.]+/) : null;
  return m ? parseFloat(m[0]) : 0;
}

/** Mounted only while open, once per medicament: the form starts from `initial`. */
function MedicamentFormDialog(props: MedicamentFormDialogProps) {
  return props.open ? <MedicamentFormBody key={props.initial?.id ?? "new"} {...props} /> : null;
}

function MedicamentFormBody({ open, onClose, initial, onSubmit, isLoading }: MedicamentFormDialogProps) {
  const t = useT();
  const [form, setForm] = useState<MedicamentInput>(() => (initial ? fromMedicament(initial) : blank()));
  const [error, setError] = useState<string | null>(null);
  const [tvaConfirmOpen, setTvaConfirmOpen] = useState(false);

  const setField = <K extends keyof MedicamentInput>(k: K, v: MedicamentInput[K]) => setForm((f) => ({ ...f, [k]: v }));

  // A "Médicament" should be exonéré (0 % TVA). Warn when it isn't.
  const tvaWarning = looksLikeMedicament(form.category) && tvaPercent(form.tva) !== 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.product?.trim()) {
      setError(t("catalogue.productRequired"));
      return;
    }
    if (tvaWarning) {
      setTvaConfirmOpen(true);
      return;
    }
    onSubmit(form);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !isLoading && !tvaConfirmOpen && onClose()}>
      <DialogContent className="max-w-2xl">
        <form onSubmit={handleSubmit} className="flex flex-col">
          <DialogHeader
            title={initial ? t("catalogue.editTitle") : t("catalogue.addTitle")}
            subtitle={initial && <span className="font-mono text-xs">PID : {initial.pid}</span>}
            onClose={isLoading ? undefined : onClose}
          />
          <DialogBody>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <TextField
                  label={t("catalogue.productLabel")}
                  value={form.product ?? ""}
                  onChange={(e) => setField("product", e.target.value)}
                  placeholder="DOLIPRANE 1000MG B10"
                  error={error ?? undefined}
                  autoFocus
                />
              </div>
              <TextField
                label={t("col.categorie")}
                value={form.category ?? ""}
                onChange={(e) => setField("category", e.target.value || null)}
                placeholder="Medicament (20.000%)"
              />
              <TextField
                label={t("col.laboratoire")}
                value={form.laboratoire ?? ""}
                onChange={(e) => setField("laboratoire", e.target.value || null)}
                placeholder="Sanofi"
              />
              <TextField
                label={t("catalogue.tva")}
                value={form.tva ?? ""}
                onChange={(e) => setField("tva", e.target.value || null)}
                placeholder="TVA (20.00%)"
              />
              <div className="grid grid-cols-2 gap-3">
                <TextField
                  label={t("col.pph")}
                  type="number"
                  step="0.01"
                  value={form.pph ?? ""}
                  onChange={(e) => setField("pph", e.target.value === "" ? null : Number(e.target.value))}
                />
                <TextField
                  label={t("col.ppv")}
                  type="number"
                  step="0.01"
                  value={form.ppv ?? ""}
                  onChange={(e) => setField("ppv", e.target.value === "" ? null : Number(e.target.value))}
                />
              </div>
              <TextField
                label={t("catalogue.barcode1")}
                value={form.barcode1 ?? ""}
                onChange={(e) => setField("barcode1", e.target.value || null)}
                placeholder="6111258659606"
              />
              <TextField
                label={t("catalogue.barcode2")}
                value={form.barcode2 ?? ""}
                onChange={(e) => setField("barcode2", e.target.value || null)}
              />

              <div className="sm:col-span-2 space-y-1.5">
                <label className="block text-sm font-medium text-foreground">{t("catalogue.typeOverride")}</label>
                <div className="flex gap-2">
                  {(["pharmacie", "parapharmacie"] as ProductType[]).map((pt) => (
                    <ToggleChip
                      key={pt}
                      pressed={form.product_type === pt}
                      onToggle={() => setField("product_type", form.product_type === pt ? null : pt)}
                      activeClass={
                        pt === "pharmacie"
                          ? "bg-pharmacie-bg text-pharmacie-fg border-pharmacie-border"
                          : "bg-parapharmacie-bg text-parapharmacie-fg border-parapharmacie-border"
                      }
                    >
                      {pt === "pharmacie" ? t("catalogue.pharmacie") : t("catalogue.parapharmacie")}
                    </ToggleChip>
                  ))}
                  <span className="self-center text-xs text-muted-foreground">{t("catalogue.autoDetectHint")}</span>
                </div>
              </div>
            </div>

            {tvaWarning && (
              <Callout tone="warning">
                {t("catalogue.tvaWarnPre")}
                <b>{formatPct(tvaPercent(form.tva))}</b>
                {t("catalogue.tvaWarnMid")}
                <b>{t("catalogue.tvaWarnExonere")}</b>
                {t("catalogue.tvaWarnPost")}
              </Callout>
            )}
          </DialogBody>
          <DialogFooter>
            <Button variant="secondary" type="button" onClick={onClose} disabled={isLoading}>
              {t("common.cancel")}
            </Button>
            <Button
              type="submit"
              variant="primary"
              isLoading={isLoading}
              loadingText={initial ? t("catalogue.editing") : t("catalogue.adding")}
            >
              {initial ? t("common.save") : t("common.add")}
            </Button>
          </DialogFooter>
        </form>

        {/* Rendered inside DialogContent so its (portaled) clicks bubble to
            DialogContent's stopPropagation and don't close the form. */}
        <ConfirmDialog
          open={tvaConfirmOpen}
          onClose={() => setTvaConfirmOpen(false)}
          title={t("catalogue.tvaConfirm", { percent: tvaPercent(form.tva) })}
          onConfirm={() => {
            setTvaConfirmOpen(false);
            onSubmit(form);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}

export default function CataloguePage() {
  const t = useT();
  const {
    categories,
    create,
    filters,
    importCsv,
    isCreating,
    isError,
    isImporting,
    isLoading,
    isRemoving,
    isUpdating,
    lastImport,
    list,
    reload,
    remove,
    reset,
    setCategories,
    setPage,
    setPageSize,
    setSearch,
    setSort,
    setType,
    update,
  } = useCatalogPage();

  const [editing, setEditing] = useState<Medicament | null>(null);
  const [creating, setCreating] = useState(false);
  const [removing, setRemoving] = useState<Medicament | null>(null);
  const [importing, setImporting] = useState(false);

  const activeFilters: ActiveFilter[] = [
    filters.search
      ? {
          key: "search",
          label: <>{t("catalogue.filterSearch", { value: filters.search })}</>,
          onClear: () => setSearch(""),
        }
      : null,
    filters.category.length > 0
      ? {
          key: "category",
          label: (
            <>
              {t("col.categorie")} : {filters.category[0]}
              {filters.category.length > 1 ? `, +${filters.category.length - 1}` : ""}
            </>
          ),
          onClear: () => setCategories([]),
        }
      : null,
    filters.type
      ? {
          key: "type",
          label: (
            <>
              {t("col.type")} :{" "}
              {filters.type === "pharmacie"
                ? t("catalogue.pharmacie")
                : filters.type === "parapharmacie"
                  ? t("catalogue.parapharmacie")
                  : t("catalogue.nonClasses")}
            </>
          ),
          onClear: () => setType(null),
        }
      : null,
  ].filter(Boolean) as ActiveFilter[];

  const COLUMNS: ColumnDef<Medicament>[] = [
    {
      key: "product",
      label: t("col.produit"),
      width: 280,
      render: (m) => (
        <div className="flex flex-col">
          <span className="truncate text-sm" title={m.product}>
            {m.product}
          </span>
          <span className="truncate font-mono text-[10px] text-muted-foreground">{m.pid}</span>
        </div>
      ),
    },
    {
      key: "category",
      label: t("col.categorie"),
      width: 180,
      render: (m) => (
        <span className="block max-w-[170px] truncate text-xs text-muted-foreground">{m.category ?? "—"}</span>
      ),
    },
    {
      key: "type",
      label: t("col.type"),
      width: 120,
      sortable: false,
      render: (m) => <TypeBadge type={m.product_type} />,
    },
    {
      key: "tva",
      label: t("catalogue.tva"),
      width: 90,
      render: (m) =>
        m.tva ? (
          <span className="font-mono text-[11px] text-muted-foreground">{m.tva}</span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      key: "pph",
      label: t("col.pph"),
      width: 100,
      align: "right",
      render: (m) => <span className="text-muted-foreground">{m.pph != null ? formatMAD(m.pph) : "—"}</span>,
    },
    {
      key: "ppv",
      label: t("col.ppv"),
      width: 100,
      align: "right",
      render: (m) => (m.ppv != null ? formatMAD(m.ppv) : "—"),
    },
    {
      key: "laboratoire",
      label: t("col.laboratoire"),
      width: 170,
      render: (m) =>
        m.laboratoire ? (
          <span className="truncate text-xs" title={m.laboratoire}>
            {m.laboratoire}
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      key: "actions",
      label: "",
      width: 90,
      align: "right",
      sortable: false,
      render: (m) => (
        <div className="flex justify-end gap-1">
          <Button
            variant="ghost"
            size="icon-sm"
            className="text-muted-foreground"
            aria-label={t("common.edit")}
            onClick={() => setEditing(m)}
          >
            <Pencil className="size-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            className="text-muted-foreground hover:bg-error-subtle hover:text-error"
            aria-label={t("common.delete")}
            onClick={() => setRemoving(m)}
          >
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <Page title={t("catalogue.title")} subtitle={t("catalogue.subtitle")}>
      <CatalogStatsTiles onFilterType={setType} />

      <FilterBar
        search={{
          value: filters.search,
          onChange: setSearch,
          placeholder: t("catalogue.searchPlaceholder"),
          suggestions: null,
        }}
        multiSelects={[
          { label: t("col.categorie"), options: categories, selected: filters.category, onChange: setCategories },
        ]}
        singleSelect={{
          label: t("col.type"),
          options: [
            { value: "", label: t("catalogue.allTypes") },
            { value: "pharmacie", label: t("catalogue.pharmacie") },
            { value: "parapharmacie", label: t("catalogue.parapharmacie") },
            { value: "unclassified", label: t("catalogue.nonClasses") },
          ],
          value: filters.type ?? "",
          onChange: (v) => setType((v === "" ? null : v) as ProductType | "unclassified" | null),
        }}
        rightActions={[
          {
            label: t("catalogue.importCsv"),
            icon: <UploadCloud className="size-4" />,
            variant: "outline",
            onClick: () => setImporting(true),
          },
          {
            label: t("common.add"),
            icon: <Plus className="size-4" />,
            variant: "primary",
            onClick: () => setCreating(true),
          },
        ]}
        activeFilters={activeFilters}
        onResetAll={reset}
      />

      <SobrusImportCard />

      <DataTable<Medicament>
        rows={list?.data ?? []}
        columns={COLUMNS}
        isLoading={isLoading}
        isError={isError}
        onRetry={reload}
        sortBy={filters.sort_by}
        sortOrder={filters.sort_order}
        onSort={setSort}
        pagination={{
          page: filters.page,
          pageSize: filters.limit,
          total: list?.pagination.total ?? 0,
          onPage: setPage,
          onPageSize: setPageSize,
          pageSizes: [25, 50, 100],
        }}
        emptyTitle={t("catalogue.emptyTitle")}
        emptyHint={t("catalogue.emptyHint")}
        rowKey={(m) => m.id}
      />

      {/* Create dialog */}
      <MedicamentFormDialog
        open={creating}
        onClose={() => setCreating(false)}
        initial={null}
        isLoading={isCreating}
        onSubmit={(body: MedicamentInput) => {
          create(body);
          setCreating(false);
        }}
      />

      {/* Edit dialog */}
      <MedicamentFormDialog
        open={!!editing}
        onClose={() => setEditing(null)}
        initial={editing}
        isLoading={isUpdating}
        onSubmit={(body) => {
          if (editing) update({ id: editing.id, body });
          setEditing(null);
        }}
      />

      {/* Delete confirm */}
      <ConfirmDialog
        open={!!removing}
        onClose={() => setRemoving(null)}
        onConfirm={() => {
          if (removing) {
            remove(removing.id);
            setRemoving(null);
          }
        }}
        title={t("catalogue.deleteTitle")}
        description={removing ? t("catalogue.deleteDescription", { product: removing.product }) : undefined}
        variant="destructive"
        confirmLabel={t("common.delete")}
        loadingLabel={t("catalogue.deleting")}
        isLoading={isRemoving}
      />

      {/* Import CSV */}
      <ImportCsvDialog
        open={importing}
        onClose={() => setImporting(false)}
        onSubmit={(f) => importCsv(f)}
        isLoading={isImporting}
        lastResult={lastImport}
      />
    </Page>
  );
}
