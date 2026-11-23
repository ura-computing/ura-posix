/** /admin/boutiques — « Boutiques en ligne » (staff: admin + Support). The pharmacies' requests for an online
 *  store, in 3 tabs: « À traiter » (nobody took it: « Prendre en charge »), « Mes boutiques » (« Ouvrir l'éditeur »),
 *  « Suivies par d'autres » (read only). A row opens the request. The tab lives in the URL (?tab=…). */
import { ArrowRight, Hand } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";

import { Button } from "@/_components/atoms/Button";
import { LoadError } from "@/_components/molecules/LoadError";
import { TabBar } from "@/_components/molecules/TabBar";
import { DataTable, type ColumnDef } from "@/_components/organisms/DataTable";
import { Page } from "@/_components/templates/Page";
import { useT } from "@/i18n/I18nProvider";
import type { WebsiteRequestOut } from "@/types/storeWebsite";
import { formatDateTime } from "@/utils/format";

import { PaletteSwatches, StateBadge, UrgencyBadge } from "../_components/RequestBadges";
import { editorPath, requestPath } from "../paths";
import { useClaimRequest, useStoreRequests } from "./hooks";

type Tab = "toDo" | "mine" | "others";
const TABS: Tab[] = ["toDo", "mine", "others"];

export default function StoreRequestsPage() {
  const t = useT();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const tab: Tab = TABS.find((id) => id === params.get("tab")) ?? "toDo";
  const { toDo, mine, others, isLoading, isError, reload } = useStoreRequests();
  const { claimRequest, isClaiming } = useClaimRequest();
  const rows = { toDo, mine, others }[tab];

  const claim = async (id: string) => {
    await claimRequest(id);
    navigate(requestPath(id));
  };

  const columns: ColumnDef<WebsiteRequestOut>[] = [
    {
      key: "pharmacy",
      label: t("store.colPharmacy"),
      sortable: false,
      render: (r) => (
        <div className="flex flex-col">
          <span className="font-semibold text-foreground">{r.pharmacy_name}</span>
          <span className="text-xs text-muted-foreground">
            {[r.pharmacy_code, r.owner_name].filter(Boolean).join(" · ")}
          </span>
        </div>
      ),
    },
    {
      key: "store",
      label: t("store.colStore"),
      sortable: false,
      render: (r) => (
        <div className="flex items-center gap-2">
          <PaletteSwatches colors={r.brand_palette} />
          <span className="font-medium text-foreground">{r.store_name}</span>
        </div>
      ),
    },
    {
      key: "created_at",
      label: t("store.colAskedOn"),
      sortable: false,
      render: (r) => (
        <span className="font-mono text-xs tabular-nums text-muted-foreground">{formatDateTime(r.created_at)}</span>
      ),
    },
    {
      key: "urgency",
      label: t("store.colUrgency"),
      sortable: false,
      render: (r) => <UrgencyBadge urgency={r.urgency} />,
    },
    { key: "state", label: t("store.colStep"), sortable: false, render: (r) => <StateBadge state={r.state} /> },
    {
      key: "actions",
      label: t("adminUsers.colActions"),
      align: "right",
      sortable: false,
      render: (r) =>
        tab === "toDo" ? (
          <Button
            size="sm"
            disabled={isClaiming}
            onClick={(e) => {
              e.stopPropagation();
              void claim(r.id);
            }}
          >
            <Hand className="size-3.5" />
            {t("store.claim")}
          </Button>
        ) : tab === "mine" ? (
          <Button
            size="sm"
            variant="outline"
            onClick={(e) => {
              e.stopPropagation();
              navigate(editorPath(r.id));
            }}
          >
            {t("store.openEditor")}
            <ArrowRight className="size-3.5" />
          </Button>
        ) : (
          <span className="text-xs text-muted-foreground">
            {t("store.followedBy", { name: r.claimed_by?.name ?? "—" })}
          </span>
        ),
    },
  ];

  return (
    <Page title={t("store.requestsTitle")} subtitle={t("store.requestsSubtitle")}>
      <TabBar<Tab>
        tabs={[
          { id: "toDo", label: t("store.tabToDo", { n: toDo.length }) },
          { id: "mine", label: t("store.tabMine", { n: mine.length }) },
          { id: "others", label: t("store.tabOthers", { n: others.length }) },
        ]}
        activeId={tab}
        onChange={(id) => setParams(id === "toDo" ? {} : { tab: id })}
      />
      {isError ? (
        <LoadError message={t("store.loadError")} onRetry={reload} />
      ) : (
        <DataTable
          rows={rows}
          columns={columns}
          isLoading={isLoading}
          rowKey={(r) => r.id}
          onRowClick={(r) => navigate(requestPath(r.id))}
          emptyTitle={t(tab === "toDo" ? "store.emptyToDo" : tab === "mine" ? "store.emptyMine" : "store.emptyOthers")}
        />
      )}
    </Page>
  );
}
