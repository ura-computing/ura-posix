import { useRef, useState, useEffect, useCallback } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";

type Groups = Record<string, string[]>;

type Props = {
  value: string;
  onChange: (v: string) => void;
  fetchSuggestions: (q: string) => Promise<Groups>;
  placeholder?: string;
  groupLabels: Record<string, string>;
};

export function SearchAutocomplete({ value, onChange, fetchSuggestions, placeholder, groupLabels }: Props) {
  const [open, setOpen] = useState(false);
  const [groups, setGroups] = useState<Groups>({});
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const doFetch = useCallback(
    (q: string) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (!q || q.length < 2) { setGroups({}); setOpen(false); return; }
      timerRef.current = setTimeout(async () => {
        try {
          const result = await fetchSuggestions(q);
          const hasResults = Object.values(result).some((arr) => arr.length > 0);
          setGroups(result);
          setOpen(hasResults);
        } catch { /* ignore */ }
      }, 300);
    },
    [fetchSuggestions],
  );

  useEffect(() => { doFetch(value); }, [value, doFetch]);
  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  const hasResults = Object.values(groups).some((arr) => arr.length > 0);

  return (
    <div className="search-field flex-1 relative">
      <Search className="search-icon" />
      <Input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="pl-10 w-full"
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onFocus={() => { if (hasResults) setOpen(true); }}
      />
      {open && hasResults && (
        <div className="absolute top-full left-0 right-0 z-50 mt-1 rounded-md border bg-popover shadow-md p-1">
          {Object.entries(groupLabels).map(([key, label]) => {
            const items = groups[key] ?? [];
            if (items.length === 0) return null;
            return (
              <div key={key}>
                <p className="px-2 py-1 text-xs font-medium text-muted-foreground">{label}</p>
                {items.map((item) => (
                  <button
                    key={item}
                    type="button"
                    className="w-full text-left px-2 py-1.5 text-sm rounded hover:bg-muted"
                    onMouseDown={(e) => { e.preventDefault(); onChange(item); setOpen(false); }}
                  >
                    {item}
                  </button>
                ))}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
