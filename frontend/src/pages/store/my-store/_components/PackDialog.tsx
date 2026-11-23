/** « Créer un pack » / change one: its name, its products (search, « Ajouter », a quantity each), its price (the
 *  products' normal total shown beside). */
import { useState } from "react";
import { Gift, Minus, Package, Plus, Trash2 } from "lucide-react";

import { Button } from "@/_components/atoms/Button";
import { Dialog, DialogContent } from "@/_components/atoms/Dialog";
import { DialogBody, DialogFooter, DialogHeader } from "@/_components/molecules/DialogShell";
import { FormField, FormInput } from "@/_components/molecules/FormField";
import { SearchField } from "@/_components/molecules/SearchField";
import { Thumbnail } from "@/_components/molecules/Thumbnail";
import { useT } from "@/i18n/I18nProvider";
import type { PackIn, StorePack, StoreProduct } from "@/types/storeWebsite";
import { formatMADStr } from "@/utils/format";

import { useMyProducts } from "../hooks";

type Line = { product: StoreProduct; quantity: number };

export function PackDialog({
  pack,
  isSaving,
  onClose,
  onSave,
}: {
  pack: StorePack | null;
  isSaving: boolean;
  onClose: () => void;
  onSave: (body: PackIn) => Promise<unknown>;
}) {
  const t = useT();
  const [name, setName] = useState(pack?.name ?? "");
  const [price, setPrice] = useState(pack ? String(pack.price) : "");
  const [lines, setLines] = useState<Line[]>(pack?.items ?? []);
  const [search, setSearch] = useState("");
  const { products } = useMyProducts({ view: "all", search, page: 1, limit: 6 });

  const normal = lines.reduce((sum, l) => sum + (l.product.ppv ?? 0) * l.quantity, 0);
  const priceNumber = Number(price.replace(",", "."));
  const valid = name.trim() !== "" && lines.length > 0 && priceNumber > 0;

  const add = (p: StoreProduct) =>
    setLines((cur) =>
      cur.some((l) => l.product.id === p.id)
        ? cur.map((l) => (l.product.id === p.id ? { ...l, quantity: l.quantity + 1 } : l))
        : [...cur, { product: p, quantity: 1 }],
    );
  const setQuantity = (id: number, q: number) =>
    setLines((cur) => cur.map((l) => (l.product.id === id ? { ...l, quantity: Math.max(1, q) } : l)));

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl gap-0 overflow-hidden p-0">
        <DialogHeader
          icon={<Gift className="size-4" />}
          title={pack ? t("myStore.packEdit") : t("myStore.packCreate")}
          subtitle={t("myStore.packHint")}
          onClose={onClose}
        />
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!valid) return;
            void onSave({
              name: name.trim(),
              price: priceNumber,
              hidden: pack?.hidden ?? false,
              items: lines.map((l) => ({ product_id: l.product.id, quantity: l.quantity })),
            }).then(onClose);
          }}
        >
          <DialogBody>
            <FormField label={t("myStore.packName")} required>
              <FormInput
                value={name}
                onChange={setName}
                placeholder={t("myStore.packNamePh")}
                maxLength={120}
                autoFocus
              />
            </FormField>

            <FormField label={t("myStore.packProducts")} group>
              <SearchField
                value={search}
                onChange={setSearch}
                placeholder={t("myStore.searchPh")}
                suggestions={null}
                onPick={() => {}}
              />
              {search.trim() && (
                <ul className="flex flex-col divide-y divide-border rounded-md border border-border">
                  {products.map((p) => (
                    <li key={p.id} className="flex items-center gap-3 px-3 py-2">
                      <Thumbnail
                        key={p.photo}
                        src={p.photo}
                        alt={p.name}
                        icon={Package}
                        label={t("products.noPhoto")}
                        className="size-9 p-0.5"
                      />
                      <span className="min-w-0 flex-1 truncate text-sm text-foreground">{p.name}</span>
                      <Button type="button" size="sm" variant="outline" onClick={() => add(p)}>
                        <Plus className="size-3.5" />
                        {t("myStore.add")}
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </FormField>

            {lines.length > 0 && (
              <ul className="flex flex-col divide-y divide-border rounded-md border border-border">
                {lines.map((l) => (
                  <li key={l.product.id} className="flex items-center gap-3 px-3 py-2">
                    <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
                      {l.product.name}
                    </span>
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="ghost"
                      aria-label="-"
                      onClick={() => setQuantity(l.product.id, l.quantity - 1)}
                    >
                      <Minus className="size-3.5" />
                    </Button>
                    <span className="w-6 text-center font-mono tabular-nums">{l.quantity}</span>
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="ghost"
                      aria-label="+"
                      onClick={() => setQuantity(l.product.id, l.quantity + 1)}
                    >
                      <Plus className="size-3.5" />
                    </Button>
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="ghost"
                      aria-label={t("common.delete")}
                      onClick={() => setLines((cur) => cur.filter((x) => x.product.id !== l.product.id))}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}

            <FormField
              label={t("myStore.packPrice")}
              required
              hint={normal > 0 ? t("myStore.normalPrice", { price: formatMADStr(normal) }) : undefined}
            >
              <FormInput value={price} onChange={setPrice} inputMode="decimal" placeholder="199" />
            </FormField>
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
