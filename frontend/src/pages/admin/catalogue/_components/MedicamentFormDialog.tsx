/** Create + Edit form for a Medicament. Submits via the hook's create/update mutations. */
import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";

import { AsyncButton } from "@/components/shared/AsyncButton";
import { TextField } from "@/components/shared/TextField";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { cn } from "@/utils/cn";
import type { Medicament, MedicamentInput, ProductType } from "@/types";


export interface MedicamentFormDialogProps {
  open:        boolean;
  onClose:     () => void;
  initial:     Medicament | null;     // null → create mode; non-null → edit mode
  onSubmit:    (body: MedicamentInput) => void;
  isLoading:   boolean;
}


function blank(): MedicamentInput {
  return {
    product: "", tva: null, pph: null, ppv: null, category: null,
    barcode1: null, barcode2: null, laboratoire: null, product_type: null,
  };
}


function fromMedicament(m: Medicament): MedicamentInput {
  return {
    product: m.product, tva: m.tva, pph: m.pph, ppv: m.ppv, category: m.category,
    barcode1: m.barcode1, barcode2: m.barcode2, laboratoire: m.laboratoire,
    product_type: m.product_type,
  };
}


/** Category looks like "Médicament" — accent-insensitive, ignores the "(xx%)"
 *  margin suffix Sobrus concatenates. Mirrors the backend keyword match. */
function looksLikeMedicament(category: string | null | undefined): boolean {
  return !!category && /[ée]dicament/i.test(category);
}

/** First number in a TVA label: "TVA (20.00%)" → 20, "Exonéré (0.00%)" → 0. */
function tvaPercent(tva: string | null | undefined): number {
  const m = tva ? String(tva).match(/[\d.]+/) : null;
  return m ? parseFloat(m[0]) : 0;
}


export function MedicamentFormDialog({
  open, onClose, initial, onSubmit, isLoading,
}: MedicamentFormDialogProps) {
  const [form, setForm] = useState<MedicamentInput>(blank());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setForm(initial ? fromMedicament(initial) : blank());
    setError(null);
  }, [initial, open]);

  const setField = <K extends keyof MedicamentInput>(k: K, v: MedicamentInput[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  // A "Médicament" should be exonéré (0 % TVA). Warn when it isn't.
  const tvaWarning = looksLikeMedicament(form.category) && tvaPercent(form.tva) !== 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.product?.trim()) {
      setError("Le nom du produit est requis");
      return;
    }
    if (
      tvaWarning &&
      !window.confirm(
        `Les médicaments sont normalement exonérés de TVA (0 %).\n` +
        `Cette catégorie « Médicament » a une TVA de ${tvaPercent(form.tva)} %.\n\n` +
        `S'il s'agit d'un complément/cosmétique, changez plutôt la catégorie.\nEnregistrer quand même ?`,
      )
    ) {
      return;
    }
    onSubmit(form);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !isLoading && onClose()}>
      <DialogContent className="max-w-2xl">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 p-5">
          <header>
            <h2 className="text-base font-semibold tracking-tight text-foreground">
              {initial ? "Modifier le médicament" : "Ajouter un médicament"}
            </h2>
            {initial && (
              <p className="mt-0.5 font-mono text-xs text-muted-foreground">PID : {initial.pid}</p>
            )}
          </header>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <TextField
                label="Nom du produit *"
                value={form.product ?? ""}
                onChange={(e) => setField("product", e.target.value)}
                placeholder="DOLIPRANE 1000MG B10"
                error={error ?? undefined}
                autoFocus
              />
            </div>
            <TextField
              label="Catégorie"
              value={form.category ?? ""}
              onChange={(e) => setField("category", e.target.value || null)}
              placeholder="Medicament (20.000%)"
            />
            <TextField
              label="Laboratoire"
              value={form.laboratoire ?? ""}
              onChange={(e) => setField("laboratoire", e.target.value || null)}
              placeholder="Sanofi"
            />
            <TextField
              label="TVA"
              value={form.tva ?? ""}
              onChange={(e) => setField("tva", e.target.value || null)}
              placeholder="TVA (20.00%)"
            />
            <div className="grid grid-cols-2 gap-3">
              <TextField
                label="PPH"
                type="number"
                step="0.01"
                value={form.pph ?? ""}
                onChange={(e) => setField("pph", e.target.value === "" ? null : Number(e.target.value))}
              />
              <TextField
                label="PPV"
                type="number"
                step="0.01"
                value={form.ppv ?? ""}
                onChange={(e) => setField("ppv", e.target.value === "" ? null : Number(e.target.value))}
              />
            </div>
            <TextField
              label="Code-barres 1"
              value={form.barcode1 ?? ""}
              onChange={(e) => setField("barcode1", e.target.value || null)}
              placeholder="6111258659606"
            />
            <TextField
              label="Code-barres 2"
              value={form.barcode2 ?? ""}
              onChange={(e) => setField("barcode2", e.target.value || null)}
            />

            <div className="sm:col-span-2 space-y-1.5">
              <label className="block text-sm font-medium text-foreground">Type (override admin)</label>
              <div className="flex gap-2">
                {(["pharmacie", "parapharmacie"] as ProductType[]).map((t) => (
                  <button
                    type="button"
                    key={t}
                    onClick={() => setField("product_type", form.product_type === t ? null : t)}
                    className={cn(
                      "inline-flex h-9 cursor-pointer items-center rounded-md border px-3 text-xs font-semibold transition-colors",
                      form.product_type === t
                        ? t === "pharmacie"
                          ? "bg-pharmacie-bg text-pharmacie-fg border-pharmacie-border"
                          : "bg-parapharmacie-bg text-parapharmacie-fg border-parapharmacie-border"
                        : "border-input bg-surface-subtle text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {t === "pharmacie" ? "Pharmacie" : "Parapharmacie"}
                  </button>
                ))}
                <span className="self-center text-xs text-muted-foreground">
                  (laisser vide pour auto-détecter depuis la catégorie)
                </span>
              </div>
            </div>
          </div>

          {tvaWarning && (
            <div className="flex items-start gap-2 rounded-md border border-warning-border bg-warning-subtle px-3 py-2 text-xs text-warning-subtle-foreground">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
              <span>
                Catégorie « Médicament » avec une TVA de <b>{tvaPercent(form.tva)} %</b>. Les médicaments sont
                normalement <b>exonérés (0 %)</b>. S'il s'agit d'un complément / cosmétique, changez plutôt la catégorie.
              </span>
            </div>
          )}

          <footer className="mt-2 flex justify-end gap-2 border-t border-border pt-3">
            <AsyncButton variant="ghost" type="button" onClick={onClose} disabled={isLoading}>
              Annuler
            </AsyncButton>
            <AsyncButton
              type="submit"
              variant="primary"
              isLoading={isLoading}
              loadingText={initial ? "Modification…" : "Ajout…"}
            >
              {initial ? "Enregistrer" : "Ajouter"}
            </AsyncButton>
          </footer>
        </form>
      </DialogContent>
    </Dialog>
  );
}
