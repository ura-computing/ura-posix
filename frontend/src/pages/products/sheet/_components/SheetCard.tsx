/** One block of the product sheet: a title + its content, and a label / value list. */
import type { ReactNode } from "react";

import { cn } from "@/utils/cn";

export function SheetCard({
  title,
  actions,
  children,
  className,
}: {
  title: string;
  /** Right of the title (e.g. a Tableau / Graphique switch). */
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("flex flex-col gap-3 rounded-xl border border-border bg-card p-4", className)}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{title}</h2>
        {actions}
      </div>
      {children}
    </section>
  );
}

export interface Field {
  label: string;
  value: ReactNode;
}

export function FieldList({ fields }: { fields: Field[] }) {
  return (
    <dl className="flex flex-col divide-y divide-border">
      {fields.map((f) => (
        <div key={f.label} className="flex items-baseline justify-between gap-4 py-2">
          <dt className="text-sm text-muted-foreground">{f.label}</dt>
          <dd className="text-right text-base font-medium text-foreground">{f.value}</dd>
        </div>
      ))}
    </dl>
  );
}
