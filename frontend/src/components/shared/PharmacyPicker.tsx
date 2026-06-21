/** Admin-only pharmacy selector. Styled pill wrapping a native `<select>` for
 *  accessibility. Used standalone above /rapport's per-pharmacy drill-down
 *  section.
 *
 *  Extracted from the old `RapportFilterBar` when the filter bar was unified.
 *  Lives in `components/shared/` because future admin pages (admin/pharmacies,
 *  admin stats drill-downs) will reuse the same picker.
 */
import { Building2, ChevronDown } from "lucide-react";

import type { AdminPharmacyRow } from "@/types";


export interface PharmacyPickerProps {
  pharmacies: AdminPharmacyRow[];
  selected:   AdminPharmacyRow | null;
  onChange:   (id: number | null) => void;
}


export function PharmacyPicker({ pharmacies, selected, onChange }: PharmacyPickerProps) {
  return (
    <label className="group relative inline-flex cursor-pointer items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-sm text-foreground transition-shadow hover:shadow-sm focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-ring">
      <Building2 className="size-4 text-muted-foreground" aria-hidden />
      <span className="text-xs font-semibold text-muted-foreground">Pharmacie</span>
      {selected ? (
        <>
          <span className="rounded-full bg-primary/10 px-2 py-0.5 font-mono text-xs font-semibold text-primary">
            {selected.code ?? "—"}
          </span>
          <span className="max-w-[160px] truncate text-sm font-medium">{selected.name}</span>
        </>
      ) : (
        <span className="text-sm text-muted-foreground">Sélectionnez…</span>
      )}
      <ChevronDown className="size-3.5 text-muted-foreground" aria-hidden />
      <select
        aria-label="Sélectionner une pharmacie"
        value={selected?.id ?? ""}
        onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
        className="absolute inset-0 cursor-pointer opacity-0"
      >
        <option value="">Sélectionnez…</option>
        {pharmacies.map((p) => (
          <option key={p.id} value={p.id}>{p.code} · {p.name}</option>
        ))}
      </select>
    </label>
  );
}
