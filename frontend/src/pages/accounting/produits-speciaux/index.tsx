/** /produits-speciaux (feature `special_products`): what leaves Comptabilité, and only Comptabilité
 *  (every other page keeps everything). One tab per kind — Produits · Bons de livraison · Produit sur
 *  un BL · Fournisseurs — each in 2 steps: « 1. Cherchez … » (its search, one click « Exclure »,
 *  « Annuler » in the message) and « 2. … exclus » (its list: « Réintégrer », « Ajouter une note »).
 *  Nothing is deleted. */
import { useState } from "react";
import { Building2, FileText, ListChecks, Package } from "lucide-react";

import { Page } from "@/_components/Page";
import { TabBar } from "@/_components/TabBar";
import { Card } from "@/_components/atoms/Card";
import { SearchInput } from "@/_components/atoms/Input";
import { useT } from "@/i18n/I18nProvider";

import { ExcludedList } from "./_components/ExcludedList";
import { BlResults, LineResults, ProductResults, SupplierResults } from "./_components/SearchResults";
import { useExclusionSearch, useExclusions, type ExclusionKind } from "./hooks";

/** One tab: « 1. Cherchez … », its results; « 2. … exclus ». Mounted per tab: its search starts empty. */
function KindTab({ kind }: { kind: ExclusionKind }) {
  const t = useT();
  const { q, setQ, ready, foundProducts, foundBls, foundSuppliers, isSearching } = useExclusionSearch(kind);
  const { excludedRows, excludedLoading, exclude, isExcluding, reintegrate, isReintegrating, saveNote } =
    useExclusions();
  const common = { q: q.trim(), isSearching, isExcluding, onExclude: exclude };

  return (
    <div className="flex flex-col gap-6">
      <Card className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-base font-semibold text-foreground">{t(`ps.find.${kind}`)}</h2>
          <p className="text-sm text-muted-foreground">{t(`ps.hint.${kind}`)}</p>
        </div>
        <SearchInput
          autoFocus
          value={q}
          onValueChange={setQ}
          placeholder={t(`ps.placeholder.${kind}`)}
          aria-label={t(`ps.find.${kind}`)}
        />
        {ready && kind === "product" && <ProductResults {...common} products={foundProducts} />}
        {ready && kind === "bl" && <BlResults {...common} bls={foundBls} />}
        {ready && kind === "line" && <LineResults {...common} products={foundProducts} onReintegrate={reintegrate} />}
        {ready && kind === "supplier" && <SupplierResults {...common} suppliers={foundSuppliers} />}
      </Card>

      <ExcludedList
        kind={kind}
        rows={excludedRows}
        isLoading={excludedLoading}
        isReintegrating={isReintegrating}
        onReintegrate={reintegrate}
        onSaveNote={saveNote}
      />
    </div>
  );
}

export default function ProduitsSpeciauxPage() {
  const t = useT();
  const [tab, setTab] = useState<ExclusionKind>("product");
  return (
    <Page title={t("nav.produitsSpeciaux")} subtitle={t("ps.subtitle")}>
      <TabBar<ExclusionKind>
        tabs={[
          { id: "product", label: t("ps.tab.product"), icon: <Package className="size-4" /> },
          { id: "bl", label: t("ps.tab.bl"), icon: <FileText className="size-4" /> },
          { id: "line", label: t("ps.tab.line"), icon: <ListChecks className="size-4" /> },
          { id: "supplier", label: t("ps.tab.supplier"), icon: <Building2 className="size-4" /> },
        ]}
        activeId={tab}
        onChange={setTab}
      />
      <KindTab key={tab} kind={tab} />
    </Page>
  );
}
