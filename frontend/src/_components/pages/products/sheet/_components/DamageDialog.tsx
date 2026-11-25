/** « Déclarer des boîtes abîmées » (product sheet): how many boxes, why (« carton écrasé à la livraison »), a note,
 *  both optional. They leave PharmaGest's free stock until « Remis en vente » (page « Stock abîmé »). Mounted only while
 *  open, so the form starts empty each time. */
import { useState } from "react";
import { PackageX } from "lucide-react";

import { Button } from "@/_components/atoms/Button";
import { Dialog, DialogContent } from "@/_components/atoms/Dialog";
import { Input, Textarea } from "@/_components/atoms/Input";
import { DialogBody, DialogFooter, DialogHeader } from "@/_components/molecules/DialogShell";
import { FormField } from "@/_components/molecules/FormField";
import { QuantityField } from "@/_components/molecules/QuantityField";
import type { DamageInput } from "@/types/damaged";
import { useT } from "@/i18n/I18nProvider";

interface Props {
  product: string;
  medicamentId: number;
  onSave: (body: DamageInput) => Promise<unknown>;
  isSaving: boolean;
  onClose: () => void;
}

function DamageForm({ product, medicamentId, onSave, isSaving, onClose }: Props) {
  const t = useT();
  const [quantity, setQuantity] = useState("1");
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const qty = Number(quantity);
  const qtyOk = Number.isInteger(qty) && qty >= 1;
  const save = async () => {
    await onSave({
      medicament_id: medicamentId,
      quantity: qty,
      reason: reason.trim() || null,
      note: note.trim() || null,
    });
    onClose();
  };
  return (
    <DialogContent className="max-w-lg">
      <DialogHeader
        icon={<PackageX className="size-4" />}
        title={t("damaged.declareTitle")}
        subtitle={<span className="block truncate">{product}</span>}
        onClose={onClose}
      />
      <DialogBody className="flex flex-col gap-4">
        <QuantityField
          label={t("damaged.quantity")}
          value={quantity}
          onChange={setQuantity}
          min={1}
          autoFocus
          error={quantity !== "" && !qtyOk ? t("damaged.quantityError") : undefined}
          decreaseLabel={t("damaged.less")}
          increaseLabel={t("damaged.more")}
        />
        <FormField label={t("damaged.reason")}>
          <Input
            maxLength={300}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={t("damaged.reasonPlaceholder")}
          />
        </FormField>
        <FormField label={t("damaged.note")}>
          <Textarea rows={2} maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} />
        </FormField>
        <p className="text-sm text-muted-foreground">{t("damaged.declareHint")}</p>
      </DialogBody>
      <DialogFooter>
        {!qtyOk && <span className="mr-auto text-sm text-muted-foreground">{t("damaged.needQuantity")}</span>}
        <Button variant="secondary" onClick={onClose}>
          {t("common.cancel")}
        </Button>
        <Button variant="primary" onClick={() => void save()} disabled={!qtyOk} isLoading={isSaving}>
          {t("damaged.declare")}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

export function DamageDialog({ open, ...props }: Props & { open: boolean }) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && props.onClose()}>
      {open && <DamageForm {...props} />}
    </Dialog>
  );
}
