import { Building2 } from "lucide-react";

import type { AdminPharmacyRow } from "@/types";


/**
 * Compact accent strip shown when the admin has selected a pharmacy. Sits above
 * the per-pharmacy sections so it's always clear which pharmacy the dashboard
 * data refers to. Code is rendered in mono so it stays readable next to the name.
 */

export function AdminContextStrip({ pharmacy }: { pharmacy: AdminPharmacyRow }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-primary/20 bg-primary/5 px-4 py-2.5">
      <div className="flex size-8 items-center justify-center rounded-lg bg-primary/15 text-primary">
        <Building2 className="size-4" aria-hidden />
      </div>
      {pharmacy.code && (
        <span className="rounded-full border border-primary/30 bg-card px-2.5 py-0.5 font-mono text-xs font-semibold text-primary">
          {pharmacy.code}
        </span>
      )}
      <span className="text-sm font-semibold text-foreground">{pharmacy.name}</span>
      <span className="text-xs text-muted-foreground">·</span>
      <span className="text-xs text-muted-foreground">Vue détaillée par pharmacie</span>
    </div>
  );
}