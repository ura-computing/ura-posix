import { Download, BarChart3, Receipt, Wallet, Trash2, ArrowRightLeft, Banknote, CreditCard, Plus } from "lucide-react";

import { useCategoryTypeOptions } from "@/hooks/useCategoryTypeOptions";
import { FilterBar, type ActiveFilter } from "@/_components/organisms/FilterBar";
import type { StatsFilters, StatsResponse, PaymentEntry, PaymentMethod, VenteRow } from "@/types";

import { useComptabilitePage, useDeletePayment, useSavePayment } from "./hooks";
import { useT, type TFn } from "@/i18n/I18nProvider";
import { useState } from "react";
import { formatMAD, formatPct } from "@/utils/format";
import { Dialog, DialogContent } from "@/_components/atoms/Dialog";
import { DialogBody, DialogFooter, DialogHeader } from "@/_components/molecules/DialogShell";
import { LoadError } from "@/_components/molecules/LoadError";
import { MonthPicker } from "@/_components/molecules/MonthPicker";
import { SkeletonTile } from "@/_components/molecules/Skeletons";
import { Button } from "@/_components/atoms/Button";
import { FormField } from "@/_components/molecules/FormField";
import { PAYMENT_METHODS } from "@/types";
import { DataTable, type ColumnDef, type DataTablePagination } from "@/_components/organisms/DataTable";
import { TypeBadge } from "@/_components/molecules/TypeBadge";
import { Page } from "@/_components/templates/Page";
import { Input } from "@/_components/atoms/Input";
import { Checkbox } from "@/_components/atoms/Checkbox";
import { SectionTitle } from "@/_components/atoms/SectionTitle";

/**
 * 3 KPI cards for /comptabilité — each card groups several related metrics:
 *  - Card 1 (CA): ventes total + marge % + TVA encaissée
 *  - Card 2 (Achats): total + count + TVA payée
 *  - Card 3 (Bilan): Résultat (marge brute) + TVA à déclarer + solde TVA année
 *
 * Mirrors the old apcm-pharma layout. Pure presentational — caller passes
 * the StatsResponse and we render values + formatting.
 */
function KpiCards({ stats }: { stats: StatsResponse }) {
  const t = useT();
  const ca = stats.kpis.ventes_total;
  const achats = stats.kpis.achats_total;

  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
      <Card icon={<Wallet className="size-5" />} title={t("comptabilite.kpiCA")} tone="primary">
        <Row label={t("comptabilite.ventesTotal")} value={formatMAD(ca)} hero />
        <Row label={t("comptabilite.marge")} value={formatPct(stats.marge.marge_pct)} />
        <Row label={t("comptabilite.tvaEncaissee")} value={formatMAD(stats.tva.tva_encaissee)} />
      </Card>

      <Card icon={<Receipt className="size-5" />} title={t("comptabilite.kpiAchats")} tone="warning">
        <Row label={t("kpi.totalAchats")} value={formatMAD(achats)} hero />
        <Row label={t("comptabilite.operations")} value={String(stats.kpis.achats_count)} />
        <Row label={t("comptabilite.tvaPayee")} value={formatMAD(stats.tva.tva_payee)} />
      </Card>

      <Card icon={<BarChart3 className="size-5" />} title={t("comptabilite.bilanTva")} tone="info">
        <Row label={t("comptabilite.resultat")} value={formatMAD(stats.marge.marge_brute_dh)} hero />
        <Row label={t("comptabilite.tvaADeclarer")} value={formatMAD(stats.tva.tva_a_declarer)} />
        <Row
          label={t("comptabilite.soldeTva", { year: new Date().getFullYear() })}
          value={formatMAD(stats.tva.tva_a_declarer)}
          subtle
        />
      </Card>
    </div>
  );
}

function Card({
  icon,
  title,
  tone,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  tone: "primary" | "warning" | "info";
  children: React.ReactNode;
}) {
  const tint = tone === "primary" ? "text-primary" : tone === "warning" ? "text-warning" : "text-info";
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-5 shadow-sm">
      <div className="flex items-center gap-2 text-base font-semibold text-foreground">
        <span className={tint}>{icon}</span>
        {title}
      </div>
      <div className="flex flex-col gap-2.5">{children}</div>
    </div>
  );
}

