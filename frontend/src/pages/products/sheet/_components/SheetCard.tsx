/** One block of the product sheet, in the app's look (Tableau de bord, Stock): the title in small
 *  grey capitals (+ a small hint), its buttons on the right, its content; and a label / value list. */
import type { ReactNode } from "react";

import { cn } from "@/utils/cn";

export function SheetCard({
  title,
  hint,
  actions,
  children,
  className,
}: {
  title: string;
  /** Small text after the title, e.g. « du 22 sept. 2026 au 21 oct. 2026 ». */
  hint?: string;
  /** Right of the title (e.g. « Éditer », « Voir tout »). */
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("flex flex-col gap-3 rounded-2xl border border-border bg-card p-5 shadow-sm", className)}>
      <div className="flex min-h-8 flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{title}</h2>
          {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
        </div>
        {actions}
      </div>
      {children}
    </section>
  );
}

/** A tile number + its unit, smaller (like « / 10 » on Stock): « 2 359 unités », « 30 902,90 MAD ». */
export function TileNumber({ value, unit }: { value: ReactNode; unit: string }) {
  return (
    <>
      <span className="whitespace-nowrap">{value}</span>{" "}
      <span className="font-mono text-base font-semibold text-muted-foreground">{unit}</span>
    </>
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
