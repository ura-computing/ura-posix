/** The pop-up of one step of a promis: its question as the title, one line saying what happens, then what the step
 *  needs: a place (« Rendre prêt »), a note (« Marquer commandé »), a reason as big first-person choices (« Signaler
 *  un problème », « Annuler le promis »); « Annuler » + « Valider ». « Rendre prêt » warns in orange when the free
 *  stock looks too low (still allowed: Sobrus stock arrives at night). Mounted only while open: empty at first. */
import { useState } from "react";
import { PackageCheck } from "lucide-react";

import { Button } from "@/_components/atoms/Button";
import { Dialog, DialogContent } from "@/_components/atoms/Dialog";
import { Callout } from "@/_components/molecules/Callout";
import { ChoiceCard } from "@/_components/molecules/ChoiceCard";
import { DialogBody, DialogFooter, DialogHeader } from "@/_components/molecules/DialogShell";
import { FormField, FormInput } from "@/_components/molecules/FormField";
import { useT } from "@/i18n/I18nProvider";
import type { PromisMove, PromisSheet, PromisState } from "@/types/promis";
import { formatDate, formatNumStr } from "@/utils/format";

import { ICON } from "../../constants";

/** The reasons offered (the last one: typed). */
const WHY: Partial<Record<PromisState, string[]>> = {
  incident: ["promis.why_damaged", "promis.why_wrongProduct", "promis.why_other"],
  cancelled: ["promis.why_noLonger", "promis.why_mistake", "promis.why_other"],
};
const PICKUP_DAYS = 7;

/** Today + 7 days on this computer's calendar, « 2026-12-02 ». */
function pickupDate(): string {
  const d = new Date();
  d.setDate(d.getDate() + PICKUP_DAYS);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

interface Props {
  target: PromisState;
  sheet: PromisSheet;
  onSave: (move: PromisMove) => Promise<void>;
  isSaving: boolean;
  onClose: () => void;
}

function StepForm({ target, sheet, onSave, isSaving, onClose }: Props) {
  const t = useT();
  const [why, setWhy] = useState<string | null>(null);
  const [text, setText] = useState("");
  const Icon = ICON[target] ?? PackageCheck;
  const reasons = WHY[target];
  const typedReason = why === "promis.why_other";
  const short =
    target === "ready" ? sheet.lines.filter((l) => l.medicament_id !== null && (l.free_stock ?? 0) < l.quantity) : [];

  const missing =
    reasons && !why
      ? "promis.chooseOne"
      : typedReason && !text.trim()
        ? "promis.writeReason"
        : target === "ready" && !text.trim()
          ? "promis.ask_readyNeed"
          : null;

  const save = async () => {
    if (missing) return;
    const reason = reasons ? (typedReason ? text.trim() : t(why!)) : target === "ordered" ? text.trim() || null : null;
    await onSave({ state: target, reason, shelf_place: target === "ready" ? text.trim() : null });
    onClose();
  };

  const field = (label: string, placeholder?: string) => (
    <FormField label={label}>
      <FormInput value={text} onChange={setText} placeholder={placeholder} maxLength={100} autoFocus />
    </FormField>
  );

  return (
    <DialogContent className="max-w-lg">
      <DialogHeader
        icon={<Icon className="size-4" />}
        title={t(`promis.ask_${target}`)}
        subtitle={
          <span className="block truncate">
            {t("promis.titleN", { n: sheet.number })} · {sheet.customer.name}
          </span>
        }
        onClose={onClose}
      />
      <DialogBody>
        <p className="text-sm text-foreground">
          {t(`promis.ask_${target}Hint`, target === "ready" ? { date: formatDate(pickupDate()) } : undefined)}
        </p>
        {short.map((l) => (
          <Callout key={l.id} tone="warning">
            {t("promis.ask_readyShort", {
              product: l.name,
              free: formatNumStr(l.free_stock ?? 0),
              qty: formatNumStr(l.quantity),
            })}
          </Callout>
        ))}
        {reasons && (
          <div role="radiogroup" aria-label={t(`promis.ask_${target}`)} className="flex flex-col gap-3">
            {reasons.map((key) => (
              <ChoiceCard key={key} selected={why === key} onSelect={() => setWhy(key)} className="p-4">
                <span className="text-base font-semibold text-foreground">{t(key)}</span>
              </ChoiceCard>
            ))}
          </div>
        )}
        {typedReason && field(t("promis.why_otherField"))}
        {target === "ordered" && field(t("promis.ask_orderedField"), t("promis.ask_orderedPlaceholder"))}
        {target === "ready" && field(t("promis.ask_readyField"), t("promis.ask_readyPlaceholder"))}
      </DialogBody>
      <DialogFooter>
        {missing && <span className="mr-auto text-sm text-muted-foreground">{t(missing)}</span>}
        <Button variant="secondary" onClick={onClose}>
          {t("common.cancel")}
        </Button>
        <Button
          variant={target === "cancelled" ? "danger" : "primary"}
          onClick={() => void save()}
          disabled={!!missing}
          isLoading={isSaving}
        >
          {t("promis.confirm")}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

export function StepDialog({ target, ...props }: Omit<Props, "target"> & { target: PromisState | null }) {
  return (
    <Dialog open={!!target} onOpenChange={(next) => !next && props.onClose()}>
      {target && <StepForm key={target} target={target} {...props} />}
    </Dialog>
  );
}
