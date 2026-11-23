/** The big « Retour à la liste … » at the top of a detail page (easy to spot; the top bar already shows where we
 *  are). Example: `<BackLink to={ROUTES.PRODUITS} label={t("products.backToList")} />`. */
import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";

export function BackLink({ to, label }: { to: string; label: string }) {
  return (
    <Link
      to={to}
      className="inline-flex h-11 w-fit items-center gap-2 rounded-lg border border-border bg-card px-4 text-base font-semibold text-foreground transition-colors hover:bg-surface-subtle"
    >
      <ArrowLeft className="size-5" />
      {label}
    </Link>
  );
}
