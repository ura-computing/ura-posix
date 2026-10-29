import { useEffect, useRef, useState } from "react";
import { Search } from "lucide-react";

import { useT } from "@/i18n/I18nProvider";

interface SearchFieldProps<G extends Record<string, string[]>> {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  /** Map of group-label → string[]. e.g. { "Produit": [...], "Client": [...] } */
  suggestions: G | null;
  onPick: (label: string, group: keyof G) => void;
  isLoading?: boolean;
  debounceMs?: number;
  /** Entrée in the field (a barcode reader types the code + Entrée): the search applies at once. */
  onEnter?: (value: string) => void;
}

export function SearchField<G extends Record<string, string[]>>({
  value,
  onChange,
  placeholder,
  suggestions,
  onPick,
  isLoading = false,
  debounceMs = 300,
  onEnter,
}: SearchFieldProps<G>) {
  const t = useT();
  const [draft, setDraft] = useState(value);
  const [lastValue, setLastValue] = useState(value);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Sync draft when parent externally resets `value` (Réinitialiser, etc.).
  // Render-phase comparison per React docs — avoids setState-in-useEffect.
  if (value !== lastValue) {
    setLastValue(value);
    setDraft(value);
  }

  useEffect(() => {
    if (draft === value) return;
    const t = setTimeout(() => onChange(draft), debounceMs);
    return () => clearTimeout(t);
  }, [draft, value, onChange, debounceMs]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const groups = suggestions ? (Object.entries(suggestions) as [keyof G, string[]][]) : [];
  const hasAny = groups.some(([, items]) => items.length > 0);

  return (
    <div ref={ref} className="relative flex-1 min-w-[220px]">
      <Search className="pointer-events-none absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
      <input
        type="text"
        value={draft}
        onChange={(e) => {
          setDraft(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key !== "Enter" || !onEnter) return;
          e.preventDefault();
          setOpen(false);
          if (draft !== value) onChange(draft);
          onEnter(draft.trim());
        }}
        placeholder={placeholder}
        className="h-9 w-full rounded-md border border-input bg-surface-subtle pl-8 pr-3 text-sm focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2"
      />
      {/* Only a page with suggestions opens the list: else « Aucun résultat » shows above found rows. */}
      {open && draft.length >= 2 && (suggestions || isLoading) && (
        <div className="absolute left-0 right-0 top-full z-30 mt-1 max-h-80 overflow-y-auto rounded-md border border-border bg-card shadow-lg">
          {isLoading && <div className="px-3 py-2 text-xs text-muted-foreground">{t("common.searching")}</div>}
          {!isLoading && !hasAny && (
            <div className="px-3 py-2 text-xs text-muted-foreground">{t("common.noResult")}</div>
          )}
          {!isLoading &&
            groups.map(([g, items]) =>
              items.length === 0 ? null : (
                <div key={String(g)} className="border-b border-border last:border-0">
                  <div className="bg-surface-subtle px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {String(g)}
                  </div>
                  {items.map((label) => (
                    <button
                      key={label}
                      type="button"
                      onClick={() => {
                        onPick(label, g);
                        onChange(label);
                        setDraft(label);
                        setOpen(false);
                      }}
                      className="block w-full cursor-pointer px-3 py-1.5 text-left text-sm hover:bg-surface-subtle"
                    >
                      {label}
                    </button>
                  ))}
                </div>
              ),
            )}
        </div>
      )}
    </div>
  );
}