function Row({
  label,
  value,
  hero,
  subtle,
}: {
  label: React.ReactNode;
  value: React.ReactNode;
  hero?: boolean;
  subtle?: boolean;
}) {
  if (hero) {
    return (
      <div className="flex flex-col gap-0.5 pb-2 border-b border-border">
        <span className="text-sm text-muted-foreground">{label}</span>
        <span className="font-mono text-3xl font-semibold tabular-nums text-foreground">{value}</span>
      </div>
    );
  }
  return (
    <div className="flex items-center justify-between gap-3 text-base">
      <span className={subtle ? "text-sm text-muted-foreground" : "text-muted-foreground"}>{label}</span>
      <span
        className={`font-mono tabular-nums ${subtle ? "text-sm text-muted-foreground" : "font-semibold text-foreground"}`}
      >
        {value}
      </span>
    </div>
  );
}

/**
 * Edit one (month, method) entry. The dialog is "smart":
 *  - If `entry` is null → create mode (Save calls POST upsert)
 *  - If `entry` is set  → edit mode (Save calls POST upsert too — backend
 *    upserts on (pharmacy_id, month, method)). Also surfaces Delete.
 *
 * Month: `MonthPicker` — gives the YYYY-MM string the backend wants.
 */

const METHOD_KEY: Record<PaymentMethod, string> = {
  especes: "comptabilite.especes",
  cheques: "comptabilite.cheques",
  virement: "comptabilite.virement",
  tpe: "comptabilite.tpe",
};

interface PaymentEditDialogProps {
  open: boolean;
  onClose: () => void;
  method: PaymentMethod | null; // null when closed
  month: string; // YYYY-MM
  entry: PaymentEntry | null; // existing row, if any
}

/** Mounted only while open, once per (method, month): the fields start from `entry`. */
function PaymentEditDialog(props: PaymentEditDialogProps) {
  return props.open ? <PaymentEditBody key={`${props.method}|${props.month}`} {...props} /> : null;
}

