/** /produits/:id — one product of the pharmacy: « Général » (photos, données, prix, stock,
 *  description, mouvements récents, ventes et achats par mois), « Statistiques », « Mouvements »
 *  and « Codes ». Not one of its products → the 404
 *  inside the layout (never says whether it exists elsewhere). */
import { ArrowLeft, ChevronRight } from "lucide-react";
import { Link, useParams } from "react-router-dom";

import { Page } from "@/_components/Page";
import { TabBar } from "@/_components/TabBar";
import { TypeBadge } from "@/_components/TypeBadge";
import NotFoundPage from "@/pages/auth/not-found";
import { ROUTES, type ProductSheet } from "@/types";
import { useT } from "@/i18n/I18nProvider";

import { CodesTab } from "./_components/CodesTab";
import { GeneralTab } from "./_components/GeneralTab";
import { MovementsTab } from "./_components/MovementsTab";
import { StatsTab } from "./_components/StatsTab";
import { useProduitPage, type SheetTab } from "./hooks";

function BackToList({ name }: { name: string }) {
  const t = useT();
  return (
    <>
      <Link
        to={ROUTES.PRODUITS}
        className="inline-flex h-9 w-fit cursor-pointer items-center gap-1.5 rounded-md border border-border bg-card px-3 text-sm font-semibold text-foreground transition-colors hover:bg-surface-subtle"
      >
        <ArrowLeft className="size-4" />
        {t("products.backToList")}
      </Link>
      <nav className="flex items-center gap-1 text-xs text-muted-foreground">
        <Link to={ROUTES.PRODUITS} className="hover:text-foreground">
          {t("products.title")}
        </Link>
        <ChevronRight className="size-3" />
        <span className="text-foreground">{name}</span>
      </nav>
    </>
  );
}

/** Under the name: brand / laboratoire, then PID · type · catégorie · TVA. */
function Badges({ sheet }: { sheet: ProductSheet }) {
  const chip = "rounded border border-border bg-surface-subtle px-1.5 py-px text-xs";
  const maker = sheet.info?.brand ?? sheet.laboratoire;
  return (
    <div className="flex flex-col gap-2">
      {maker && <span className="text-base text-muted-foreground">{maker}</span>}
      <div className="flex flex-wrap items-center gap-2">
        <span className={`${chip} font-mono`}>PID {sheet.pid}</span>
        <TypeBadge type={sheet.category_type} />
        {sheet.category && <span className={chip}>{sheet.category}</span>}
        {sheet.tva && <span className={chip}>{sheet.tva}</span>}
      </div>
    </div>
  );
}

export default function ProduitPage() {
  const t = useT();
  const { id } = useParams<{ id: string }>();
  const { sheet, stats, isLoading, notFound, tab, setTab } = useProduitPage(Number(id));

  if (notFound) return <NotFoundPage embedded />;
  if (isLoading || !sheet) {
    return <div className="py-10 text-center text-sm text-muted-foreground">{t("common.loading")}</div>;
  }

  const tabs: { id: SheetTab; label: string }[] = [
    { id: "general", label: t("products.tabGeneral") },
    { id: "stats", label: t("products.tabStats") },
    { id: "movements", label: t("products.tabMovements") },
    { id: "codes", label: t("products.tabCodes") },
  ];
  return (
    <Page above={<BackToList name={sheet.product} />} title={sheet.product} subtitle={<Badges sheet={sheet} />}>
      <TabBar tabs={tabs} activeId={tab} onChange={setTab} />
      {tab === "general" && <GeneralTab sheet={sheet} stats={stats} onShowMovements={() => setTab("movements")} />}
      {tab === "stats" && <StatsTab sheet={sheet} stats={stats} />}
      {tab === "movements" && <MovementsTab sheet={sheet} />}
      {tab === "codes" && <CodesTab sheet={sheet} />}
    </Page>
  );
}
