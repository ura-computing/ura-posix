import { useEffect, useState } from "react";
import { Trash2, X } from "lucide-react";

import { Dialog, DialogContent } from "@/components/ui/dialog";
import { AsyncButton } from "@/components/shared/AsyncButton";
import { MonthPopover } from "@/components/shared/MonthPopover";
import { useDeletePayment, useSavePayment } from "@/hooks/useAccounting";
import type { PaymentEntry, PaymentMethod } from "@/types";


/**
 * Edit one (month, method) entry. The dialog is "smart":
 *  - If `entry` is null → create mode (Save calls POST upsert)
 *  - If `entry` is set  → edit mode (Save calls POST upsert too — backend
 *    upserts on (pharmacy_id, month, method)). Also surfaces Delete.
 *
 * Month picker uses the native <input type="month"> for simplicity — gives a
 * YYYY-MM string directly which is what the backend wants.
 */

const METHOD_LABEL: Record<PaymentMethod, string> = {
  tpe:      "TPE",
  especes:  "Espèces",
  cheques:  "Chèques",
  virement: "Virement et autres",
};


export interface PaymentEditDialogProps {
  open:    boolean;
  onClose: () => void;
  method:  PaymentMethod | null;     // null when closed
  month:   string;                    // YYYY-MM
  entry:   PaymentEntry | null;       // existing row, if any
}

export function PaymentEditDialog({ open, onClose, method, month, entry }: PaymentEditDialogProps) {
  const save = useSavePayment();
  const del  = useDeletePayment();

  // Form state — initialized from `entry` when the dialog opens. Reset on
  // method/month/open change so reopening on a different card shows the
  // right starting values.
  const [pharm,  setPharm]  = useState("0");
  const [para,   setPara]   = useState("0");
  const [cnt,    setCnt]    = useState("0");
  const [monthV, setMonthV] = useState(month);

  useEffect(() => {
    if (!open) return;
    setPharm(String(entry?.pharmacie_amount ?? 0));
    setPara(String(entry?.parapharmacie_amount ?? 0));
    setCnt(String(entry?.count ?? 0));
    setMonthV(month);
  }, [open, entry, month]);

  if (!method) return null;

  const handleSave = async () => {
    await save.mutateAsync({
      month:                monthV,
      method,
      pharmacie_amount:     Number(pharm) || 0,
      parapharmacie_amount: Number(para)  || 0,
      count:                Number(cnt)   || 0,
    });
    onClose();
  };

  const handleDelete = async () => {
    if (!entry) return;
    await del.mutateAsync(entry.id);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-md">
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <h2 className="text-sm font-semibold text-foreground">
            {METHOD_LABEL[method]} — {monthV}
          </h2>
          <button type="button" onClick={onClose} aria-label="Fermer" className="cursor-pointer text-muted-foreground hover:text-foreground">
            <X className="size-4" />
          </button>
        </div>

        <div className="flex flex-col gap-4 px-5 py-4">
          <Field label="Mois">
            <MonthPopover label="" value={monthV} onChange={setMonthV} />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Pharmacie (MAD)">
              <NumberInput value={pharm} onChange={setPharm} />
            </Field>
            <Field label="Parapharmacie (MAD)">
              <NumberInput value={para} onChange={setPara} />
            </Field>
          </div>

          <Field label="Nombre de transactions">
            <NumberInput value={cnt} onChange={setCnt} integer />
          </Field>
        </div>

        <div className="flex items-center justify-between border-t border-border px-5 py-3">
          {entry ? (
            <AsyncButton
              variant="ghost"
              onClick={handleDelete}
              isLoading={del.isPending}
              className="!text-destructive hover:!bg-destructive/5"
            >
              <Trash2 className="size-4" />
              Supprimer
            </AsyncButton>
          ) : <span />}
          <AsyncButton variant="primary" onClick={handleSave} isLoading={save.isPending}>
            Enregistrer
          </AsyncButton>
        </div>
      </DialogContent>
    </Dialog>
  );
}


function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}


function NumberInput({ value, onChange, integer }: { value: string; onChange: (v: string) => void; integer?: boolean }) {
  return (
    <input
      type="number"
      inputMode={integer ? "numeric" : "decimal"}
      step={integer ? "1" : "0.01"}
      min="0"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-9 w-full rounded-md border border-input bg-surface-subtle px-3 text-sm font-mono tabular-nums focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2"
    />
  );
}