function PaymentEditBody({ open, onClose, method, month, entry }: PaymentEditDialogProps) {
  const t = useT();
  const { savePayment, isSaving } = useSavePayment();
  const { deletePayment, isDeleting } = useDeletePayment();

  // Form state — starts from `entry` (the body mounts on every open).
  const [pharm, setPharm] = useState(String(entry?.pharmacie_amount ?? 0));
  const [para, setPara] = useState(String(entry?.parapharmacie_amount ?? 0));
  const [cnt, setCnt] = useState(String(entry?.count ?? 0));
  const [monthV, setMonthV] = useState(month);

  if (!method) return null;

  const handleSave = async () => {
    await savePayment({
      month: monthV,
      method,
      pharmacie_amount: Number(pharm) || 0,
      parapharmacie_amount: Number(para) || 0,
      count: Number(cnt) || 0,
    });
    onClose();
  };

  const handleDelete = async () => {
    if (!entry) return;
    await deletePayment(entry.id);
    onClose();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) onClose();
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader title={`${t(METHOD_KEY[method])} — ${monthV}`} onClose={onClose} />

        <DialogBody>
          <FormField label={t("comptabilite.moisLabel")}>
            <MonthPicker label="" value={monthV} onChange={setMonthV} />
          </FormField>

          <div className="grid grid-cols-2 gap-3">
            <FormField label={t("comptabilite.pharmacieMad")}>
              <NumberInput value={pharm} onChange={setPharm} />
            </FormField>
            <FormField label={t("comptabilite.parapharmacieMad")}>
              <NumberInput value={para} onChange={setPara} />
            </FormField>
          </div>

          <FormField label={t("comptabilite.nbTransactions")}>
            <NumberInput value={cnt} onChange={setCnt} integer />
          </FormField>
        </DialogBody>

        <DialogFooter className="justify-between">
          {entry ? (
            <Button variant="danger-outline" onClick={handleDelete} isLoading={isDeleting}>
              <Trash2 className="size-4" />
              {t("common.delete")}
            </Button>
          ) : (
            <span />
          )}
          <Button variant="primary" onClick={handleSave} isLoading={isSaving}>
            {t("common.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function NumberInput({
  value,
  onChange,
  integer,
}: {
  value: string;
  onChange: (v: string) => void;
  integer?: boolean;
}) {
  return (
    <Input
      type="number"
      inputMode={integer ? "numeric" : "decimal"}
      step={integer ? "1" : "0.01"}
      min="0"
      value={value}
      onValueChange={onChange}
      className="font-mono tabular-nums"
    />
  );
}

/**
 * 4-card grid showing the active month's payment-method totals. Click a card
 * to open the edit dialog. The dialog owns its own state; this grid is pure
 * presentational + dispatches the "open dialog for this method" callback.
 *
 * Each method has its own color theme so the cards are visually distinct at
 * a glance — matches the apcm-pharma palette.
 */

const METHOD_ICON: Record<PaymentMethod, React.ReactNode> = {
  tpe: <CreditCard className="size-5" />,
  especes: <Banknote className="size-5" />,
  cheques: <Receipt className="size-5" />,
  virement: <ArrowRightLeft className="size-5" />,
};

/** Tailwind-friendly tint per method. Light bg + dark icon, mirrors the old
 *  apcm-pharma color story (blue / green / purple / amber). */
const METHOD_TINT: Record<PaymentMethod, { bg: string; fg: string; border: string }> = {
  tpe: { bg: "bg-blue-50", fg: "text-blue-600", border: "border-blue-200" },
  especes: { bg: "bg-green-50", fg: "text-green-600", border: "border-green-200" },
  cheques: { bg: "bg-purple-50", fg: "text-purple-600", border: "border-purple-200" },
  virement: { bg: "bg-amber-50", fg: "text-amber-600", border: "border-amber-200" },
};

function PaymentMethodGrid({
  payments,
  onOpenMethod,
}: {
  payments: PaymentEntry[];
  onOpenMethod: (method: PaymentMethod) => void;
}) {
  /** Map method → entry for O(1) lookup; missing keys render the empty (add) state. */
  const byMethod = new Map(payments.map((p) => [p.method, p] as const));

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {PAYMENT_METHODS.map((method) => (
        <MethodCard
          key={method}
          method={method}
          entry={byMethod.get(method) ?? null}
          onClick={() => onOpenMethod(method)}
        />
      ))}
    </div>
  );
}

function MethodCard({
  method,
  entry,
  onClick,
}: {
  method: PaymentMethod;
  entry: PaymentEntry | null;
  onClick: () => void;
}) {
  const t = useT();
  const tint = METHOD_TINT[method];
  const total = entry ? entry.pharmacie_amount + entry.parapharmacie_amount : 0;

  return (
    <Button
      variant="ghost"
      onClick={onClick}
      className={`group h-auto flex-col items-stretch justify-start gap-3 whitespace-normal rounded-xl border ${tint.border} bg-card p-5 text-left font-normal shadow-sm transition-shadow hover:bg-card hover:shadow-md`}
    >
      <div className="flex items-center justify-between">
        <div className={`flex size-9 items-center justify-center rounded-xl ${tint.bg} ${tint.fg}`}>
          {METHOD_ICON[method]}
        </div>
        <SectionTitle as="span">{t(METHOD_KEY[method])}</SectionTitle>
      </div>

      {entry ? (
        <div className="flex flex-col gap-1.5">
          <span className="font-mono text-2xl font-semibold tabular-nums text-foreground">{formatMAD(total)}</span>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              {t("comptabilite.phAbbr")} {formatMAD(entry.pharmacie_amount)}
            </span>
            <span>
              {t("comptabilite.paraAbbr")} {formatMAD(entry.parapharmacie_amount)}
            </span>
          </div>
          <span className="text-xs text-muted-foreground">
            {entry.count} {entry.count > 1 ? t("comptabilite.transactionsWord") : t("comptabilite.transactionWord")}
          </span>
        </div>
      ) : (
        <div className="flex items-center gap-2 text-base text-muted-foreground">
          <Plus className="size-4" />
          <span>{t("common.add")}</span>
        </div>
      )}
    </Button>
  );
}

