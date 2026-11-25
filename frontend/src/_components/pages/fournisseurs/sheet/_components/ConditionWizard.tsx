/** Add or change a supplier's condition, one question per screen: 1 its kind (big cards with an example) → 2 its
 *  figures (tiers « Dès … → … % », a minimum, a %…) → 3 which products (the whole supplier, or the exact products
 *  ticked: never « all the lab ») → 4 validity, « Confirmée » / « À vérifier », where it comes from → 5 the sentence
 *  it gives, « Enregistrer ». Mounted only while open: starts from the condition changed, else empty. */
import { useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  BadgePercent,
  Boxes,
  CalendarClock,
  Coins,
  Gift,
  Layers,
  Package,
  Truck,
  Undo2,
  X,
  type LucideIcon,
} from "lucide-react";

import { API } from "@/api/api";
import { api } from "@/api/client";
import { Button } from "@/_components/atoms/Button";
import { Dialog, DialogContent } from "@/_components/atoms/Dialog";
import { Callout } from "@/_components/molecules/Callout";
import { ChoiceCard } from "@/_components/molecules/ChoiceCard";
import { DatePickerButton } from "@/_components/molecules/DatePickerButton";
import { DialogBody, DialogFooter, DialogHeader } from "@/_components/molecules/DialogShell";
import { FormField, FormInput } from "@/_components/molecules/FormField";
import { SearchField } from "@/_components/molecules/SearchField";
import { ToggleChip } from "@/_components/molecules/ToggleChip";
import { WizardProgress } from "@/_components/molecules/WizardProgress";
import { useT } from "@/i18n/I18nProvider";
import type { CatalogListResponse } from "@/types/catalog";
import type {
  Condition,
  ConditionBasis,
  ConditionInput,
  ConditionKind,
  ConditionState,
  SupplierSheet,
} from "@/types/suppliers";
import { formatDate } from "@/utils/format";

import { conditionText } from "../conditionText";

const KINDS: { kind: ConditionKind; icon: LucideIcon }[] = [
  { kind: "qty_tiers", icon: Layers },
  { kind: "amount_tiers", icon: Coins },
  { kind: "minimum_order", icon: Boxes },
  { kind: "product_discount", icon: BadgePercent },
  { kind: "pack", icon: Gift },
  { kind: "payment_discount", icon: CalendarClock },
  { kind: "transport", icon: Truck },
  { kind: "packaging", icon: Package },
  { kind: "return_rule", icon: Undo2 },
];
const BASES: ConditionBasis[] = ["units", "mad", "references"];
const STATES: ConditionState[] = ["confirmed", "unverified"];
const STEPS = ["kind", "figures", "products", "validity", "summary"] as const;

/** « 1 500,5 » → 1500.5; « » or not a number → null. */
const num = (v: string) => {
  const n = Number(v.replace(/\s/g, "").replace(",", "."));
  return v.trim() && Number.isFinite(n) ? n : null;
};
const text = (n: number | null | undefined) => (n == null ? "" : String(n).replace(".", ","));
const isoOf = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

interface Props {
  supplier: SupplierSheet;
  /** The condition changed; null = a new one. */
  condition: Condition | null;
  onSave: (id: number | null, body: ConditionInput) => Promise<void>;
  isSaving: boolean;
  onClose: () => void;
}

