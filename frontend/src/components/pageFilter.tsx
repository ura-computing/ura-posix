import { ReactNode, useTransition } from "react";
import { Search } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/datePicker";
import { SearchAutocomplete } from "@/components/searchAutocomplete";
import { cn } from "@/utils/cn";
import { eCategoryType } from "@/types";

type SearchConfig = {
  query: string;
  onChange: (v: string) => void;
  placeholder?: string;
  fetchSuggestions?: (q: string) => Promise<Record<string, string[]>>;
  suggestionGroupLabels?: Record<string, string>;
};

type Props = {
  dateFrom: string;
  dateTo: string;
  onDateFromChange: (v: string) => void;
  onDateToChange: (v: string) => void;
  categoryType?: eCategoryType;
  onCategoryTypeChange?: (v: eCategoryType) => void;
  search?: SearchConfig;
  extraFilters?: ReactNode;
  rightSlot?: ReactNode;
};

export function PageFilter({
  dateFrom,
  dateTo,
  onDateFromChange,
  onDateToChange,
  categoryType,
  onCategoryTypeChange,
  search,
  extraFilters,
  rightSlot,
}: Props) {
  const showCategory = categoryType !== undefined && onCategoryTypeChange;
  const showReset = !!(dateFrom || dateTo);
  const [, startTransition] = useTransition();
  const changeCategory = (v: eCategoryType) => {
    startTransition(() => onCategoryTypeChange!(v));
  };
  return (
    <div className="sticky top-16 z-10 bg-background">
      <Card className="border border-border shadow-sm">
        <CardContent className="p-4 space-y-3">
          {search && (
            search.fetchSuggestions ? (
              <SearchAutocomplete
                value={search.query}
                onChange={search.onChange}
                fetchSuggestions={search.fetchSuggestions}
                placeholder={search.placeholder}
                groupLabels={search.suggestionGroupLabels ?? {}}
              />
            ) : (
              <div className="search-field">
                <Search className="search-icon" />
                <Input
                  type="text"
                  placeholder={search.placeholder ?? "Rechercher…"}
                  className="pl-10 w-full"
                  value={search.query}
                  onChange={(e) => search.onChange(e.target.value)}
                />
              </div>
            )
          )}
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Du</Label>
              <DatePicker value={dateFrom} onChange={onDateFromChange} placeholder="Début" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Au</Label>
              <DatePicker value={dateTo} onChange={onDateToChange} placeholder="Fin" />
            </div>
            {showReset && (
              <Button
                variant="ghost"
                size="sm"
                className="h-9 text-muted-foreground"
                onClick={() => {
                  onDateFromChange("");
                  onDateToChange("");
                }}
              >
                Réinitialiser
              </Button>
            )}
            {extraFilters}
            {(showCategory || rightSlot) && (
              <div className="flex items-center gap-1.5 ml-auto flex-wrap">
                {showCategory && (
                  <>
                    <Button
                      size="sm"
                      variant={categoryType === eCategoryType.ALL ? "default" : "outline"}
                      className="h-9"
                      onClick={() => changeCategory(eCategoryType.ALL)}
                    >
                      Mixte
                    </Button>
                    <Button
                      size="sm"
                      className={cn(
                        "h-9 border",
                        categoryType === eCategoryType.PHARMACIE
                          ? "bg-green-600 text-white border-green-600 hover:bg-green-700"
                          : "bg-transparent text-green-700 border-green-400 hover:bg-green-50 dark:text-green-400 dark:border-green-700 dark:hover:bg-green-950/30",
                      )}
                      onClick={() => changeCategory(eCategoryType.PHARMACIE)}
                    >
                      Pharmacie
                    </Button>
                    <Button
                      size="sm"
                      className={cn(
                        "h-9 border",
                        categoryType === eCategoryType.PARAPHARMACIE
                          ? "bg-purple-600 text-white border-purple-600 hover:bg-purple-700"
                          : "bg-transparent text-purple-700 border-purple-400 hover:bg-purple-50 dark:text-purple-400 dark:border-purple-700 dark:hover:bg-purple-950/30",
                      )}
                      onClick={() => changeCategory(eCategoryType.PARAPHARMACIE)}
                    >
                      Parapharmacie
                    </Button>
                  </>
                )}
                {rightSlot}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
