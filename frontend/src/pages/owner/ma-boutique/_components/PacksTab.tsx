/** « Packs »: several products sold together at one price (« Pack bébé : 199 MAD au lieu de 245 MAD »). Each pack:
 *  its products, its price, a switch « Sur le site », « Modifier » / « Supprimer ». */
import { useState } from "react";
import { Gift, Pencil, Plus, Trash2 } from "lucide-react";

import { Button } from "@/_components/atoms/Button";
import { Switch } from "@/_components/atoms/Switch";
import { ConfirmDialog } from "@/_components/molecules/ConfirmDialog";
import { EmptyState } from "@/_components/molecules/EmptyState";
import { SectionCard } from "@/_components/molecules/SectionCard";
import { SkeletonCard } from "@/_components/molecules/Skeletons";
import { useT } from "@/i18n/I18nProvider";
import type { StorePack } from "@/types/storeWebsite";
import { formatMADStr } from "@/utils/format";

import { useMyPacks } from "../hooks";
import { PackDialog } from "./PackDialog";

const toBody = (p: StorePack, hidden: boolean) => ({
  name: p.name,
  price: p.price,
  hidden,
  items: p.items.map((i) => ({ product_id: i.product.id, quantity: i.quantity })),
});

export function PacksTab() {
  const t = useT();
  const { packs, isLoading, savePack, isSavingPack, removePack } = useMyPacks();
  const [editing, setEditing] = useState<StorePack | "new" | null>(null);
  const [removing, setRemoving] = useState<StorePack | null>(null);
  if (isLoading) return <SkeletonCard lines={4} />;

  return (
    <>
      <SectionCard
        title={t("myStore.packsTitle")}
        hint={t("myStore.packHint")}
        actions={
          <Button onClick={() => setEditing("new")}>
            <Plus className="size-4" />
            {t("myStore.packCreate")}
          </Button>
        }
      >
        {packs.length === 0 ? (
          <EmptyState
            icon={<Gift className="size-5" />}
            title={t("myStore.packsEmpty")}
            hint={t("myStore.packsEmptyHint")}
          />
        ) : (
          <ul data-list="packs" className="flex flex-col divide-y divide-border">
            {packs.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center gap-4 py-3">
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="font-semibold text-foreground">{p.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {p.items.map((i) => `${i.quantity} × ${i.product.name}`).join(" · ")}
                  </span>
                </div>
                <span className="flex flex-col items-end">
                  <span className="font-mono font-semibold tabular-nums text-foreground">{formatMADStr(p.price)}</span>
                  {p.ppv_total != null && p.ppv_total > p.price && (
                    <span className="font-mono text-xs tabular-nums text-muted-foreground line-through">
                      {formatMADStr(p.ppv_total)}
                    </span>
                  )}
                </span>
                <Switch
                  checked={!p.hidden}
                  onChange={(on) => void savePack({ id: p.id, body: toBody(p, !on) })}
                  aria-label={t("myStore.colShown")}
                />
                <Button variant="outline" size="sm" onClick={() => setEditing(p)}>
                  <Pencil className="size-3.5" />
                  {t("common.edit")}
                </Button>
                <Button variant="ghost" size="icon-sm" aria-label={t("common.delete")} onClick={() => setRemoving(p)}>
                  <Trash2 className="size-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      {editing && (
        <PackDialog
          key={editing === "new" ? "new" : editing.id}
          pack={editing === "new" ? null : editing}
          isSaving={isSavingPack}
          onClose={() => setEditing(null)}
          onSave={(body) => savePack({ id: editing === "new" ? undefined : editing.id, body })}
        />
      )}
      <ConfirmDialog
        open={removing !== null}
        onClose={() => setRemoving(null)}
        variant="destructive"
        title={t("myStore.packRemoveTitle", { name: removing?.name ?? "" })}
        confirmLabel={t("common.delete")}
        onConfirm={async () => {
          if (removing) await removePack(removing.id);
          setRemoving(null);
        }}
      />
    </>
  );
}
