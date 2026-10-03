/** Create + edit pharmacy basic info (Screen 4). No special states — just a
 *  form. Field set: name (required), code, city, address, phone, email. */
import { useState } from "react";
import { Building2, Info, Loader2, X } from "lucide-react";

import { useT } from "@/i18n/I18nProvider";
import { AsyncButton } from "@/_components/AsyncButton";
import { FormField, FormInput } from "@/_components/FormField";
import { Dialog, DialogContent } from "@/_components/dialog";
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
        <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
          <div className="flex items-center gap-2.5">
            <span className="flex size-9 items-center justify-center rounded-[10px] bg-primary/15 text-primary">
              <Building2 className="size-4" />
            </span>
            <div className="flex flex-wrap items-baseline gap-2">
              <h3 className="text-[17px] font-semibold text-foreground">
                {isCreate
                  ? t("adminPharm.newPharmacy")
                  : t("adminPharm.editPharmacy", { name: pharmacyName ?? values.name })}
              </h3>
              {!isCreate && values.code && (
                <span className="rounded-md border border-border bg-surface-subtle px-2 py-0.5 font-mono text-[11px] font-semibold text-muted-foreground">
                  {values.code}
                </span>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("common.close")}
            className="cursor-pointer text-muted-foreground hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </div>

        <form
          className="flex flex-col gap-3.5 p-5"
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit(values);
          }}
        >
          <FormField label={t("adminPharm.name")} required>
            <FormInput value={values.name} onChange={(v) => set("name", v)} placeholder="Pharmacie Centre" required />
          </FormField>

          <FormField label={t("adminPharm.city")} required hint={isCreate ? t("adminPharm.cityHint") : undefined}>
            <FormInput value={values.city ?? ""} onChange={(v) => set("city", v)} placeholder="Casablanca" required />
          </FormField>

          <FormField label={t("adminPharm.address")}>
            <Textarea
              value={values.address ?? ""}
              onChange={(v) => set("address", v)}
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

          {isCreate && (
            <div className="flex items-start gap-2.5 rounded-lg border border-info-border bg-info-subtle px-3 py-2.5 text-info-subtle-foreground">
              <Info className="mt-0.5 size-4 shrink-0" />
              <span className="text-[12.5px] leading-snug">{t("adminPharm.createFeaturesHint")}</span>
            </div>
          )}

          <div className="-mx-5 -mb-5 mt-1 flex items-center justify-end gap-2.5 border-t border-border bg-surface-subtle px-5 py-3.5">
            <AsyncButton type="button" variant="secondary" onClick={onClose} disabled={isSaving}>
              {t("common.cancel")}
            </AsyncButton>
            <AsyncButton type="submit" variant="primary" disabled={isSaving}>
              {isSaving && <Loader2 className="size-3.5 animate-spin" />}
              {isCreate ? t("adminPharm.createPharmacy") : t("common.save")}
            </AsyncButton>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
function Textarea({
  value,
  onChange,
  ...rest
}: { value: string; onChange: (v: string) => void } & Omit<
  React.TextareaHTMLAttributes<HTMLTextAreaElement>,
  "value" | "onChange"
>) {
  return (
    <textarea
      {...rest}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      rows={2}
      className="min-h-[60px] w-full rounded-md border border-input bg-surface-subtle px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2"
    />
  );
}
