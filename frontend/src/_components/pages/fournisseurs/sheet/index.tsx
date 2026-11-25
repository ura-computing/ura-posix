/** One supplier (admin, Support), laid out like the promis sheet: left, its blocks (« Contact », « Commande et
 *  livraison », « Paiement et transport », « Note »), each with « Modifier »; right, « À compléter »: what ordering
 *  still needs. An empty value says « inconnu » in orange (nothing is invented). « Archiver » takes it out of the list
 *  (back with « Remettre dans la liste »). */
import { useState, type ReactNode } from "react";
import { useParams } from "react-router-dom";
import { Archive, ArchiveRestore, CircleCheck, Pencil } from "lucide-react";

import { Badge } from "@/_components/atoms/Badge";
import { Button } from "@/_components/atoms/Button";
import { BackLink } from "@/_components/molecules/BackLink";
import { Callout } from "@/_components/molecules/Callout";
import { FieldList } from "@/_components/molecules/FieldList";
import { LoadError } from "@/_components/molecules/LoadError";
import { SectionCard } from "@/_components/molecules/SectionCard";
import { PageSkeleton } from "@/_components/molecules/Skeletons";
import { Page } from "@/_components/templates/Page";
import { useMe } from "@/hooks/useMe";
import { useT } from "@/i18n/I18nProvider";
import NotFoundPage from "@/pages/common/not-found";
import { WEEK, type SupplierSheet } from "@/types/suppliers";
import { formatDate, formatMADStr } from "@/utils/format";

import { SupplierEditDialog, type SupplierBlock } from "./_components/SupplierEditDialog";
import { useSupplierSheet } from "./hooks";

/** What ordering needs: the board gives none of it yet (« inconnu » until typed). */
const ORDER_FIELDS = [
  "order_channel",
  "delivery_days",
  "cutoff_time",
  "lead_time_days",
  "payment_terms",
  "transport_fee",
] as const satisfies readonly (keyof SupplierSheet)[];