/**
 * Comptabilité ventes ledger — same DataTable shell as /achats and /ventes
 * (sortable headers, sticky pagination footer, page-size popover). Column
 * set is comptabilité-specific: date, client, product, category, type, TVA.
 * Intentionally drops transaction_ref / transaction_ref_final (not useful
 * in an accounting view; the full /ventes page surfaces them).
 *
 * Sortable keys must match the backend's VENTE_SORT whitelist
 * (transactions.py): id, date, transaction_ref, client, quantity, discount,
 * unit_price, total. We expose date / client as sortable.
 */

const buildColumns = (t: TFn): ColumnDef<VenteRow>[] => [
  {
    key: "date",
    label: "Date",
    sortable: true,
    render: (r) => <span className="font-mono text-xs">{r.date ?? "—"}</span>,
  },
  {
    key: "client",
    label: t("col.client"),
    sortable: true,
    render: (r) => <span>{r.client || <span className="text-muted-foreground">{t("ventes.anonyme")}</span>}</span>,
  },
  {
    key: "product",
    label: t("col.produit"),
    sortable: false,
    render: (r) => (
      <div className="flex flex-col">
        <span className="truncate" title={r.product ?? ""}>
          {r.product ?? "—"}
        </span>
        {r.pid && <span className="text-[10px] text-muted-foreground">{r.pid}</span>}
      </div>
    ),
  },
  {
    key: "category",
    label: t("col.categorie"),
    sortable: false,
    render: (r) => <span className="text-xs text-muted-foreground">{r.category ?? "—"}</span>,
  },
  {
    key: "category_type",
    label: "Type",
    sortable: false,
    render: (r) => <TypeBadge type={r.category_type} />,
  },
  {
    key: "tva",
    label: "TVA",
    align: "right",
    sortable: false,
    render: (r) => <span className="font-mono text-xs">{r.tva ?? "—"}</span>,
  },
];

interface VentesLedgerProps {
  rows: VenteRow[];
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  sortBy: string | null;
  sortOrder: "asc" | "desc";
  onSort: (key: string) => void;
  pagination: DataTablePagination;
}

function VentesLedger({ rows, isLoading, isError, onRetry, sortBy, sortOrder, onSort, pagination }: VentesLedgerProps) {
  const t = useT();
  return (
    <DataTable
      rows={rows}
      columns={buildColumns(t)}
      isLoading={isLoading}
      isError={isError}
      onRetry={onRetry}
      sortBy={sortBy}
      sortOrder={sortOrder}
      onSort={onSort}
      pagination={pagination}
      emptyTitle={t("comptabilite.emptyVentes")}
    />
  );
}

const CATEGORY_KEY: Record<StatsFilters["category_type"], string> = {
  all: "category.mixte",
  pharmacie: "category.pharmacie",
  parapharmacie: "category.parapharmacie",
};

