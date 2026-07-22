/** Pill cluster used on the pharmacies index Fonctionnalités column AND on the
 *  Membres table Permissions accordées column. Same special-cases everywhere:
 *  empty = "Aucune" (warning tone), full 9 = "Toutes" (primary), partial = up
 *  to 4 named pills + "+N" overflow. */
import { useT } from "@/i18n/I18nProvider";
import { cn } from "@/utils/cn";

import { FEATURE_LABELS, type FeatureKey } from "./constants";


/** Pill tone classes — kept inline so we don't grow a Badge primitive
 *  just for this. Same tokens as the rest of the app. */
const PILL_BASE = "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold whitespace-nowrap";
const PILL_MUTED   = "bg-muted text-muted-foreground";
const PILL_PRIMARY = "bg-primary/15 text-primary";
const PILL_WARNING = "bg-warning-subtle text-warning";


export function FeaturePills({ features, maxShown = 4 }: { features: string[]; maxShown?: number }) {
  const t = useT();
  if (features.length === 0) {
    return <span className={cn(PILL_BASE, PILL_WARNING)}>{t("adminPharm.pillNone")}</span>;
  }
  if (features.length === 9) {
    return <span className={cn(PILL_BASE, PILL_PRIMARY)}>{t("adminPharm.pillAll")}</span>;
  }
  const shown = features.slice(0, maxShown);
  const extra = features.length - shown.length;
  return (
    <div className="flex flex-wrap items-center gap-1">
      {shown.map((f) => (
        <span key={f} className={cn(PILL_BASE, PILL_MUTED)}>
          {FEATURE_LABELS[f as FeatureKey] ? t(FEATURE_LABELS[f as FeatureKey]) : f}
        </span>
      ))}
      {extra > 0 && (
        <span className={cn(PILL_BASE, PILL_PRIMARY)}>+{extra}</span>
      )}
    </div>
  );
}