function Wizard({ supplier, condition, onSave, isSaving, onClose }: Props) {
  const t = useT();
  const [step, setStep] = useState(condition ? 1 : 0);
  const [kind, setKind] = useState<ConditionKind | null>(condition?.kind ?? null);
  const [basis, setBasis] = useState<ConditionBasis>(condition?.basis ?? "mad");
  const [value, setValue] = useState(text(condition?.value));
  const [days, setDays] = useState(text(condition?.days));
  const [tiers, setTiers] = useState(
    (condition?.tiers ?? [{ from: 0, pct: 0 }]).map((x) => ({ from: text(x.from || null), pct: text(x.pct || null) })),
  );
  const [ruleText, setRuleText] = useState(condition?.text ?? "");
  const [products, setProducts] = useState(condition?.products ?? []);
  const [someProducts, setSomeProducts] = useState((condition?.products.length ?? 0) > 0);
  const [search, setSearch] = useState("");
  const [validFrom, setValidFrom] = useState(condition?.valid_from ?? null);
  const [validTo, setValidTo] = useState(condition?.valid_to ?? null);
  const [state, setState] = useState<ConditionState>(condition?.state ?? "unverified");
  const [source, setSource] = useState(condition?.source ?? "");

  const { data: found } = useQuery({
    queryKey: ["admin", "catalog", "pick", search],
    queryFn: () => api.get<CatalogListResponse>(API.admin.catalog.list.url, { params: { search, limit: 8 } }),
    enabled: search.trim().length >= 2,
  });

  const goodTiers = tiers.map((x) => ({ from: num(x.from), pct: num(x.pct) }));
  const body: ConditionInput | null = kind && {
    kind,
    basis: kind === "minimum_order" ? basis : null,
    value: num(value),
    days: num(days),
    tiers:
      kind === "qty_tiers" || kind === "amount_tiers"
        ? goodTiers.filter((x): x is { from: number; pct: number } => x.from != null && x.pct != null)
        : null,
    text: ruleText.trim() || null,
    valid_from: validFrom,
    valid_to: validTo,
    state,
    source: source.trim() || null,
    product_ids: someProducts ? products.map((p) => p.id) : [],
  };
  const pct = (n: number | null) => n != null && n > 0 && n <= 100;
  const figuresOk = (() => {
    const v = num(value);
    switch (kind) {
      case "qty_tiers":
      case "amount_tiers":
        return goodTiers.every((x) => x.from != null && x.from > 0 && pct(x.pct));
      case "minimum_order":
      case "transport":
      case "packaging":
        return v != null && v > 0;
      case "product_discount":
        return pct(v);
      case "payment_discount":
        return pct(v) && num(days) != null;
      default:
        return !!ruleText.trim();
    }
  })();
  const missing = [
    !kind && "conditions.needKind",
    !figuresOk && "conditions.needFigures",
    someProducts && products.length === 0 && "conditions.needProducts",
    validFrom && validTo && validFrom > validTo && "conditions.badDates",
    null,
  ][step];

  const save = async () => {
    if (!body) return;
    await onSave(condition?.id ?? null, body);
    onClose();
  };

  const dateField = (label: string, iso: string | null, set: (v: string | null) => void) => (
    <FormField label={label} group>
      <div className="flex items-center gap-2">
        <span className="min-w-36 text-sm text-foreground">{iso ? formatDate(iso) : t("conditions.noDate")}</span>
        <DatePickerButton
          selected={iso ? new Date(iso) : undefined}
          onPick={(d) => set(isoOf(d))}
          label={`${t("conditions.pickDate")} : ${label}`}
        />
        {iso && (
          <Button variant="ghost" size="sm" onClick={() => set(null)}>
            {t("conditions.clearDate")}
          </Button>
        )}
      </div>
    </FormField>
  );
  const input = (label: string, v: string, set: (v: string) => void, suffix?: ReactNode) => (
    <FormField label={label}>
      <span className="flex items-center gap-2">
        <FormInput value={v} onChange={set} inputMode="decimal" className="w-36 text-right font-mono" autoFocus />
        {suffix && <span className="text-sm text-muted-foreground">{suffix}</span>}
      </span>
    </FormField>
  );

  return (
    <DialogContent className="max-w-xl">
      <DialogHeader
        icon={<BadgePercent className="size-4" />}
        title={t(condition ? "conditions.editTitle" : "conditions.addTitle")}
        subtitle={supplier.name}
        onClose={onClose}
      />
      <DialogBody>
        <WizardProgress label={t("conditions.wizard")} total={STEPS.length} current={step} />
        <h3 className="text-xl font-semibold tracking-tight text-foreground">{t(`conditions.step_${STEPS[step]}`)}</h3>

        {step === 0 && (
          <div
            role="radiogroup"
            aria-label={t("conditions.step_kind")}
            className="grid grid-cols-1 gap-2 sm:grid-cols-2"
          >
            {KINDS.map(({ kind: k, icon: Icon }) => (
              <ChoiceCard
                key={k}
                selected={kind === k}
                onSelect={() => setKind(k)}
                className="flex-row items-start gap-3 p-3"
              >
                <Icon className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
                <span className="flex flex-col gap-0.5">
                  <span className="text-sm font-semibold text-foreground">{t(`conditions.kind_${k}`)}</span>
                  <span className="text-xs text-muted-foreground">{t(`conditions.example_${k}`)}</span>
                </span>
              </ChoiceCard>
            ))}
          </div>
        )}

        {step === 1 && kind && (
          <>
            {(kind === "qty_tiers" || kind === "amount_tiers") && (
              <div className="flex flex-col gap-2">
                {tiers.map((tier, i) => (
                  <div key={i} className="flex flex-wrap items-center gap-2 text-sm">
                    <span>{t("conditions.from")}</span>
                    <FormInput
                      aria-label={t("conditions.from")}
                      value={tier.from}
                      onChange={(v) => setTiers(tiers.map((x, j) => (j === i ? { ...x, from: v } : x)))}
                      inputMode="decimal"
                      className="w-28 text-right font-mono"
                    />
                    <span>{t(kind === "qty_tiers" ? "conditions.unitsWord" : "conditions.madWord")} →</span>
                    <FormInput
                      aria-label={t("conditions.discount")}
                      value={tier.pct}
                      onChange={(v) => setTiers(tiers.map((x, j) => (j === i ? { ...x, pct: v } : x)))}
                      inputMode="decimal"
                      className="w-20 text-right font-mono"
                    />
                    <span>%</span>
                    {tiers.length > 1 && (
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={t("conditions.removeTier")}
                        onClick={() => setTiers(tiers.filter((_, j) => j !== i))}
                      >
                        <X className="size-4" />
                      </Button>
                    )}
                  </div>
                ))}
                <Button
                  variant="outline"
                  className="w-fit"
                  disabled={tiers.length >= 10}
                  onClick={() => setTiers([...tiers, { from: "", pct: "" }])}
                >
                  {t("conditions.addTier")}
                </Button>
              </div>
            )}
            {kind === "minimum_order" && (
              <>
                <FormField label={t("conditions.basis")} group>
                  <div className="flex flex-wrap gap-2">
                    {BASES.map((b) => (
                      <ToggleChip key={b} pressed={basis === b} onToggle={() => setBasis(b)}>
                        {t(`conditions.basis_${b}`)}
                      </ToggleChip>
                    ))}
                  </div>
                </FormField>
                {input(t("conditions.minimum"), value, setValue, t(`conditions.basis_${basis}`))}
              </>
            )}
            {kind === "product_discount" && input(t("conditions.discount"), value, setValue, "%")}
            {kind === "payment_discount" && (
              <>
                {input(t("conditions.discount"), value, setValue, "%")}
                {input(t("conditions.paidWithin"), days, setDays, t("conditions.daysWord"))}
              </>
            )}
            {kind === "transport" && input(t("conditions.freeFrom"), value, setValue, "MAD")}
            {kind === "packaging" && input(t("conditions.multiple"), value, setValue, t("conditions.unitsWord"))}
            {(kind === "pack" || kind === "return_rule") && (
              <FormField label={t(`conditions.textLabel_${kind}`)}>
                <FormInput
                  value={ruleText}
                  onChange={setRuleText}
                  maxLength={500}
                  placeholder={t(`conditions.example_${kind}`)}
                  autoFocus
                />
              </FormField>
            )}
          </>
        )}

        {step === 2 && (
          <>
            <div role="radiogroup" aria-label={t("conditions.step_products")} className="flex flex-col gap-2">
              {[false, true].map((some) => (
                <ChoiceCard
                  key={String(some)}
                  selected={someProducts === some}
                  onSelect={() => setSomeProducts(some)}
                  className="p-3"
                >
                  <span className="text-sm font-semibold text-foreground">
                    {t(some ? "conditions.someProducts" : "conditions.allProducts")}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {t(some ? "conditions.someProductsHint" : "conditions.allProductsHint")}
                  </span>
                </ChoiceCard>
              ))}
            </div>
            {someProducts && (
              <>
                <SearchField
                  value={search}
                  onChange={setSearch}
                  placeholder={t("conditions.searchProduct")}
                  suggestions={null}
                  onPick={() => undefined}
                />
                {search.trim().length >= 2 && (
                  <ul className="flex max-h-56 flex-col divide-y divide-border overflow-y-auto rounded-lg border border-border">
                    {(found?.data ?? []).map((m) => {
                      const added = products.some((p) => p.id === m.id);
                      return (
                        <li key={m.id} className="flex items-center justify-between gap-3 px-3 py-2">
                          <span className="min-w-0 text-sm text-foreground">{m.product}</span>
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={added}
                            onClick={() => setProducts([...products, { id: m.id, pid: m.pid, product: m.product }])}
                          >
                            {t(added ? "conditions.added" : "conditions.add")}
                          </Button>
                        </li>
                      );
                    })}
                  </ul>
                )}
                {products.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {products.map((p) => (
                      <span
                        key={p.id}
                        className="inline-flex items-center gap-1 rounded-md border border-border bg-surface-subtle py-1 pl-2.5 pr-1 text-sm"
                      >
                        {p.product}
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`${t("conditions.remove")} ${p.product}`}
                          onClick={() => setProducts(products.filter((x) => x.id !== p.id))}
                        >
                          <X className="size-3.5" />
                        </Button>
                      </span>
                    ))}
                  </div>
                )}
              </>
            )}
          </>
        )}

        {step === 3 && (
          <>
            {dateField(t("conditions.validFrom"), validFrom, setValidFrom)}
            {dateField(t("conditions.validTo"), validTo, setValidTo)}
            <div role="radiogroup" aria-label={t("conditions.state")} className="flex flex-col gap-2">
              {STATES.map((s) => (
                <ChoiceCard key={s} selected={state === s} onSelect={() => setState(s)} className="p-3">
                  <span className="text-sm font-semibold text-foreground">{t(`conditions.choice_${s}`)}</span>
                  <span className="text-xs text-muted-foreground">{t(`conditions.choice_${s}Hint`)}</span>
                </ChoiceCard>
              ))}
            </div>
            <FormField label={t("conditions.source")}>
              <FormInput
                value={source}
                onChange={setSource}
                maxLength={200}
                placeholder={t("conditions.sourcePlaceholder")}
              />
            </FormField>
          </>
        )}

        {step === 4 && body && (
          <Callout tone={state === "confirmed" ? "success" : "warning"} title={conditionText(t, body)}>
            {[
              someProducts ? t("conditions.forProducts", { n: products.length }) : t("conditions.allProducts"),
              t(`conditions.state_${state}`),
              validTo && t("conditions.until", { date: formatDate(validTo) }),
            ]
              .filter(Boolean)
              .join(" · ")}
          </Callout>
        )}
      </DialogBody>
      <DialogFooter className="justify-between">
        {step > 0 ? (
          <Button variant="ghost" onClick={() => setStep(step - 1)} disabled={isSaving}>
            {t("common.back")}
          </Button>
        ) : (
          <span />
        )}
        <span className="flex flex-wrap items-center justify-end gap-3">
          {missing && <span className="text-sm text-muted-foreground">{t(missing)}</span>}
          {step < STEPS.length - 1 ? (
            <Button className="min-w-28" onClick={() => setStep(step + 1)} disabled={!!missing}>
              {t("common.next")}
            </Button>
          ) : (
            <Button className="min-w-28" onClick={() => void save()} isLoading={isSaving}>
              {t("common.save")}
            </Button>
          )}
        </span>
      </DialogFooter>
    </DialogContent>
  );
}

export function ConditionWizard({ open, ...props }: Props & { open: boolean }) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && props.onClose()}>
      {open && <Wizard key={props.condition?.id ?? "new"} {...props} />}
    </Dialog>
  );
}
