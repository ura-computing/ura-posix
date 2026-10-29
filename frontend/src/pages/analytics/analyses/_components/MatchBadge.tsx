/** « Trouvé » / « Introuvable »: a product of the uploaded list found in the pharmacy or not. */
import { Badge } from "@/_components/atoms/Badge";
import { useT } from "@/i18n/I18nProvider";

export function MatchBadge({ found }: { found: boolean }) {
  const t = useT();
  return found ? (
    <Badge tone="success">{t("analyse.found")}</Badge>
  ) : (
    <Badge tone="error">{t("analyse.notFound")}</Badge>
  );
}
