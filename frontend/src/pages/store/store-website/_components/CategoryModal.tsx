import { useState, type ReactNode } from "react";

import { Button } from "@/_components/atoms/Button";
import { Dialog, DialogContent } from "@/_components/dialog";
import { Input } from "./input";
import { Label } from "./label";
import { STORE_CATEGORY_COLORS, type StoreCategory } from "@/types/storeWebsite";

import { CATEGORY_ICONS, CategoryIcon } from "./categoryIcons";

/** Modal — Nouvelle / Modifier catégorie. Opened from Tab 2 AND from the
 *  developer editor (shared source of truth). Fixed palette: 12 icons +
 *  8 brand-safe colors per the locked spec.
 *
 *  No `Field` primitive in the apcm-refactor shadcn stack — using a small
 *  inline `<Field>` helper backed by `Label + <div>`. */

export interface CategoryValues {
  name: string;
  description: string;
  icon: string;
  color: string;
}

export interface CategoryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Present → edit mode. */
  category?: StoreCategory;
  isSaving?: boolean;
  onSubmit: (values: CategoryValues) => void;
}

export function CategoryModal({ open, onOpenChange, category, isSaving, onSubmit }: CategoryModalProps) {
  const [v, setV] = useState<CategoryValues>({
    name: category?.name ?? "",
    description: category?.description ?? "",
    icon: category?.icon ?? CATEGORY_ICONS[0].key,
    color: category?.color ?? STORE_CATEGORY_COLORS[0],
  });
  const set = <K extends keyof CategoryValues>(k: K, val: CategoryValues[K]) => setV((p) => ({ ...p, [k]: val }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md gap-0 overflow-hidden p-0">
        <div className="border-b border-border px-5 py-4">
          <h3 className="text-[17px] font-semibold text-foreground">
            {category ? "Modifier la catégorie" : "Nouvelle catégorie"}
          </h3>
        </div>

        {/* Live preview of the category card */}
        <div className="flex items-center gap-3 border-b border-border bg-surface-subtle px-5 py-4">
          <span
            className="flex size-10 items-center justify-center rounded-lg"
            style={{ background: `${v.color}1f`, color: v.color }}
          >
            <CategoryIcon name={v.icon} className="size-5" />
          </span>
          <span className="text-sm font-semibold text-foreground">{v.name || "Nom de la catégorie"}</span>
        </div>

        <form
          className="flex flex-col gap-4 p-5"
          onSubmit={(e) => {
            e.preventDefault();
            if (v.name.trim()) onSubmit(v);
          }}
        >
          <Field htmlFor="cat-name" label="Nom" required>
            <Input
              id="cat-name"
              value={v.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="Soins bébé"
              required
            />
          </Field>

          <Field htmlFor="cat-desc" label="Description courte" optional>
            <Input
              id="cat-desc"
              value={v.description}
              onChange={(e) => set("description", e.target.value)}
              placeholder="Tout pour le bien-être de bébé"
            />
          </Field>

          <Field label="Icône">
            <div className="flex flex-wrap gap-2">
              {CATEGORY_ICONS.map(({ key, label, Icon }) => {
                const on = v.icon === key;
                return (
                  <button
                    key={key}
                    type="button"
                    aria-label={label}
                    data-on={on}
                    onClick={() => set("icon", key)}
                    className="flex size-10 cursor-pointer items-center justify-center rounded-lg border border-border bg-surface-subtle text-muted-foreground transition-colors hover:bg-surface-subtle/70 data-[on=true]:border-primary data-[on=true]:bg-card data-[on=true]:text-primary"
                  >
                    <Icon className="size-5" />
                  </button>
                );
              })}
            </div>
          </Field>

          <Field label="Couleur">
            <div className="flex flex-wrap gap-2">
              {STORE_CATEGORY_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-label={c}
                  onClick={() => set("color", c)}
                  className="size-8 cursor-pointer rounded-lg border-2 transition-transform hover:scale-110"
                  style={{
                    background: c,
                    borderColor: v.color === c ? "var(--color-foreground, currentColor)" : "transparent",
                  }}
                />
              ))}
            </div>
          </Field>

          <div className="-mx-5 -mb-5 mt-1 flex items-center justify-end gap-2.5 border-t border-border bg-surface-subtle px-5 py-3.5">
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
              Annuler
            </Button>
            <Button type="submit" disabled={isSaving}>
              Enregistrer
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  htmlFor,
  required,
  optional,
  children,
}: {
  label: string;
  htmlFor?: string;
  required?: boolean;
  optional?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={htmlFor} className="flex items-center gap-1.5 text-foreground">
        <span>{label}</span>
        {required && <span className="text-error-subtle-foreground">*</span>}
        {optional && <span className="text-xs font-normal text-muted-foreground">(optionnel)</span>}
      </Label>
      {children}
    </div>
  );
}