export default function ComptabilitePage() {
  const t = useT();
  const {
    activeMonth,
    filters,
    handleExport,
    openMethod,
    payments,
    paymentsError,
    paymentsLoading,
    reloadPayments,
    reloadStats,
    reloadVentes,
    setActiveMonth,
    setFilters,
    setOpenMethod,
    setVentesPage,
    setVentesPageSize,
    setVentesSort,
    stats,
    statsError,
    statsLoading,
    ventes,
    ventesError,
    ventesLoading,
    ventesPage,
    ventesPageSize,
    ventesSortBy,
    ventesSortOrder,
    ventesTotal,
  } = useComptabilitePage();
  const categoryTypeOptions = useCategoryTypeOptions();

  const activeFilters: ActiveFilter[] = [
    filters.date_from || filters.date_to
      ? {
          key: "dates",
          label: (
            <>
              {t("dashboard.periode")} {filters.date_from ?? "…"} → {filters.date_to ?? "…"}
            </>
          ),
          onClear: () => setFilters({ ...filters, date_from: null, date_to: null }),
        }
      : null,
    filters.category_type !== "all"
      ? {
          key: "cat",
          label: (
            <>
              {t("dashboard.categorieFilter")} {t(CATEGORY_KEY[filters.category_type])}
            </>
          ),
          onClear: () => setFilters({ ...filters, category_type: "all" }),
        }
      : null,
    filters.include_non_declared
      ? {
          key: "nd",
          label: <>{t("comptabilite.avecSpeciaux")}</>,
          onClear: () => setFilters({ ...filters, include_non_declared: false }),
        }
      : null,
  ].filter(Boolean) as ActiveFilter[];

  // Active entry for the open method (drives the dialog's initial values).
  const activeEntry = openMethod ? (payments.find((e) => e.method === openMethod) ?? null) : null;

  return (
    <Page title={t("nav.comptabilite")} subtitle={t("comptabilite.pageSubtitle")}>
      <FilterBar<StatsFilters["category_type"]>
        dateRange={{
          from: filters.date_from,
          to: filters.date_to,
          onChange: (from, to) => setFilters({ ...filters, date_from: from, date_to: to }),
        }}
        segment={{
          value: filters.category_type,
          onChange: (v) => setFilters({ ...filters, category_type: v }),
          options: categoryTypeOptions,
        }}
        rightActions={[
          {
            label: t("common.export"),
            icon: <Download className="size-4" />,
            variant: "outline",
            onClick: handleExport,
            disabled: !stats,
          },
        ]}
        activeFilters={activeFilters}
        onResetAll={() =>
          setFilters({
            date_from: null,
            date_to: null,
            category_type: "all",
            include_non_declared: false,
          })
        }
      />

      {/* Non-declared toggle — secondary control, lives outside the FilterBar */}
      <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
        <Checkbox
          checked={filters.include_non_declared}
          onChange={(on) => setFilters({ ...filters, include_non_declared: on })}
        />
        {t("comptabilite.includeSpecial")}
      </label>

      {/* KPI cards (3) */}
      {statsError && !stats ? (
        <LoadError onRetry={reloadStats} />
      ) : statsLoading || !stats ? (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <SkeletonTile key={i} className="min-h-44" />
          ))}
        </div>
      ) : (
        <KpiCards stats={stats} />
      )}

      {/* Payment method cards (4) for the active month */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <SectionTitle>{t("comptabilite.paymentMethods")}</SectionTitle>
          <MonthPicker label="" value={activeMonth} onChange={setActiveMonth} align="end" />
        </div>
        {paymentsError ? (
          <LoadError onRetry={reloadPayments} />
        ) : paymentsLoading ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {PAYMENT_METHODS.map((method) => (
              <SkeletonTile key={method} />
            ))}
          </div>
        ) : (
          <PaymentMethodGrid payments={payments} onOpenMethod={setOpenMethod} />
        )}
      </section>

      {/* Ventes ledger */}
      <section className="flex flex-col gap-3">
        <SectionTitle>{t("comptabilite.salesJournal")}</SectionTitle>
        <VentesLedger
          rows={ventes}
          isLoading={ventesLoading}
          isError={ventesError}
          onRetry={reloadVentes}
          sortBy={ventesSortBy}
          sortOrder={ventesSortOrder}
          onSort={setVentesSort}
          pagination={{
            page: ventesPage,
            pageSize: ventesPageSize,
            total: ventesTotal,
            onPage: setVentesPage,
            onPageSize: setVentesPageSize,
          }}
        />
      </section>

      <PaymentEditDialog
        open={openMethod !== null}
        onClose={() => setOpenMethod(null)}
        method={openMethod}
        month={activeMonth}
        entry={activeEntry}
      />
    </Page>
  );
}
