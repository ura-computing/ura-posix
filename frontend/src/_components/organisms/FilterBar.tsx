/** The sticky filter bar of the list / dashboard pages: search, date range, category segment,
 *  selects, active-filter chips and the right action. Every section optional. Its parts are the
 *  molecules SearchField, DateRangePicker, Segmented, SingleSelect, MultiSelect, FilterChip. */
import { type ReactNode } from "react";

import { useT } from "@/i18n/I18nProvider";
import { cn } from "@/utils/cn";
import { Link } from "react-router-dom";

import { DateRangePicker } from "@/_components/molecules/DateRangePicker";
import { FilterChip } from "@/_components/molecules/FilterChip";
import { MultiSelect } from "@/_components/molecules/MultiSelect";
import { SearchField } from "@/_components/molecules/SearchField";
import { Segmented, type SegmentOption } from "@/_components/molecules/Segmented";
import { SingleSelect, type SingleSelectOption } from "@/_components/molecules/SingleSelect";

// ─── FilterBar (the shell) ───────────────────────────────────────────────────

export interface SearchConfig {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  suggestions?: Record<string, string[]> | null;
  onPick?: (label: string) => void;
  isLoading?: boolean;
  /** Entrée in the field: e.g. Produits opens the product whose barcode / PID is exactly the text. */
  onEnter?: (value: string) => void;
}

export interface DateRangeConfig {
  from: string | null;
  to: string | null;
  onChange: (from: string | null, to: string | null) => void;
}

export interface SegmentConfig<V extends string> {
  value: V;
  onChange: (v: V) => void;
  options: SegmentOption<V>[];
}

export interface MultiSelectConfig {
  label: string;
  options: string[];
  selected: string[];
  onChange: (next: string[]) => void;
}

export interface SingleSelectConfig {
  label: string;
  options: SingleSelectOption[];
  value: string;
  onChange: (v: string) => void;
}

export interface RightAction {
  label: ReactNode;
  icon?: ReactNode;
  variant: "primary" | "outline";
  onClick?: () => void;
  href?: string;
  disabled?: boolean;
}

export interface ActiveFilter {
  key: string;
  label: ReactNode;
  onClear: () => void;
}

export interface FilterBarProps<V extends string = string> {
  search?: SearchConfig;
  dateRange?: DateRangeConfig;
  segment?: SegmentConfig<V>;
  multiSelects?: MultiSelectConfig[];
  singleSelect?: SingleSelectConfig;
  rightActions?: RightAction[];
  activeFilters?: ActiveFilter[];
  onResetAll?: () => void;
  /** More controls of the page, after the others on row 1 (e.g. « Trier : Par date · Par type »). */
  extra?: ReactNode;
}

export function FilterBar<V extends string = string>({
  search,
  dateRange,
  segment,
  multiSelects,
  singleSelect,
  rightActions,
  activeFilters,
  onResetAll,
  extra,
}: FilterBarProps<V>) {
  const t = useT();
  const hasActive = (activeFilters?.length ?? 0) > 0;

  return (
    <section
      aria-label={t("shared.filters")}
      className="sticky top-0 z-20 flex flex-col gap-2.5 rounded-xl border border-border bg-card/95 p-3 shadow-sm backdrop-blur"
    >
      {/* Row 1 — controls + right cluster */}
      <div className="flex flex-wrap items-center gap-2.5">
        {search && (
          <SearchField
            value={search.value}
            onChange={search.onChange}
            placeholder={search.placeholder}
            suggestions={search.suggestions ?? null}
            onPick={search.onPick ?? (() => {})}
            isLoading={search.isLoading}
            onEnter={search.onEnter}
          />
        )}

        {dateRange && <DateRangePicker from={dateRange.from} to={dateRange.to} onChange={dateRange.onChange} />}

        {segment && <Segmented<V> value={segment.value} options={segment.options} onChange={segment.onChange} />}

        {multiSelects?.map((ms) => (
          <MultiSelect
            key={ms.label}
            label={ms.label}
            options={ms.options}
            selected={ms.selected}
            onChange={ms.onChange}
          />
        ))}

        {singleSelect && (
          <SingleSelect
            label={singleSelect.label}
            options={singleSelect.options}
            value={singleSelect.value}
            onChange={singleSelect.onChange}
          />
        )}

        {extra}

        {rightActions && rightActions.length > 0 && (
          <div className="ml-auto flex flex-wrap items-center gap-2">
            {rightActions.map((a, i) => {
              const cls = cn(
                "inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-md px-3 text-[13px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50",
                a.variant === "primary"
                  ? "bg-primary text-primary-foreground shadow-sm hover:bg-primary/90"
                  : "border border-border bg-card text-foreground hover:bg-surface-subtle",
              );
              if (a.href) {
                return (
                  <Link key={i} to={a.href} className={cls}>
                    {a.icon}
                    {a.label}
                  </Link>
                );
              }
              return (
                <button key={i} type="button" onClick={a.onClick} disabled={a.disabled} className={cls}>
                  {a.icon}
                  {a.label}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Row 2 — active filter pills + reset all */}
      {hasActive && (
        <div className="flex flex-wrap items-center gap-2 border-t border-border pt-2.5">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            {t("shared.activeFilters")}
          </span>
          {activeFilters!.map((f) => (
            <FilterChip key={f.key} onRemove={f.onClear}>
              {f.label}
            </FilterChip>
          ))}
          {onResetAll && (
            <button
              type="button"
              onClick={onResetAll}
              className="ml-1 cursor-pointer text-xs font-semibold text-primary hover:underline"
            >
              {t("shared.resetAll")}
            </button>
          )}
        </div>
      )}
    </section>
  );
}