function SupplierSheetPage({ id }: { id: number }) {
  const t = useT();
  const { me } = useMe();
  const { supplier, isLoading, isError, notFound, reload, saveSupplier, isSaving } = useSupplierSheet(id);
  const [block, setBlock] = useState<SupplierBlock | null>(null);
  const back = <BackLink to={`/${me?.role}/fournisseurs`} label={t("suppliers.backToList")} />;

  if (notFound) return <NotFoundPage embedded />;
  if (isLoading) return <PageSkeleton />;
  if (isError || !supplier) {
    return (
      <Page above={back} title={t("suppliers.title")}>
        <LoadError onRetry={reload} />
      </Page>
    );
  }

  const s = supplier;
  const unknown = <Badge tone="warning">{t("suppliers.unknown")}</Badge>;
  const none = <span className="text-muted-foreground">—</span>;
  // Empty (null, « », false from `x != null && …`) → « inconnu » (or « — » for a field ordering does not need).
  const val = (v: ReactNode, fallback: ReactNode = unknown) => (v == null || v === "" || v === false ? fallback : v);
  const edit = (b: SupplierBlock) => (
    <Button variant="outline" size="sm" onClick={() => setBlock(b)}>
      <Pencil className="size-3.5" />
      {t("common.edit")}
    </Button>
  );
  const missing = ORDER_FIELDS.filter((f) => s[f] == null);
  const days = s.delivery_days && WEEK.filter((d) => s.delivery_days!.includes(d)).map((d) => t(`suppliers.day_${d}`));

  return (
    <Page
      above={back}
      title={s.name}
      subtitle={
        <span className="flex flex-wrap items-center gap-2">
          {s.kind ? t(`suppliers.kind.${s.kind}`) : t("suppliers.kindUnknown")}
          {s.city && <> · {s.city}</>}
          {s.archived_at && <Badge>{t("suppliers.archivedOn", { date: formatDate(s.archived_at) })}</Badge>}
        </span>
      }
      actions={
        <Button
          size="lg"
          variant="outline"
          isLoading={isSaving}
          onClick={() => void saveSupplier({ archived: !s.archived_at })}
        >
          {s.archived_at ? <ArchiveRestore className="size-4" /> : <Archive className="size-4" />}
          {t(s.archived_at ? "suppliers.restore" : "suppliers.archive")}
        </Button>
      }
    >
      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[1fr_320px]">
        <div className="flex min-w-0 flex-col gap-5">
          <SectionCard title={t("suppliers.block_contact")} actions={edit("contact")}>
            <FieldList
              fields={[
                { label: t("suppliers.contactName"), value: val(s.contact_name, none) },
                {
                  label: t("suppliers.colPhone"),
                  value: val(s.phone && <span className="font-mono">{s.phone}</span>, none),
                },
                { label: t("suppliers.colEmail"), value: val(s.email, none) },
                { label: t("suppliers.colAddress"), value: val([s.address, s.city].filter(Boolean).join(", "), none) },
              ]}
            />
          </SectionCard>
          <SectionCard title={t("suppliers.block_order")} actions={edit("order")}>
            <FieldList
              fields={[
                {
                  label: t("suppliers.channel"),
                  value: val(s.order_channel && t(`suppliers.channel_${s.order_channel}`)),
                },
                { label: t("suppliers.deliveryDays"), value: val(days?.join(", ")) },
                {
                  label: t("suppliers.cutoff"),
                  value: val(s.cutoff_time && t("suppliers.cutoffValue", { time: s.cutoff_time })),
                },
                {
                  label: t("suppliers.leadTime"),
                  value: val(s.lead_time_days != null && t("suppliers.leadTimeValue", { n: s.lead_time_days })),
                },
              ]}
            />
          </SectionCard>
          <SectionCard title={t("suppliers.block_money")} actions={edit("money")}>
            <FieldList
              fields={[
                { label: t("suppliers.payment"), value: val(s.payment_terms) },
                {
                  label: t("suppliers.transportFee"),
                  value: val(s.transport_fee != null && formatMADStr(s.transport_fee)),
                },
                {
                  label: t("suppliers.freeFrom"),
                  value: val(s.free_transport_from != null && formatMADStr(s.free_transport_from), none),
                },
              ]}
            />
          </SectionCard>
          <SectionCard title={t("suppliers.block_note")} actions={edit("note")}>
            <p className="whitespace-pre-line text-sm text-foreground">{s.note ?? t("suppliers.noNote")}</p>
          </SectionCard>
        </div>

        <SectionCard title={t("suppliers.toComplete")}>
          {missing.length === 0 ? (
            <Callout tone="success">{t("suppliers.complete")}</Callout>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">{t("suppliers.toCompleteHint")}</p>
              <ul className="flex flex-col gap-2">
                {missing.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-sm text-foreground">
                    <span className="size-2 rounded-full bg-warning" aria-hidden />
                    {t(`suppliers.field_${f}`)}
                  </li>
                ))}
              </ul>
            </>
          )}
          {missing.length > 0 && missing.length < ORDER_FIELDS.length && (
            <span className="flex items-center gap-2 text-xs text-muted-foreground">
              <CircleCheck className="size-3.5 text-success" aria-hidden />
              {t("suppliers.filledN", { n: ORDER_FIELDS.length - missing.length, total: ORDER_FIELDS.length })}
            </span>
          )}
        </SectionCard>
      </div>

      <SupplierEditDialog
        block={block}
        supplier={s}
        onSave={saveSupplier}
        isSaving={isSaving}
        onClose={() => setBlock(null)}
      />
    </Page>
  );
}

export default function SupplierSheetRoute() {
  const { id } = useParams<{ id: string }>();
  return <SupplierSheetPage key={id} id={Number(id)} />;
}
