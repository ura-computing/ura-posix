import { Badge } from "@/_components/atoms/Badge";
import { useT } from "@/i18n/I18nProvider";
import type { ProductType } from "@/types";

/** Pharmacie / Parapharmacie badge (catalogue, achats, ventes, comptabilité). "—" when unknown.
 *  `size="md"`: the bigger one under a page title (product sheet). */
export function TypeBadge({ type, size = "sm" }: { type: ProductType | null; size?: "sm" | "md" }) {
  const t = useT();
  if (!type) return <span className="text-muted-foreground">—</span>;
  const isPharma = type === "pharmacie";
  return (
    <Badge tone={isPharma ? "pharmacie" : "parapharmacie"} size={size}>
      {isPharma ? t("category.pharmacie") : t("category.parapharmacie")}
    </Badge>
  );
}
