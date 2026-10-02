import { useT } from "@/i18n/I18nProvider";
import type { ProductType } from "@/types";


/** Pharmacie / Parapharmacie badge (catalogue, achats, ventes, comptabilité). "—" when unknown. */
export function TypeBadge({ type }: { type: ProductType | null }) {
  const t = useT();
  if (!type) return <span className="text-muted-foreground">—</span>;
  const isPharma = type === "pharmacie";
  return (
    <span className={`inline-flex items-center rounded-md border px-1.5 py-0.5 text-[11px] font-medium ${
      isPharma
        ? "bg-pharmacie-bg text-pharmacie-fg border-pharmacie-border"
        : "bg-parapharmacie-bg text-parapharmacie-fg border-parapharmacie-border"
    }`}>
      {isPharma ? t("category.pharmacie") : t("category.parapharmacie")}
    </span>
  );
}
