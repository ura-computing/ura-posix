/** Create + edit pharmacy basic info (Screen 4). No special states — just a
 *  form. Field set: name (required), code, city, address, phone, email. */
import { useState } from "react";
import { Building2 } from "lucide-react";

import { useT } from "@/i18n/I18nProvider";
import { Badge } from "@/_components/atoms/Badge";
import { Button } from "@/_components/atoms/Button";
import { Textarea } from "@/_components/atoms/Input";
import { FormField, FormInput } from "@/_components/molecules/FormField";
import { Dialog, DialogContent } from "@/_components/atoms/Dialog";
import { Callout } from "@/_components/molecules/Callout";
import { DialogFooter, DialogHeader } from "@/_components/molecules/DialogShell";
import type { PharmacyIn } from "@/types";

const EMPTY: PharmacyIn = {
  name: "",
  code: "",
  city: "",
  address: "",
  phone: "",
  email: "",
};

export interface PharmacyFormDialogProps {
  open: boolean;
  onClose: () => void;
  /** Pass an existing pharmacy's values to edit; omit to create. */
  initialValues?: PharmacyIn;
  /** Display name for the edit-mode title. */
  pharmacyName?: string;
  isSaving?: boolean;
  onSubmit: (values: PharmacyIn) => void;
}

/** Mounted only while open: the fields start from `initialValues` on every open. */
export function PharmacyFormDialog(props: PharmacyFormDialogProps) {
  return props.open ? <PharmacyFormBody {...props} /> : null;
}

function PharmacyFormBody({ open, onClose, initialValues, pharmacyName, isSaving, onSubmit }: PharmacyFormDialogProps) {
  const t = useT();
  const isCreate = !initialValues;
  const [values, setValues] = useState<PharmacyIn>(initialValues ?? EMPTY);

  const set = <K extends keyof PharmacyIn>(key: K, v: PharmacyIn[K]) => setValues((prev) => ({ ...prev, [key]: v }));

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
    >
      <DialogContent className="max-w-lg gap-0 overflow-hidden p-0">
        <DialogHeader
          icon={<Building2 className="size-4" />}
          title={
            isCreate ? t("adminPharm.newPharmacy") : t("adminPharm.editPharmacy", { name: pharmacyName ?? values.name })
          }
          onClose={onClose}
        >
          {!isCreate && values.code && <Badge className="w-fit font-mono">{values.code}</Badge>}
        </DialogHeader>

        <form
          className="flex flex-col"
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit(values);
          }}
        >
          <div className="flex flex-col gap-3.5 p-5">
            <FormField label={t("adminPharm.name")} required>
              <FormInput value={values.name} onChange={(v) => set("name", v)} placeholder="Pharmacie Centre" required />
            </FormField>

            <FormField label={t("adminPharm.city")} required hint={isCreate ? t("adminPharm.cityHint") : undefined}>
              <FormInput value={values.city ?? ""} onChange={(v) => set("city", v)} placeholder="Casablanca" required />
            </FormField>

            <FormField label={t("adminPharm.address")}>
              <Textarea
                rows={2}
                value={values.address ?? ""}
                onChange={(e) => set("address", e.target.value)}
                placeholder="24 Bd Mohammed V…"
              />
            </FormField>

            <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
              <FormField label={t("adminPharm.phone")}>
                <FormInput
                  value={values.phone ?? ""}
                  onChange={(v) => set("phone", v)}
                  placeholder="+212 522 00 00 00"
                  className="font-mono"
                />
              </FormField>
              <FormField label={t("adminPharm.email")}>
                <FormInput
                  type="email"
                  value={values.email ?? ""}
                  onChange={(v) => set("email", v)}
                  placeholder="contact@pharmacie.ma"
                />
              </FormField>
            </div>

            {isCreate && <Callout tone="info">{t("adminPharm.createFeaturesHint")}</Callout>}
          </div>

          <DialogFooter>
            <Button type="button" variant="secondary" onClick={onClose} disabled={isSaving}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" variant="primary" isLoading={isSaving} loadingText={t("common.saving")}>
              {isCreate ? t("adminPharm.createPharmacy") : t("common.save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
