/** A small figure with its label above (« MARGE BRUTE » / « 12 345,67 MAD »): Rapport's margin box, Alertes' expiry
 *  cards. */
import type { ReactNode } from "react";

export function LabeledValue({ label, value }: { label: ReactNode; value: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className="font-mono text-base font-bold tabular-nums text-foreground">{value}</span>
    </div>
  );
}
