/** A premium feature's button, clicked. The pharmacy does not have it → what it gives, « Pour l'activer, contactez
 *  APCM » (information only: nothing sent, the admin switches it on himself). It has it → « Bientôt disponible » for
 *  now. One button: « Fermer ». */
import { Clock, Crown } from "lucide-react";

import { Button } from "@/_components/atoms/Button";
import { Dialog, DialogContent } from "@/_components/atoms/Dialog";
import { DialogBody, DialogFooter, DialogHeader } from "@/_components/molecules/DialogShell";
import { useT } from "@/i18n/I18nProvider";

export type PremiumFeature = "labels" | "orders";

export function PremiumDialog({
  feature,
  unlocked,
  onClose,
}: {
  /** null = closed. */
  feature: PremiumFeature | null;
  /** The pharmacy has it (its effective permissions). */
  unlocked: boolean;
  onClose: () => void;
}) {
  const t = useT();
  return (
    <Dialog open={feature !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        {feature && (
          <>
            <DialogHeader
              icon={unlocked ? <Clock className="size-4" /> : <Crown className="size-4" />}
              title={unlocked ? t("premium.soonTitle") : t("premium.title")}
              onClose={onClose}
            />
            <DialogBody className="flex flex-col gap-3 text-base">
              <p className="font-medium text-foreground">{t(`premium.${feature}`)}</p>
              {unlocked ? (
                <p className="text-muted-foreground">{t("premium.soonText")}</p>
              ) : (
                <>
                  <p className="text-muted-foreground">{t("premium.included")}</p>
                  <p className="font-semibold text-foreground">{t("premium.how")}</p>
                </>
              )}
            </DialogBody>
            <DialogFooter>
              <Button variant="primary" onClick={onClose}>
                {t("common.close")}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
