/** « Mettre en promo »: the promo price of one product (its normal price shown), or « Retirer la promo ». */
import { useState } from "react";
import { Percent } from "lucide-react";

import { Button } from "@/_components/atoms/Button";
import { Dialog, DialogContent } from "@/_components/atoms/Dialog";
import { DialogBody, DialogFooter, DialogHeader } from "@/_components/molecules/DialogShell";
import { FormField, FormInput } from "@/_components/molecules/FormField";
import { useT } from "@/i18n/I18nProvider";
import type { OwnerProduct } from "@/types/storeWebsite";
import { formatMADStr } from "@/utils/format";

export function PromoDialog({
  product,
  onClose,
  onSave,
}: {
  product: OwnerProduct;
  onClose: () => void;
  onSave: (promo: number | null) => Promise<unknown>;
}) {
  const t = useT();
  const [value, setValue] = useState(product.promo_price != null ? String(product.promo_price) : "");
  const [saving, setSaving] = useState(false);
  const price = Number(value.replace(",", "."));
  const tooHigh = product.ppv != null && price >= product.ppv;
  const valid = value.trim() !== "" && price > 0 && !tooHigh;

  const save = async (promo: number | null) => {
    setSaving(true);
    try {
      await onSave(promo);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader
          icon={<Percent className="size-4" />}
          title={t("myStore.promoTitle")}
          subtitle={product.name}
          onClose={onClose}
        />
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (valid) void save(price);
          }}
        >
          <DialogBody>
            <FormField
              label={t("myStore.promoPrice")}
              hint={product.ppv != null ? t("myStore.normalPrice", { price: formatMADStr(product.ppv) }) : undefined}
            >
              <FormInput value={value} onChange={setValue} inputMode="decimal" placeholder="149" autoFocus />
              {tooHigh && <span className="text-xs text-error">{t("myStore.promoTooHigh")}</span>}
            </FormField>
          </DialogBody>
          <DialogFooter className="justify-between">
            {product.promo_price != null ? (
              <Button type="button" variant="danger-outline" disabled={saving} onClick={() => void save(null)}>
                {t("myStore.promoRemove")}
              </Button>
            ) : (
              <span />
            )}
            <Button type="submit" disabled={!valid} isLoading={saving}>
              {t("common.save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
