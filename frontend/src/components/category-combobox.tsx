/**
 * CategoryCombobox — searchable dropdown for existing catalog categories.
 * Allows selecting an existing category OR typing a new one.
 */
import { useState, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, Check } from "lucide-react";
import { cn } from "@/utils/cn";
import { listCatalogCategories } from "@/api/admin";

type Props = {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  disabled?: boolean;
};

export function CategoryCombobox({ value, onChange, placeholder = "Catégorie", disabled }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(value);
  const containerRef = useRef<HTMLDivElement>(null);

  const { data: categories = [] } = useQuery({
    queryKey: ["catalog-categories"],
    queryFn: () => listCatalogCategories(),
    staleTime: 60_000,
  });

  // Sync input when value changes externally (e.g. form reset)
  useEffect(() => {
    setQuery(value);
  }, [value]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        // Commit whatever was typed
        onChange(query);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [query, onChange]);

  const filtered = query
    ? categories.filter((c) => c.toLowerCase().includes(query.toLowerCase()))
    : categories;

  const handleSelect = (cat: string) => {
    setQuery(cat);
    onChange(cat);
    setOpen(false);
  };

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <input
          type="text"
          value={query}
          disabled={disabled}
          placeholder={placeholder}
          className={cn(
            "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 pr-8 text-sm shadow-sm transition-colors",
            "placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
            "disabled:cursor-not-allowed disabled:opacity-50"
          )}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value);
            onChange(e.target.value);
            setOpen(true);
          }}
        />
        <ChevronDown
          className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none"
        />
      </div>

      {open && filtered.length > 0 && (
        <div className="absolute z-50 mt-1 w-full rounded-md border border-border bg-popover shadow-lg max-h-52 overflow-y-auto">
          {filtered.map((cat) => (
            <button
              key={cat}
              type="button"
              onMouseDown={(e) => { e.preventDefault(); handleSelect(cat); }}
              className={cn(
                "flex w-full items-center gap-2 px-3 py-2 text-sm text-left hover:bg-accent transition-colors",
                value === cat && "bg-accent/60"
              )}
            >
              <Check className={cn("h-3.5 w-3.5 shrink-0", value === cat ? "text-primary" : "invisible")} />
              {cat}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
