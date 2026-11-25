/** « Que s'est-il passé ? » for one declaration: big plain choices (« Je les ai rendues au fournisseur », « Je les ai
 *  jetées », « Erreur : les boîtes sont bonnes »), each with one line saying what it does, then « Valider ». Only the
 *  choices allowed from its state are shown. Mounted only while open: nothing chosen at first. */
import { useState } from "react";
import { PackageCheck, PackageX, Trash2, Undo2, type LucideIcon } from "lucide-react";

import { Button } from "@/_components/atoms/Button";
import { Dialog, DialogContent } from "@/_components/atoms/Dialog";
import { ChoiceCard } from "@/_components/molecules/ChoiceCard";
import { DialogBody, DialogFooter, DialogHeader } from "@/_components/molecules/DialogShell";
import type { Damage, DamageStatus } from "@/types/damaged";
import { useT } from "@/i18n/I18nProvider";
import { formatNumStr } from "@/utils/format";

import { NEXT } from "../hooks";

const CHOICE: Partial<Record<DamageStatus, { icon: LucideIcon; title: string; hint: string }>> = {
  returned: { icon: PackageCheck, title: "damaged.choiceReturned", hint: "damaged.choiceReturnedHint" },
  destroyed: { icon: Trash2, title: "damaged.choiceDestroyed", hint: "damaged.choiceDestroyedHint" },
  back_on_sale: { icon: Undo2, title: "damaged.choiceBackOnSale", hint: "damaged.choiceBackOnSaleHint" },
};

interface Props {
  damage: Damage;
  onSave: (id: number, status: DamageStatus) => Promise<void>;
  isSaving: boolean;
  onClose: () => void;
}

function StateForm({ damage, onSave, isSaving, onClose }: Props) {
  const t = useT();
  const [chosen, setChosen] = useState<DamageStatus | null>(null);
  const save = async () => {
    if (!chosen) return;
    await onSave(damage.id, chosen);
    onClose();
  };
  return (
    <DialogContent className="max-w-lg">
      <DialogHeader
        icon={<PackageX className="size-4" />}
        title={t("damaged.stateTitle")}
        subtitle={
          <span className="block truncate">
            {damage.product} · {t("damaged.boxesN", { n: formatNumStr(damage.quantity) })}
          </span>
        }
        onClose={onClose}
      />
      <DialogBody>
        <div role="radiogroup" aria-label={t("damaged.stateTitle")} className="flex flex-col gap-3">
          {NEXT[damage.status].map((next) => {
            const { icon: Icon, title, hint } = CHOICE[next]!;
            return (
              <ChoiceCard
                key={next}
                selected={chosen === next}
                onSelect={() => setChosen(next)}
                className="flex-row items-center gap-4"
              >
                <Icon className="size-6 shrink-0 text-primary" aria-hidden />
                <span className="flex flex-col gap-0.5">
                  <span className="text-base font-semibold text-foreground">{t(title)}</span>
                  <span className="text-sm text-muted-foreground">{t(hint)}</span>
                </span>
              </ChoiceCard>
            );
          })}
        </div>
      </DialogBody>
      <DialogFooter>
        {!chosen && <span className="mr-auto text-sm text-muted-foreground">{t("damaged.chooseOne")}</span>}
        <Button variant="secondary" onClick={onClose}>
          {t("common.cancel")}
        </Button>
        <Button variant="primary" onClick={() => void save()} disabled={!chosen} isLoading={isSaving}>
          {t("damaged.confirm")}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

export function DamageStateDialog({ damage, ...props }: Omit<Props, "damage"> & { damage: Damage | null }) {
  return (
    <Dialog open={!!damage} onOpenChange={(next) => !next && props.onClose()}>
      {damage && <StateForm damage={damage} {...props} />}
    </Dialog>
  );
}
