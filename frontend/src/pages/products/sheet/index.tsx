/** /produits/:id — one product of the pharmacy: header (photo, PID / catégorie / TVA, badges,
 *  emplacement, code barre, « Observations »), then « Général », « Statistiques »,
 *  « Traçabilité », « Codes » and « Historique ». One date picker for the page, in the toolbar under
 *  the tabs (Général, Statistiques, Traçabilité). A product with observations opens their window first.
 *  Not one of its products → the 404 inside the layout (never says whether it exists elsewhere). */
import { useState } from "react";
import { ArrowLeftRight, BarChart3, Box, History, ScanLine } from "lucide-react";
import { useParams } from "react-router-dom";

import { FilterBar } from "@/_components/organisms/FilterBar";
import { PremiumDialog, type PremiumFeature } from "@/_components/organisms/PremiumDialog";
import { useMe } from "@/hooks/useMe";
import { Page } from "@/_components/templates/Page";
import { TabBar, type TabItem } from "@/_components/molecules/TabBar";
import NotFoundPage from "@/pages/auth/not-found";
import { useT } from "@/i18n/I18nProvider";
import { PERIOD_LABELS, type PeriodPreset } from "@/utils/dateRange";

import { ProductPhoto } from "../_components/ProductPhoto";
import { useScanner } from "../_components/useScanner";
import { CodesTab } from "./_components/CodesTab";
import { SheetEditContext } from "./_components/editContext";
import { SheetSkeleton } from "./_components/SheetSkeleton";
import { GeneralTab } from "./_components/GeneralTab";
import { HistoryTab } from "./_components/HistoryTab";
import { MovementsTab } from "./_components/MovementsTab";
import { NotesDialog } from "./_components/NotesDialog";
import { BackToList, SheetActions, SheetMeta } from "./_components/SheetHeader";
import { StatsTab } from "./_components/StatsTab";
import {
  useProductNotes,
  useProductStats,
  useProduitPage,
  useSheetEditor,
  useStatsRange,
  type SheetTab,
} from "./hooks";

/** A period button on (same look as « Mixte », the other segments of the app). */
const PERIOD_ON = "bg-primary text-primary-foreground shadow-sm";

function ProductSheetPage({ id }: { id: number }) {
  const t = useT();
  const { sheet, isLoading, notFound, tab, setTab } = useProduitPage(id);
  const editor = useSheetEditor(sheet);
  const { range, setRange, period, setPeriod } = useStatsRange();
  // « Étiquette » / « Commander » (premium): unlocked = in the account's effective permissions.
  const { me } = useMe();
  const has = (f: PremiumFeature) => !!me?.permissions.includes(f);
  const [premium, setPremium] = useState<PremiumFeature | null>(null);
  const { stats } = useProductStats(id, range, !!sheet);
  useScanner(); // a scan anywhere on the page → that product
  // « Observations »: their window opens with the page when there are some — once (switching tabs
  // does not reopen it); « Observations » in the header opens it again.
  // Decided once, when the sheet arrives: deleting the last note does not close the window.
  const [notesOpen, setNotesOpen] = useState<boolean | null>(null);
  if (notesOpen === null && sheet) setNotesOpen(sheet.notes_count > 0);
  const showNotes = notesOpen === true;
  const { notes, isLoading: notesLoading, addNote, isAdding, deleteNote, isDeleting } = useProductNotes(id, showNotes);

  if (notFound) return <NotFoundPage embedded />;
  if (isLoading || !sheet) {
    return <SheetSkeleton />;
  }

  const icon = "size-4";
  const tabs: TabItem<SheetTab>[] = [
    { id: "general", label: t("products.tabGeneral"), icon: <Box className={icon} /> },
    { id: "stats", label: t("products.tabStats"), icon: <BarChart3 className={icon} /> },
    { id: "movements", label: t("products.tabMovements"), icon: <ArrowLeftRight className={icon} /> },
    { id: "codes", label: t("products.tabCodes"), icon: <ScanLine className={icon} /> },
    { id: "history", label: t("products.tabHistory"), icon: <History className={icon} /> },
  ];
  const photo = sheet.info?.images[0] ?? null;
  return (
    <SheetEditContext value={{ editor, sheet }}>
      <Page
        above={<BackToList />}
        media={<ProductPhoto key={photo} src={photo} name={sheet.product} className="size-20 rounded-xl p-1.5" />}
        title={sheet.product}
        subtitle={<SheetMeta sheet={sheet} />}
        actions={<SheetActions sheet={sheet} onPremium={setPremium} onOpenNotes={() => setNotesOpen(true)} />}
      >
        <TabBar tabs={tabs} activeId={tab} onChange={setTab} />
        {/* The page dates: « Performance » (Général), Statistiques; Traçabilité has them in its own
            toolbar, with its search and filters. */}
        {(tab === "general" || tab === "stats") && (
          <FilterBar<PeriodPreset | "custom">
            dateRange={{ from: range.from, to: range.to, onChange: setRange }}
            segment={{
              value: period ?? "custom",
              onChange: (v) => v !== "custom" && setPeriod(v),
              options: PERIOD_LABELS.map(([value, label]) => ({ value, label: t(label), activeBg: PERIOD_ON })),
            }}
          />
        )}
        {tab === "general" && (
          <GeneralTab sheet={sheet} stats={stats} range={range} onShowMovements={() => setTab("movements")} />
        )}
        {tab === "stats" && <StatsTab stats={stats} range={range} />}
        {tab === "movements" && <MovementsTab sheet={sheet} range={range} onRange={setRange} />}
        {tab === "codes" && <CodesTab sheet={sheet} />}
        {tab === "history" && <HistoryTab id={sheet.id} />}
      </Page>
      <PremiumDialog feature={premium} unlocked={premium !== null && has(premium)} onClose={() => setPremium(null)} />
      <NotesDialog
        open={showNotes}
        product={sheet.product}
        notes={notes}
        isLoading={notesLoading}
        onAdd={addNote}
        isAdding={isAdding}
        onDelete={deleteNote}
        isDeleting={isDeleting}
        onClose={() => setNotesOpen(false)}
      />
    </SheetEditContext>
  );
}

/** A new product (« Scanner / Rechercher un code barre », browser back) starts fresh: not
 *  editing, the page dates on the current year. */
export default function ProduitPage() {
  const { id } = useParams<{ id: string }>();
  return <ProductSheetPage key={id} id={Number(id)} />;
}
