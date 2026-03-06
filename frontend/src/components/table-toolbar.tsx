import { useState } from "react";
import { Check, ChevronDown, CalendarIcon, Download, Search, X } from "lucide-react";
import { format, subDays, startOfMonth } from "date-fns";
import { fr } from "date-fns/locale";
import type { DateRange } from "react-day-picker";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { stripPct } from "@/lib/table-utils";

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
}: TableToolbarProps) {
  const today = new Date();
  const [catOpen, setCatOpen] = useState(false);
  const [dateOpen, setDateOpen] = useState(false);

  const toggleCat = (cat: string) =>
    onCatsChange(
      selectedCats.includes(cat)
        ? selectedCats.filter((c) => c !== cat)
        : [...selectedCats, cat],
    );

  const applyDatePreset = (preset: "today" | "7d" | "month") => {
    if (!onDateRangeChange) return;
    if (preset === "today") onDateRangeChange({ from: today, to: today });
    else if (preset === "7d") onDateRangeChange({ from: subDays(today, 6), to: today });
    else onDateRangeChange({ from: startOfMonth(today), to: today });
    setDateOpen(false);
  };

  const dateLabel = dateRange?.from
    ? dateRange.to && dateRange.to.getTime() !== dateRange.from.getTime()
      ? `${format(dateRange.from, "d MMM", { locale: fr })} – ${format(dateRange.to, "d MMM yyyy", { locale: fr })}`
      : format(dateRange.from, "d MMM yyyy", { locale: fr })
    : "Période";

  const catLabel =
    selectedCats.length === 0
      ? "Toutes les catégories"
      : selectedCats.length === 1
        ? stripPct(selectedCats[0])
        : `${selectedCats.length} catégories`;

  return (
    <div className="actions-row">
      <div className="search-field">
        <Search className="search-icon" />
        <Input
          type="text"
          placeholder={searchPlaceholder}
          className="pl-10 w-full"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
        />
      </div>

      <Popover open={catOpen} onOpenChange={setCatOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              "h-9 w-full md:w-52 justify-between text-sm font-normal",
              selectedCats.length > 0 && "border-primary text-primary",
            )}
          >
            <span className="truncate">{catLabel}</span>
            <ChevronDown className="h-4 w-4 opacity-50 shrink-0" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-56 p-1" align="start">
          {selectedCats.length > 0 && (
            <button
              className="w-full text-left px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground"
              onClick={() => onCatsChange([])}
            >
              Tout désélectionner
            </button>
          )}
          <ScrollArea className="max-h-64">
            {allCategories.map((cat) => {
              const checked = selectedCats.includes(cat);
              return (
                <div
                  key={cat}
                  className="flex items-center gap-2 px-2 py-1.5 rounded-sm cursor-pointer hover:bg-accent"
                  onClick={() => toggleCat(cat)}
                >
                  <div
                    className={cn(
                      "h-4 w-4 rounded border flex items-center justify-center shrink-0",
                      checked ? "bg-primary border-primary" : "border-input",
                    )}
                  >
                    {checked && <Check className="h-3 w-3 text-primary-foreground" />}
                  </div>
                  <span className="text-sm truncate">{stripPct(cat)}</span>
                </div>
              );
            })}
          </ScrollArea>
        </PopoverContent>
      </Popover>

      {selectedCats.length > 0 && (
        <Button
          variant="ghost"
          size="sm"
          className="h-9 gap-1 text-muted-foreground"
          onClick={() => onCatsChange([])}
        >
          <X className="h-3.5 w-3.5" />
          Effacer
        </Button>
      )}

      {onDateRangeChange && (
        <Popover open={dateOpen} onOpenChange={setDateOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                "h-9 w-full md:w-48 justify-start gap-2 text-sm font-normal",
                dateRange?.from && "border-primary text-primary",
              )}
            >
              <CalendarIcon className="h-4 w-4 shrink-0 opacity-60" />
              <span className="truncate">{dateLabel}</span>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start" sideOffset={6}>
            <div className="flex items-center gap-1 px-3 py-2 border-b">
              <Button size="sm" variant="ghost" className="h-7 text-xs rounded-md" onClick={() => applyDatePreset("today")}>
                Aujourd'hui
              </Button>
              <Button size="sm" variant="ghost" className="h-7 text-xs rounded-md" onClick={() => applyDatePreset("7d")}>
                7 jours
              </Button>
              <Button size="sm" variant="ghost" className="h-7 text-xs rounded-md" onClick={() => applyDatePreset("month")}>
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
            {dateRange?.from && (
              <div className="px-3 py-2 border-t">
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full h-7 text-xs text-muted-foreground"
                  onClick={() => {
                    onDateRangeChange(undefined);
                    setDateOpen(false);
                  }}
                >
                  <X className="h-3 w-3 mr-1" />
                  Effacer la période
                </Button>
              </div>
            )}
          </PopoverContent>
        </Popover>
      )}

      <Button
        variant="outline"
        size="sm"
        className="h-9 gap-2"
        onClick={onExport}
        disabled={exporting}
      >
        <Download className="h-4 w-4" />
        {exporting ? "Export…" : "Exporter CSV"}
      </Button>
    </div>
  );
}
