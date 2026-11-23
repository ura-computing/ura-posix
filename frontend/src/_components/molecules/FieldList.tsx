/** Label left, value in a second column: the product's « Informations générales », a store request.
 *  Example: `<FieldList fields={[{ label: "Pharmacie", value: "Pharmacie Demo · CAS0001" }]} />`. */
import type { ReactNode } from "react";

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
