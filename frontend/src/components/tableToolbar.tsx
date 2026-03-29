import { useState } from "react";
import { CalendarIcon, Check, ChevronDown, Download, Loader2, Search, X } from "lucide-react";
import { format, subDays, startOfMonth } from "date-fns";
import { fr } from "date-fns/locale";
import type { DateRange } from "react-day-picker";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/utils/cn";
import { CategoryMultiSelect } from "@/components/categoryMultiSelect";
import { SearchAutocomplete } from "@/components/searchAutocomplete";

// ── TVA multi-select dropdown ───────────────────────────────────────────────

type TvaMultiSelectProps = {
  allRates: string[];
  selected: string[];
  onChange: (rates: string[]) => void;
};

function TvaMultiSelect({ allRates, selected, onChange }: TvaMultiSelectProps) {
  const [open, setOpen] = useState(false);

  const toggle = (rate: string) =>
    onChange(selected.includes(rate) ? selected.filter((r) => r !== rate) : [...selected, rate]);

  const label =
    selected.length === 0
      ? "TVA"
      : selected.length === 1
      ? selected[0]
      : `${selected.length} taux`;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={cn(
            "h-8 gap-1.5 text-xs font-normal",
            selected.length > 0 && "border-primary text-primary bg-primary/5",
          )}
        >
          <span>{label}</span>
          <ChevronDown className="h-3.5 w-3.5 opacity-50 shrink-0" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-44 p-1" align="start">
        {selected.length > 0 && (
          <button
            type="button"
            className="w-full text-left px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground"
            onClick={() => onChange([])}
          >
            Tout désélectionner
          </button>
        )}
        {allRates.map((rate) => {
          const checked = selected.includes(rate);
          return (
            <div
              key={rate}
              className="flex items-center gap-2 px-2 py-1.5 rounded-sm cursor-pointer hover:bg-accent"
              onClick={() => toggle(rate)}
            >
              <div
                className={cn(
                  "h-4 w-4 rounded border flex items-center justify-center shrink-0",
                  checked ? "bg-primary border-primary" : "border-input",
                )}
              >
                {checked && <Check className="h-3 w-3 text-primary-foreground" />}
              </div>
              <span className="text-sm">{rate}</span>
            </div>
          );
        })}
      </PopoverContent>
    </Popover>
  );
}

// ── Main toolbar ────────────────────────────────────────────────────────────

type TableToolbarProps = {
  searchQuery: string;
  onSearchChange: (v: string) => void;
  searchPlaceholder?: string;
  allCategories: string[];
  selectedCats: string[];
  onCatsChange: (cats: string[]) => void;
  onExport: () => void;
  exporting: boolean;
  dateRange?: DateRange;
  onDateRangeChange?: (range: DateRange | undefined) => void;
  allTvaRates?: string[];
  selectedTva?: string[];
  onTvaChange?: (rates: string[]) => void;
  fetchSuggestions?: (q: string) => Promise<Record<string, string[]>>;
  suggestionGroupLabels?: Record<string, string>;
  rightAddon?: React.ReactNode;
};

