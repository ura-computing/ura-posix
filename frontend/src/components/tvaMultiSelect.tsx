import { useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/utils/cn";

type Props = {
  allRates: string[];
  selected: string[];
  onChange: (rates: string[]) => void;
};

export function TvaMultiSelect({ allRates, selected, onChange }: Props) {
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
            "h-9 gap-1.5 text-xs font-normal",
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
