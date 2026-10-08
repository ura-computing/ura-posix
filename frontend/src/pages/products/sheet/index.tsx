/** /produits/:id — one product of the pharmacy: header (photo, PID / catégorie / TVA, badges,
 *  code barre, « Modifier »), then « Général », « Statistiques », « Mouvements » and « Codes ».
 *  Not one of its products → the 404 inside the layout (never says whether it exists elsewhere). */
import { ArrowLeftRight, BarChart3, Box, ScanLine } from "lucide-react";
import { useParams } from "react-router-dom";

import { Page } from "@/_components/Page";
import { TabBar, type TabItem } from "@/_components/TabBar";
import NotFoundPage from "@/pages/auth/not-found";
import { useT } from "@/i18n/I18nProvider";

import { ProductPhoto } from "../_components/ProductPhoto";
import { CodesTab } from "./_components/CodesTab";
import { SheetEditContext } from "./_components/editContext";
import { GeneralTab } from "./_components/GeneralTab";
import { MovementsTab } from "./_components/MovementsTab";
import { BarcodeCard, EditActions, PrintButton, SheetBreadcrumb, SheetMeta } from "./_components/SheetHeader";
import { StatsPeriodPicker } from "./_components/StatsPeriodPicker";
import { StatsTab } from "./_components/StatsTab";
import { useProductStats, useProduitPage, useSheetEditor, useStatsPeriod, type SheetTab } from "./hooks";

function ProductSheetPage({ id }: { id: number }) {
  const t = useT();
  const { sheet, isLoading, notFound, tab, setTab } = useProduitPage(id);
  const editor = useSheetEditor(sheet);
  const { period, setPeriod, range, setCustomRange } = useStatsPeriod();
  const { stats } = useProductStats(id, range, !!sheet);

  if (notFound) return <NotFoundPage embedded />;
  if (isLoading || !sheet) {
    return <div className="py-10 text-center text-sm text-muted-foreground">{t("common.loading")}</div>;
  }

  const icon = "size-4";
  const tabs: TabItem<SheetTab>[] = [
    { id: "general", label: t("products.tabGeneral"), icon: <Box className={icon} /> },
    { id: "stats", label: t("products.tabStats"), icon: <BarChart3 className={icon} /> },
    { id: "movements", label: t("products.tabMovements"), icon: <ArrowLeftRight className={icon} /> },
    { id: "codes", label: t("products.tabCodes"), icon: <ScanLine className={icon} /> },
  ];
  // The editable values are on Général and Codes: editing starts on Général from the other tabs.
  const startEditing = () => {
    editor.start();
    if (tab === "stats" || tab === "movements") setTab("general");
  };
  const photo = sheet.info?.images[0] ?? null;
  return (
    <SheetEditContext value={{ editor, sheet }}>
      {/* « Imprimer »: buttons, tabs and inputs stay on screen only; the open tab's name is printed. */}
      <div className="print:[&_[role=tablist]]:hidden print:[&_button]:hidden print:[&_input]:hidden">
        <Page
          above={<SheetBreadcrumb name={sheet.product} />}
          media={
            <ProductPhoto
              key={photo}
              src={photo}
              name={sheet.product}
              className="h-40 w-52 rounded-xl p-2 print:h-24 print:w-32"
            />
          }
          title={sheet.product}
          subtitle={<SheetMeta sheet={sheet} />}
          actions={
            <div className="flex flex-wrap items-start gap-3">
              <BarcodeCard code={sheet.barcode1} />
              <PrintButton disabled={editor.editing} />
              <EditActions editor={editor} onStart={startEditing} />
            </div>
          }
        >
          <TabBar
            tabs={tabs}
            activeId={tab}
            onChange={setTab}
            actions={
              tab === "stats" && (
                <StatsPeriodPicker period={period} onPeriod={setPeriod} range={range} onRange={setCustomRange} />
              )
            }
          />
          <h2 className="hidden text-lg font-semibold text-foreground print:block print:break-after-avoid">
            {tabs.find((x) => x.id === tab)?.label}
          </h2>
          {editor.editing && (
            <p className="rounded-lg border border-border bg-surface-subtle px-4 py-3 text-sm text-foreground">
              {t("products.editHint")}
            </p>
          )}
          {tab === "general" && <GeneralTab sheet={sheet} onShowMovements={() => setTab("movements")} />}
          {tab === "stats" && <StatsTab stats={stats} range={range} />}
          {tab === "movements" && <MovementsTab sheet={sheet} />}
          {tab === "codes" && <CodesTab sheet={sheet} />}
        </Page>
      </div>
    </SheetEditContext>
  );
}

/** A new product (« Scanner / Rechercher un code barre », browser back) starts fresh: not
 *  editing, Statistiques on 30 jours. */
export default function ProduitPage() {
  const { id } = useParams<{ id: string }>();
  return <ProductSheetPage key={id} id={Number(id)} />;
}
