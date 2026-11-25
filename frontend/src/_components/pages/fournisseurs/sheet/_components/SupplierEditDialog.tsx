/** « Modifier » one block of a supplier: « Contact », « Commande et livraison », « Paiement et transport », « Note ».
 *  Big choices for the type, the ordering channel and the delivery days; « − » / « + » for the lead time. Empty =
 *  « inconnu ». Mounted only while open: starts from the sheet. */
import { useState } from "react";
import { Pencil } from "lucide-react";

import { Button } from "@/_components/atoms/Button";
import { Dialog, DialogContent } from "@/_components/atoms/Dialog";
import { Textarea } from "@/_components/atoms/Input";
import { DialogBody, DialogFooter, DialogHeader } from "@/_components/molecules/DialogShell";
import { FormField, FormInput } from "@/_components/molecules/FormField";
import { QuantityField } from "@/_components/molecules/QuantityField";
import { ToggleChip } from "@/_components/molecules/ToggleChip";
import { useT } from "@/i18n/I18nProvider";
import {
  WEEK,
  type OrderChannel,
  type SupplierEdit,
  type SupplierKind,
  type SupplierSheet,
  type Weekday,
} from "@/types/suppliers";

export type SupplierBlock = "contact" | "order" | "money" | "note";

const KINDS: SupplierKind[] = ["laboratoire", "grossiste", "societe"];
const CHANNELS: OrderChannel[] = ["phone", "whatsapp", "email", "fax", "edi", "delegate"];

/** « 1 500,50 » → 1500.5; « » → null; not a number → NaN (refused). */
const money = (v: string) => (v.trim() ? Number(v.replace(/\s/g, "").replace(",", ".")) : null);
const moneyText = (n: number | null) => (n == null ? "" : String(n).replace(".", ","));

interface Props {
  block: SupplierBlock;
  supplier: SupplierSheet;
  onSave: (body: SupplierEdit) => Promise<void>;
  isSaving: boolean;
  onClose: () => void;
}

