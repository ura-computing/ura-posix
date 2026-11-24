/** Support's « Modifier la demande »: the store's name, slogan, WhatsApp number, domain (the logo: in the editor). */
import { useState } from "react";
import { Pencil } from "lucide-react";

import { Button } from "@/_components/atoms/Button";
import { Dialog, DialogContent } from "@/_components/atoms/Dialog";
import { DialogBody, DialogFooter, DialogHeader } from "@/_components/molecules/DialogShell";
import { PhoneField } from "@/_components/molecules/PhoneField";
import { TextField } from "@/_components/molecules/TextField";
import { useT } from "@/i18n/I18nProvider";
import type { WebsiteRequestOut, WebsiteRequestPatch } from "@/types/storeWebsite";

export function BriefDialog({
  request,
  isSaving,
  onClose,
  onSave,
}: {
  request: WebsiteRequestOut;
  isSaving: boolean;
  onClose: () => void;
  onSave: (body: WebsiteRequestPatch) => Promise<unknown>;
}) {
  const t = useT();
  const [storeName, setStoreName] = useState(request.store_name);
  const [slogan, setSlogan] = useState(request.slogan ?? "");
  const [phone, setPhone] = useState(request.phone);
  const [domain, setDomain] = useState(request.custom_domain ?? "");
  const valid = storeName.trim() !== "" && phone.replace(/\D/g, "").length >= 9;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg gap-0 overflow-hidden p-0">
        <DialogHeader
          icon={<Pencil className="size-4" />}
          title={t("store.editBrief")}
          subtitle={request.pharmacy_name}
          onClose={onClose}
        />
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!valid) return;
            void onSave({
              store_name: storeName.trim(),
              slogan: slogan.trim() || null,
              phone,
              custom_domain: domain.trim() || null,
            }).then(onClose);
          }}
        >
          <DialogBody>
            <TextField
              label={t("myStore.storeName")}
              value={storeName}
              onChange={(e) => setStoreName(e.target.value)}
              maxLength={120}
              autoFocus
            />
            <TextField
              label={t("myStore.slogan")}
              hint={t("common.optional")}
              value={slogan}
              onChange={(e) => setSlogan(e.target.value)}
              maxLength={280}
            />
            <PhoneField label={t("myStore.whatsapp")} value={phone} onChange={setPhone} />
            <TextField
              label={t("store.siteDomain")}
              hint={t("store.domainLiveHint")}
              placeholder="pharmacie-exemple.ma"
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              maxLength={255}
            />
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={onClose}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={!valid} isLoading={isSaving}>
              {t("common.save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