export function TableToolbar({
  searchQuery,
  onSearchChange,
  searchPlaceholder = "Rechercher…",
  allCategories,
  selectedCats,
  onCatsChange,
  onExport,
  exporting,
  dateRange,
  onDateRangeChange,
  allTvaRates,
  selectedTva = [],
  onTvaChange,
  fetchSuggestions,
  suggestionGroupLabels = {},
  rightAddon,
}: TableToolbarProps) {
  const today = new Date();
  const [dateOpen, setDateOpen] = useState(false);

  const applyDatePreset = (preset: "today" | "7d" | "month") => {
    if (!onDateRangeChange) return;
    if (preset === "today") onDateRangeChange({ from: today, to: today });
    else if (preset === "7d") onDateRangeChange({ from: subDays(today, 6), to: today });
    else onDateRangeChange({ from: startOfMonth(today), to: today });
    setDateOpen(false);
  };

  const dateLabel = dateRange?.from
    ? dateRange.to && dateRange.to.getTime() !== dateRange.from.getTime()
      ? `${format(dateRange.from, "d MMM", { locale: fr })} – ${format(dateRange.to, "d MMM yy", { locale: fr })}`
      : format(dateRange.from, "d MMM yyyy", { locale: fr })
    : null;

  const hasActiveFilters =
    selectedCats.length > 0 || selectedTva.length > 0 || !!dateRange?.from;

  const clearAllFilters = () => {
    onCatsChange([]);
    onTvaChange?.([]);
    onDateRangeChange?.(undefined);
  };

  const showFilters =
    onDateRangeChange || allCategories.length > 0 || (allTvaRates && allTvaRates.length > 0);

  return (
    <div className="flex flex-col gap-2 w-full">

      {/* ── Row 1: Search + Export ── */}
      <div className="flex items-center gap-2">
        {fetchSuggestions ? (
          <SearchAutocomplete
            value={searchQuery}
            onChange={onSearchChange}
            fetchSuggestions={fetchSuggestions}
            placeholder={searchPlaceholder}
            groupLabels={suggestionGroupLabels}
          />
        ) : (
          <div className="search-field flex-1">
            <Search className="search-icon" />
            <Input
              type="text"
              placeholder={searchPlaceholder}
              className="pl-10 w-full"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
            />
          </div>
        )}

        {rightAddon}

        <Button
          variant="outline"
          size="sm"
          className="h-9 gap-2 shrink-0"
          onClick={onExport}
          disabled={exporting}
        >
          {exporting
            ? <Loader2 className="h-4 w-4 animate-spin" />
            : <Download className="h-4 w-4" />}
          <span className="hidden sm:inline">{exporting ? "Export…" : "Exporter CSV"}</span>
        </Button>
      </div>

      {/* ── Row 2: Filters ── */}
      {showFilters && (
        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 min-w-0">

          {/* Date range — trigger + separate × clear button */}
          {onDateRangeChange && (
            <div className="flex items-center">
              <Popover open={dateOpen} onOpenChange={setDateOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className={cn(
                      "h-8 gap-1.5 text-xs font-normal",
                      dateLabel
                        ? "rounded-r-none border-r-0 border-primary/60 text-primary bg-primary/5"
                        : "rounded-md",
                    )}
                  >
                    <CalendarIcon className="h-3.5 w-3.5 shrink-0 opacity-70" />
                    <span>{dateLabel ?? "Période"}</span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start" sideOffset={6}>
                  <div className="flex items-center gap-1 px-3 py-2 border-b">
                    <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => applyDatePreset("today")}>
                      Aujourd'hui
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => applyDatePreset("7d")}>
                      7 jours
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => applyDatePreset("month")}>
                      Ce mois
                    </Button>
                  </div>
                  <Calendar
                    mode="range"
                    selected={dateRange}
                    onSelect={(r) => {
                      onDateRangeChange(r);
                      if (r?.to) setDateOpen(false);
                    }}
                    numberOfMonths={2}
                    locale={fr}
                    disabled={{ after: today }}
                    initialFocus
                  />
                  <div className="px-3 py-2 border-t">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full h-7 text-xs text-muted-foreground"
                      onClick={() => { onDateRangeChange(undefined); setDateOpen(false); }}
                    >
                      <X className="h-3 w-3 mr-1" />
                      Effacer la période
                    </Button>
                  </div>
                </PopoverContent>
              </Popover>

              {/* × clear date — outside Popover to avoid trigger conflict */}
              {dateLabel && (
                <button
                  type="button"
                  onClick={() => onDateRangeChange(undefined)}
                  className="h-8 w-7 flex items-center justify-center border border-primary/60 bg-primary/5 rounded-r-md text-primary hover:bg-primary/10 transition-colors"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          )}

          {/* Category selector */}
          {allCategories.length > 0 && (
            <CategoryMultiSelect
              allCategories={allCategories}
              selected={selectedCats}
              onChange={onCatsChange}
              className="h-8 w-36 text-xs"
            />
          )}

          {/* TVA selector */}
          {allTvaRates && allTvaRates.length > 0 && onTvaChange && (
            <TvaMultiSelect
              allRates={allTvaRates}
              selected={selectedTva}
              onChange={onTvaChange}
            />
          )}

          {/* Clear all active filters */}
          {hasActiveFilters && (
            <button
              type="button"
              onClick={clearAllFilters}
              className="ml-1 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="h-3 w-3" />
              Effacer
            </button>
          )}
        </div>
      )}
    </div>
  );
}