function EditForm({ block, supplier, onSave, isSaving, onClose }: Props) {
  const t = useT();
  const [v, setV] = useState({
    name: supplier.name,
    kind: supplier.kind,
    contact_name: supplier.contact_name ?? "",
    phone: supplier.phone ?? "",
    email: supplier.email ?? "",
    city: supplier.city ?? "",
    address: supplier.address ?? "",
    order_channel: supplier.order_channel,
    delivery_days: supplier.delivery_days ?? [],
    cutoff_time: supplier.cutoff_time ?? "",
    lead_time_days: supplier.lead_time_days == null ? "" : String(supplier.lead_time_days),
    payment_terms: supplier.payment_terms ?? "",
    transport_fee: moneyText(supplier.transport_fee),
    free_transport_from: moneyText(supplier.free_transport_from),
    note: supplier.note ?? "",
  });
  const set = <K extends keyof typeof v>(key: K, value: (typeof v)[K]) => setV((p) => ({ ...p, [key]: value }));
  const toggleDay = (d: Weekday) =>
    set(
      "delivery_days",
      v.delivery_days.includes(d) ? v.delivery_days.filter((x) => x !== d) : [...v.delivery_days, d],
    );

  const bad = [money(v.transport_fee), money(v.free_transport_from)].some((n) => n != null && Number.isNaN(n));
  const missing = block === "contact" && !v.name.trim() ? "suppliers.needName" : bad ? "suppliers.badMoney" : null;

  const body = (): SupplierEdit => {
    const text = (s: string) => s.trim() || null;
    if (block === "contact")
      return {
        name: v.name.trim(),
        kind: v.kind,
        contact_name: text(v.contact_name),
        phone: text(v.phone),
        email: text(v.email),
        city: text(v.city),
        address: text(v.address),
      };
    if (block === "order")
      return {
        order_channel: v.order_channel,
        delivery_days: v.delivery_days.length ? v.delivery_days : null,
        cutoff_time: text(v.cutoff_time),
        lead_time_days: v.lead_time_days === "" ? null : Number(v.lead_time_days),
      };
    if (block === "money")
      return {
        payment_terms: text(v.payment_terms),
        transport_fee: money(v.transport_fee),
        free_transport_from: money(v.free_transport_from),
      };
    return { note: text(v.note) };
  };
  const save = async () => {
    if (missing) return;
    await onSave(body());
    onClose();
  };
  const chips = (label: string, children: React.ReactNode) => (
    <FormField label={label} group>
      <div className="flex flex-wrap gap-2">{children}</div>
    </FormField>
  );

  return (
    <DialogContent className="max-w-lg">
      <DialogHeader
        icon={<Pencil className="size-4" />}
        title={t(`suppliers.block_${block}`)}
        subtitle={supplier.name}
        onClose={onClose}
      />
      <DialogBody>
        {block === "contact" && (
          <>
            <FormField label={t("suppliers.colName")} required>
              <FormInput value={v.name} onChange={(x) => set("name", x)} maxLength={200} autoFocus />
            </FormField>
            {chips(
              t("suppliers.colKind"),
              KINDS.map((k) => (
                <ToggleChip key={k} pressed={v.kind === k} onToggle={() => set("kind", v.kind === k ? null : k)}>
                  {t(`suppliers.kind.${k}`)}
                </ToggleChip>
              )),
            )}
            <FormField label={t("suppliers.contactName")}>
              <FormInput value={v.contact_name} onChange={(x) => set("contact_name", x)} maxLength={120} />
            </FormField>
            <FormField label={t("suppliers.colPhone")}>
              <FormInput value={v.phone} onChange={(x) => set("phone", x)} inputMode="tel" maxLength={40} />
            </FormField>
            <FormField label={t("suppliers.colEmail")}>
              <FormInput value={v.email} onChange={(x) => set("email", x)} inputMode="email" maxLength={200} />
            </FormField>
            <FormField label={t("suppliers.colCity")}>
              <FormInput value={v.city} onChange={(x) => set("city", x)} maxLength={100} />
            </FormField>
            <FormField label={t("suppliers.colAddress")}>
              <FormInput value={v.address} onChange={(x) => set("address", x)} maxLength={300} />
            </FormField>
          </>
        )}
        {block === "order" && (
          <>
            {chips(
              t("suppliers.channel"),
              CHANNELS.map((c) => (
                <ToggleChip
                  key={c}
                  pressed={v.order_channel === c}
                  onToggle={() => set("order_channel", v.order_channel === c ? null : c)}
                >
                  {t(`suppliers.channel_${c}`)}
                </ToggleChip>
              )),
            )}
            {chips(
              t("suppliers.deliveryDays"),
              WEEK.map((d) => (
                <ToggleChip key={d} pressed={v.delivery_days.includes(d)} onToggle={() => toggleDay(d)}>
                  {t(`suppliers.day_${d}`)}
                </ToggleChip>
              )),
            )}
            <FormField label={t("suppliers.cutoff")} hint={t("suppliers.cutoffHint")}>
              <FormInput
                value={v.cutoff_time}
                onChange={(x) => set("cutoff_time", x)}
                placeholder="11:00"
                maxLength={5}
                className="w-28"
              />
            </FormField>
            <QuantityField
              label={t("suppliers.leadTime")}
              value={v.lead_time_days}
              onChange={(x) => set("lead_time_days", x)}
              min={0}
              max={90}
              decreaseLabel={t("suppliers.dayLess")}
              increaseLabel={t("suppliers.dayMore")}
            />
          </>
        )}
        {block === "money" && (
          <>
            <FormField label={t("suppliers.payment")}>
              <FormInput
                value={v.payment_terms}
                onChange={(x) => set("payment_terms", x)}
                placeholder={t("suppliers.paymentPlaceholder")}
                maxLength={200}
              />
            </FormField>
            <FormField label={t("suppliers.transportFee")}>
              <FormInput
                value={v.transport_fee}
                onChange={(x) => set("transport_fee", x)}
                inputMode="decimal"
                className="w-40 text-right font-mono"
              />
            </FormField>
            <FormField label={t("suppliers.freeFrom")} hint={t("suppliers.freeFromHint")}>
              <FormInput
                value={v.free_transport_from}
                onChange={(x) => set("free_transport_from", x)}
                inputMode="decimal"
                className="w-40 text-right font-mono"
              />
            </FormField>
          </>
        )}
        {block === "note" && (
          <FormField label={t("suppliers.note")}>
            <Textarea rows={4} maxLength={2000} value={v.note} onChange={(e) => set("note", e.target.value)} />
          </FormField>
        )}
      </DialogBody>
      <DialogFooter>
        {missing && <span className="mr-auto text-sm text-muted-foreground">{t(missing)}</span>}
        <Button variant="secondary" onClick={onClose}>
          {t("common.cancel")}
        </Button>
        <Button onClick={() => void save()} disabled={!!missing} isLoading={isSaving}>
          {t("common.save")}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

export function SupplierEditDialog({ block, ...props }: Omit<Props, "block"> & { block: SupplierBlock | null }) {
  return (
    <Dialog open={!!block} onOpenChange={(next) => !next && props.onClose()}>
      {block && <EditForm key={block} block={block} {...props} />}
    </Dialog>
  );
}
