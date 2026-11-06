/** « Premium » next to a premium feature (the admin's switches, its buttons): one look everywhere. */
import { Crown } from "lucide-react";

import { Badge } from "@/_components/atoms/Badge";
import { useT } from "@/i18n/I18nProvider";

export function PremiumTag() {
  const t = useT();
  return (
    <Badge tone="warning">
      <Crown className="size-3" aria-hidden />
      {t("premium.tag")}
    </Badge>
  );
}
