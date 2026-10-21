/** /produits/:id — one product of the pharmacy: header (photo, PID / catégorie / TVA, badges,
 *  emplacement, code barre, « Observations », « Modifier »), then « Général », « Statistiques »,
 *  « Traçabilité », « Codes » and « Historique ». One date picker for the page, in the toolbar under
 *  the tabs (Général, Statistiques, Traçabilité). A product with observations opens their window first.
 *  Not one of its products → the 404 inside the layout (never says whether it exists elsewhere). */
import { useState } from "react";
import { ArrowLeftRight, BarChart3, Box, History, ScanLine } from "lucide-react";
import { useParams } from "react-router-dom";

import { FilterBar } from "@/_components/filterBar";
import { Page } from "@/_components/Page";
import { TabBar, type TabItem } from "@/_components/TabBar";
import NotFoundPage from "@/pages/auth/not-found";
import { useT } from "@/i18n/I18nProvider";

import { ProductPhoto } from "../_components/ProductPhoto";
import { useScanner } from "../_components/useScanner";
import { CodesTab } from "./_components/CodesTab";
import { SheetEditContext } from "./_components/editContext";
import { GeneralTab } from "./_components/GeneralTab";
import { HistoryTab } from "./_components/HistoryTab";
import { MovementsTab } from "./_components/MovementsTab";
import { NotesDialog } from "./_components/NotesDialog";
import { BackToList, EditActions, SheetFacts, SheetMeta } from "./_components/SheetHeader";
import { StatsTab } from "./_components/StatsTab";
import {
  useProductNotes,
  useProductStats,
  useProduitPage,
  useSheetEditor,
  useStatsRange,
  type SheetTab,
} from "./hooks";

function ProductSheetPage({ id }: { id: number }) {
  const t = useT();
  const { sheet, isLoading, notFound, tab, setTab } = useProduitPage(id);
  const editor = useSheetEditor(sheet);
  const { range, setRange } = useStatsRange();
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
    return <div className="py-10 text-center text-sm text-muted-foreground">{t("common.loading")}</div>;
  }

  const icon = "size-4";
  const tabs: TabItem<SheetTab>[] = [
    { id: "general", label: t("products.tabGeneral"), icon: <Box className={icon} /> },
    { id: "stats", label: t("products.tabStats"), icon: <BarChart3 className={icon} /> },
    { id: "movements", label: t("products.tabMovements"), icon: <ArrowLeftRight className={icon} /> },
    { id: "codes", label: t("products.tabCodes"), icon: <ScanLine className={icon} /> },
    { id: "history", label: t("products.tabHistory"), icon: <History className={icon} /> },
  ];
  // The editable values are on Général and Codes: editing starts on Général from the other tabs.
  const startEditing = () => {
    editor.start();
    if (tab === "stats" || tab === "movements") setTab("general");
  };
  const photo = sheet.info?.images[0] ?? null;
  return (
    <SheetEditContext value={{ editor, sheet }}>
      <Page
        above={<BackToList />}
        media={<ProductPhoto key={photo} src={photo} name={sheet.product} className="size-20 rounded-xl p-1.5" />}
        title={sheet.product}
        subtitle={<SheetMeta sheet={sheet} />}
        actions={<EditActions editor={editor} onStart={startEditing} />}
        below={
          <SheetFacts
            zone={sheet.stock.zone}
            barcode={sheet.barcode1}
            notes={sheet.notes_count}
            onOpenNotes={() => setNotesOpen(true)}
          />
        }
      >
        <TabBar tabs={tabs} activeId={tab} onChange={setTab} />
        {/* The page dates: « Performance » (Général), Statistiques; Traçabilité has them in its own
            toolbar, with its search and filters. */}
        {(tab === "general" || tab === "stats") && (
          <FilterBar dateRange={{ from: range.from, to: range.to, onChange: setRange }} />
        )}
        {editor.editing && (
          <p className="rounded-lg border border-border bg-surface-subtle px-4 py-3 text-sm text-foreground">
            {t("products.editHint")}
          </p>
        )}
        {tab === "general" && (
          <GeneralTab sheet={sheet} stats={stats} range={range} onShowMovements={() => setTab("movements")} />
        )}
        {tab === "stats" && <StatsTab stats={stats} range={range} />}
        {tab === "movements" && <MovementsTab sheet={sheet} range={range} onRange={setRange} />}
        {tab === "codes" && <CodesTab sheet={sheet} />}
        {tab === "history" && <HistoryTab id={sheet.id} />}
      </Page>
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
