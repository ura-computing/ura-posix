/** Pill cluster used on the pharmacies index Fonctionnalités column AND on the
 *  Membres table Permissions accordées column. Same special-cases everywhere:
 *  empty = "Aucune" (warning tone), every one = "Toutes" (primary), partial = up
 *  to 4 named pills + "+N" overflow. */
import { useT } from "@/i18n/I18nProvider";
import { Badge } from "@/_components/atoms/Badge";

import { FEATURE_KEYS, FEATURE_LABELS, type FeatureKey } from "@/_components/organisms/memberConstants";

export function FeaturePills({ features, maxShown = 4 }: { features: string[]; maxShown?: number }) {
  const t = useT();
  if (features.length === 0) {
    return <Badge tone="warning">{t("adminPharm.pillNone")}</Badge>;
  }
  if (FEATURE_KEYS.every((k) => features.includes(k))) {
    return <Badge tone="primary">{t("adminPharm.pillAll")}</Badge>;
  }
  const shown = features.slice(0, maxShown);
  const extra = features.length - shown.length;
  return (
    <div className="flex flex-wrap items-center gap-1">
      {shown.map((f) => (
        <Badge key={f}>{FEATURE_LABELS[f as FeatureKey] ? t(FEATURE_LABELS[f as FeatureKey]) : f}</Badge>
      ))}
      {extra > 0 && <Badge tone="primary">+{extra}</Badge>}
    </div>
  );
}
