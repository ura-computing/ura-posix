/** Create / edit dialog for a CategorySuffix. Mirrors the handoff design via
 *  our shared primitives (Dialog, AsyncButton, SuffixBadge). The category is
 *  normalized on submit (strips accents + collapses whitespace) so the same
 *  string the Ventes ledger uses for lookups is what gets persisted. */
import { useEffect, useState } from "react";
import { Check, Minus } from "lucide-react";

import { AsyncButton } from "@/components/shared/AsyncButton";
import { SuffixBadge } from "@/components/shared/SuffixBadge";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { SUFFIX_COLORS } from "@/types";
import type { CategorySuffixIn, CategorySuffixOut, SuffixColor } from "@/types";


/** "Médicament" → "Medicament". Apply on submit. */
function normalizeCategory(input: string): string {
  return input.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim();
}

/** Hex for the swatch fill — solids matching the SuffixBadge palette tone. */
const SWATCH_SOLID: Record<SuffixColor, string> = {
  teal:    "#0E9E8C",
  blue:    "#1D6FB8",
  purple:  "#7C3AED",
  amber:   "#B7791F",
  rose:    "#D6447B",
  emerald: "#1E9E63",
  orange:  "#E07F1F",
  pink:    "#E84A7B",
};


export interface CategorySuffixDialogProps {
  open:     boolean;
  onClose:  () => void;
  /** Pass an item to edit; omit to create. */
  item?:    CategorySuffixOut | null;
  isSaving?: boolean;
  onSubmit: (values: CategorySuffixIn) => Promise<unknown>;
}


export function CategorySuffixDialog({ open, onClose, item, isSaving, onSubmit }: CategorySuffixDialogProps) {
  const [values, setValues] = useState<CategorySuffixIn>({
    category: item?.category ?? "",
    suffix:   item?.suffix ?? "",
    color:    item?.color ?? "teal",
  });

  // Reset fields when the dialog opens for a different item.
  useEffect(() => {
    if (open) {
      setValues({
        category: item?.category ?? "",
        suffix:   item?.suffix ?? "",
        color:    item?.color ?? "teal",
      });
    }
  }, [open, item]);

  const set = <K extends keyof CategorySuffixIn>(k: K, v: CategorySuffixIn[K]) =>
    setValues((p) => ({ ...p, [k]: v }));

  const previewSuffix = values.suffix || "-?";
  const previewCategory = values.category ? normalizeCategory(values.category) : "catégorie";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit({ ...values, category: normalizeCategory(values.category) });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md gap-0 overflow-hidden p-0">
        <div className="border-b border-border px-5 py-4">
          <h3 className="text-[17px] font-semibold text-foreground">
            {item ? "Modifier le mapping" : "Nouveau mapping"}
          </h3>
        </div>

        {/* Live preview */}
        <div className="flex items-center gap-3 border-b border-border bg-surface-subtle px-5 py-3.5">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Aperçu</span>
          <SuffixBadge text={previewSuffix} color={values.color ?? "teal"} />
          <span className="ml-auto font-mono text-xs text-muted-foreground">{previewCategory}</span>
        </div>

        <form className="flex flex-col gap-4 p-5" onSubmit={handleSubmit}>
          <Field label="Catégorie" required>
            <Input
              value={values.category}
              onChange={(v) => set("category", v)}
              placeholder="Médicament"
              required
              autoFocus
            />
          </Field>

          <Field label="Suffixe" required hint="Ajouté à la fin de la référence transaction (ex: T-2024-0001-1)">
            <Input
              value={values.suffix}
              onChange={(v) => set("suffix", v)}
              placeholder="-1"
              maxLength={6}
              required
              className="max-w-[140px] font-mono"
            />
          </Field>

          <Field label="Couleur">
            <div className="flex flex-wrap items-center gap-2">
              {SUFFIX_COLORS.map((c) => {
                const selected = values.color === c;
                return (
                  <button
                    key={c}
                    type="button"
                    aria-label={c}
                    onClick={() => set("color", c)}
                    className="flex size-7 cursor-pointer items-center justify-center rounded-md border-2 transition-transform hover:scale-110"
                    style={{
                      background: SWATCH_SOLID[c],
                      borderColor: selected ? "var(--foreground)" : "transparent",
                    }}
                  >
                    {selected && <Check className="size-3.5 text-white" />}
                  </button>
                );
              })}
              <button
                type="button"
                aria-label="Aucune"
                onClick={() => set("color", null)}
                className="flex size-7 cursor-pointer items-center justify-center rounded-md border-2 bg-surface-subtle transition-transform hover:scale-110"
                style={{ borderColor: values.color === null ? "var(--foreground)" : "transparent" }}
              >
                <Minus className="size-3.5 text-muted-foreground" />
              </button>
            </div>
          </Field>

          <div className="-mx-5 -mb-5 mt-1 flex items-center justify-end gap-2.5 border-t border-border bg-surface-subtle px-5 py-3.5">
            <AsyncButton type="button" variant="secondary" onClick={onClose} disabled={isSaving}>
              Annuler
            </AsyncButton>
            <AsyncButton type="submit" variant="primary" isLoading={isSaving} loadingText="Enregistrement…">
              Enregistrer
            </AsyncButton>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}


// ─── Tiny inline form primitives (same pattern as CreateUserDialog) ───────────

function Field({ label, required, hint, children }: { label: string; required?: boolean; hint?: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-foreground">
        {label}
        {required && <span className="ml-1 text-error">*</span>}
      </span>
      {children}
      {hint && <span className="text-[11.5px] leading-snug text-muted-foreground">{hint}</span>}
    </label>
  );
}

function Input({
  value, onChange, className, ...rest
}: { value: string; onChange: (v: string) => void; className?: string } & Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "className">) {
  return (
    <input
      {...rest}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`h-9 w-full rounded-md border border-input bg-surface-subtle px-3 text-sm focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2 ${className ?? ""}`}
    />
  );
}
