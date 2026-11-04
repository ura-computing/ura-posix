/** A block whose data could not load: says so in plain words, « Réessayer » loads it again. The reason (server
 *  problem, no connection) is in the toast every failed request shows (main.tsx). */
import { RefreshCw } from "lucide-react";

import { Button } from "@/_components/atoms/Button";
import { Callout } from "@/_components/molecules/Callout";
import { useT } from "@/i18n/I18nProvider";

export function LoadError({
  message,
  onRetry,
  className,
}: {
  /** Default « Impossible de charger ces informations. ». */
  message?: string;
  onRetry: () => void;
  className?: string;
}) {
  const t = useT();
  return (
    <Callout
      tone="error"
      className={className}
      action={
        <Button variant="secondary" onClick={onRetry}>
          <RefreshCw className="size-3.5" />
          {t("common.retry")}
        </Button>
      }
    >
      {message ?? t("common.loadError")}
    </Callout>
  );
}
