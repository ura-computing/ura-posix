/** « Conditions » of a supplier: each rule in plain words (« Dès 100 unités : 20 % »), its state (« Confirmée »
 *  green, « À vérifier » orange: shown, never applied), the products it covers, validity, where it comes from;
 *  « ⋮ » → « Modifier » / « Supprimer » (asks first). « Ajouter une condition » opens the step-by-step form. */
import { useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";

import { Badge, type BadgeTone } from "@/_components/atoms/Badge";
import { Button } from "@/_components/atoms/Button";
import { ConfirmDialog } from "@/_components/molecules/ConfirmDialog";
import { EmptyState } from "@/_components/molecules/EmptyState";
import { KebabItem, KebabMenu } from "@/_components/molecules/KebabMenu";
import { SectionCard } from "@/_components/molecules/SectionCard";
import { SkeletonText } from "@/_components/molecules/Skeletons";
import { useT } from "@/i18n/I18nProvider";
import type { Condition, ConditionState, SupplierSheet } from "@/types/suppliers";
import { formatDate } from "@/utils/format";

import { conditionText } from "../conditionText";
import { useConditions } from "../hooks";
import { ConditionWizard } from "./ConditionWizard";

const TONE: Record<ConditionState, BadgeTone> = { confirmed: "success", unverified: "warning", missing: "error" };

export function ConditionsCard({ supplier }: { supplier: SupplierSheet }) {
  const t = useT();
  const { conditions, isLoadingConditions, saveCondition, isSavingCondition, deleteCondition } = useConditions(
    supplier.id,
  );
  const [editing, setEditing] = useState<Condition | "new" | null>(null);
  const [removing, setRemoving] = useState<Condition | null>(null);

  const products = (c: Condition) =>
    c.products.length === 0
      ? t("conditions.allProducts")
      : c.products.length <= 3
        ? c.products.map((p) => p.product).join(", ")
        : t("conditions.productsMore", {
            names: c.products
              .slice(0, 2)
              .map((p) => p.product)
              .join(", "),
            n: c.products.length - 2,
          });

  return (
    <SectionCard
      title={t("conditions.title")}
      hint={conditions.length ? String(conditions.length) : undefined}
      actions={
        <Button variant="outline" size="sm" onClick={() => setEditing("new")}>
          <Plus className="size-3.5" />
          {t("conditions.add_")}
        </Button>
      }
    >
      {isLoadingConditions ? (
        <SkeletonText lines={3} />
      ) : conditions.length === 0 ? (
        <EmptyState title={t("conditions.emptyTitle")} hint={t("conditions.emptyHint")} className="py-8" />
      ) : (
        <ul className="flex flex-col divide-y divide-border">
          {conditions.map((c) => (
            <li key={c.id} className="flex items-start justify-between gap-3 py-3">
              <span className="flex min-w-0 flex-col gap-1">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {t(`conditions.kind_${c.kind}`)}
                  </span>
                  <Badge tone={TONE[c.state]}>{t(`conditions.state_${c.state}`)}</Badge>
                </span>
                <span className="text-base font-semibold text-foreground">{conditionText(t, c)}</span>
                <span className="text-sm text-muted-foreground">{products(c)}</span>
                <span className="text-xs text-muted-foreground">
                  {[
                    c.valid_from && t("conditions.since", { date: formatDate(c.valid_from) }),
                    c.valid_to && t("conditions.until", { date: formatDate(c.valid_to) }),
                    c.source,
                    t("conditions.changedBy", { name: c.updated_by_name, version: c.version }),
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </span>
              <KebabMenu label={t("conditions.actions")}>
                {(close) => (
                  <>
                    <KebabItem icon={<Pencil className="size-3.5" />} onSelect={() => setEditing(c)} close={close}>
                      {t("common.edit")}
                    </KebabItem>
                    <KebabItem
                      icon={<Trash2 className="size-3.5" />}
                      danger
                      onSelect={() => setRemoving(c)}
                      close={close}
                    >
                      {t("common.delete")}
                    </KebabItem>
                  </>
                )}
              </KebabMenu>
            </li>
          ))}
        </ul>
      )}

      <ConditionWizard
        open={editing !== null}
        supplier={supplier}
        condition={editing === "new" ? null : editing}
        onSave={saveCondition}
        isSaving={isSavingCondition}
        onClose={() => setEditing(null)}
      />
      <ConfirmDialog
        open={removing !== null}
        onClose={() => setRemoving(null)}
        variant="destructive"
        title={t("conditions.removeTitle")}
        description={removing ? conditionText(t, removing) : ""}
        confirmLabel={t("common.delete")}
        onConfirm={async () => {
          if (removing) await deleteCondition(removing.id);
          setRemoving(null);
        }}
      />
    </SectionCard>
  );
}
