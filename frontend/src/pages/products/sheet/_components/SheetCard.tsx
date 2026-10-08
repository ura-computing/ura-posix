/** One block of the product sheet: icon + title (+ a small hint) + its content, and a label / value list. */
import type { ReactNode } from "react";

import { cn } from "@/utils/cn";

export function SheetCard({
  title,
  icon,
  hint,
  actions,
  children,
  className,
}: {
  title: string;
  icon?: ReactNode;
  /** Small text after the title, e.g. « (30 derniers jours) ». */
  hint?: string;
  /** Right of the title (e.g. « Éditer », « Voir tout »). */
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("flex flex-col gap-3 rounded-xl border border-border bg-card p-4", className)}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {icon && <span className="text-primary">{icon}</span>}
          <h2 className="text-base font-semibold text-foreground">{title}</h2>
          {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
        </div>
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

/** Label left, value in a second column (« Informations générales »). */
export function FieldList({ fields }: { fields: Field[] }) {
  return (
    <dl className="flex flex-col divide-y divide-border">
      {fields.map((f) => (
        <div key={f.label} className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] items-baseline gap-4 py-2">
          <dt className="text-sm text-muted-foreground">{f.label}</dt>
          <dd className="min-w-0 break-words text-base font-medium text-foreground">{f.value}</dd>
        </div>
      ))}
    </dl>
  );
}
