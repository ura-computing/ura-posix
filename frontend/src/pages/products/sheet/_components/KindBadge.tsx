/** « Vente » (red) / « Achat » (green): the type of one line of the product (Général, Mouvements). */
import type { ProductMovement } from "@/types";
import { useT } from "@/i18n/I18nProvider";
import { cn } from "@/utils/cn";

export function KindBadge({ kind }: { kind: ProductMovement["kind"] }) {
  const t = useT();
  return (
    <span
      className={cn(
        "inline-flex rounded-md px-2 py-0.5 text-xs font-semibold",
        kind === "achat"
          ? "bg-success-subtle text-success-subtle-foreground"
          : "bg-error-subtle text-error-subtle-foreground",
      )}
    >
      {t(kind === "achat" ? "products.kindAchat" : "products.kindVente")}
    </span>
  );
}
