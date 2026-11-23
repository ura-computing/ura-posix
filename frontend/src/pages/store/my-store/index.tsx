/** /ma-boutique — « Ma boutique en ligne » (owner). No request yet: ask for it step by step (`RequestWizard`).
 *  Sent: 4 tabs (in the URL, ?tab=…), changes show on the site at once, live too:
 *    Ma demande — where it stands (`Stepper`), what was asked, « Modifier » while « Envoyée »
 *    Produits   — show / hide each product, promo prices
 *    Catégories — which categories the site shows
 *    Packs      — several products at one price */
import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ExternalLink, Pencil, Store, Trash2 } from "lucide-react";

import { Button } from "@/_components/atoms/Button";
import { buttonClass } from "@/_components/atoms/buttonClass";
import { ConfirmDialog } from "@/_components/molecules/ConfirmDialog";
import { FieldList } from "@/_components/molecules/FieldList";
import { LoadError } from "@/_components/molecules/LoadError";
import { TabBar } from "@/_components/molecules/TabBar";
import { SectionCard } from "@/_components/molecules/SectionCard";
import { PageSkeleton } from "@/_components/molecules/Skeletons";
import { Stepper } from "@/_components/molecules/Stepper";
import { Thumbnail } from "@/_components/molecules/Thumbnail";
import { Page } from "@/_components/templates/Page";
import { apiUrl } from "@/api/client";
import { useT } from "@/i18n/I18nProvider";
import { REQUEST_STATE_LABEL, REQUEST_STATE_ORDER, URGENCY_LABEL } from "@/types/storeWebsite";

import { PaletteSwatches, StateBadge } from "../_components/RequestBadges";
import { previewPath } from "../paths";
import { CategoriesTab } from "./_components/CategoriesTab";
import { PacksTab } from "./_components/PacksTab";
import { ProductsTab } from "./_components/ProductsTab";
import { RequestWizard } from "./_components/RequestWizard";
import { useMyStore } from "./hooks";

type Tab = "request" | "products" | "categories" | "packs";
const TABS: Tab[] = ["request", "products", "categories", "packs"];

export default function MyStorePage() {
  const t = useT();
  const { request, isLoading, isError, reload, submitRequest, isSending, deleteStore } = useMyStore();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [params, setParams] = useSearchParams();
  const tab = TABS.find((id) => id === params.get("tab")) ?? "request";

  if (isLoading) return <PageSkeleton />;
  if (isError) {
    return (
      <Page title={t("myStore.title")}>
        <LoadError message={t("myStore.loadError")} onRetry={reload} />
      </Page>
    );
  }

  if (!request || editing) {
    return (
      <Page title={t("myStore.title")} subtitle={t("myStore.subtitle")} narrow>
        <RequestWizard
          initial={request}
          isSending={isSending}
          onCancel={request ? () => setEditing(false) : undefined}
          onSubmit={async (body, logo) => {
            await submitRequest({ body, logo, id: request?.id });
            setEditing(false);
          }}
        />
      </Page>
    );
  }

  const logo = request.logo_url ? apiUrl(request.logo_url) : null;
  const started = request.state !== "soumise";

  return (
    <Page
      media={
        <Thumbnail
          key={logo}
          src={logo}
          alt={request.store_name}
          icon={Store}
          label={t("store.noLogo")}
          className="size-16 rounded-xl p-1.5"
        />
      }
      title={request.store_name}
      subtitle={
        <span className="flex flex-wrap items-center gap-2">
          {t("myStore.title")}
          <StateBadge state={request.state} />
        </span>
      }
      actions={
        <>
          {!started && (
            <Button variant="outline" onClick={() => setEditing(true)}>
              <Pencil className="size-4" />
              {t("common.edit")}
            </Button>
          )}
          {started && (
            <a
              href={previewPath(request.template, "home", request.id)}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonClass("primary", "lg")}
            >
              <ExternalLink className="size-4" />
              {t("myStore.view")}
            </a>
          )}
        </>
      }
    >
      <TabBar<Tab>
        tabs={TABS.map((id) => ({ id, label: t(`myStore.tab_${id}`) }))}
        activeId={tab}
        onChange={(id) => setParams(id === "request" ? {} : { tab: id })}
      />
      {tab === "products" && <ProductsTab />}
      {tab === "categories" && <CategoriesTab />}
      {tab === "packs" && <PacksTab />}
      {tab === "request" && (
        <>
          <SectionCard title={t("store.steps")}>
            <Stepper
              steps={REQUEST_STATE_ORDER.map((s) => t(REQUEST_STATE_LABEL[s]))}
              current={REQUEST_STATE_ORDER.indexOf(request.state)}
            />
            <p className="text-sm text-muted-foreground">{t(`myStore.stateHint_${request.state}`)}</p>
          </SectionCard>

          <SectionCard title={t("store.theRequest")}>
            <FieldList
              fields={[
                { label: t("myStore.storeName"), value: request.store_name },
                { label: t("myStore.whatsapp"), value: <span className="font-mono">{request.phone}</span> },
                { label: t("store.colors"), value: <PaletteSwatches colors={request.brand_palette} /> },
                { label: t("myStore.domain"), value: request.custom_domain || t("store.noDomain") },
                { label: t("store.colUrgency"), value: t(URGENCY_LABEL[request.urgency]) },
                { label: t("myStore.wishes"), value: request.vision || t("store.noWishes") },
              ]}
            />
          </SectionCard>
          <SectionCard title={t("myStore.dangerTitle")}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-muted-foreground">{t("myStore.deleteHint")}</p>
              <Button variant="danger-outline" onClick={() => setDeleteOpen(true)}>
                <Trash2 className="size-4" />
                {t("myStore.delete")}
              </Button>
            </div>
          </SectionCard>
          <ConfirmDialog
            open={deleteOpen}
            onClose={() => setDeleteOpen(false)}
            variant="destructive"
            title={t("myStore.deleteTitle")}
            description={t("myStore.deleteHint")}
            confirmLabel={t("myStore.delete")}
            onConfirm={async () => {
              await deleteStore();
              setDeleteOpen(false);
            }}
          />
        </>
      )}
    </Page>
  );
}
