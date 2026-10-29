/** /produits-speciaux (feature `special_products`): what leaves Comptabilité, and only Comptabilité
 *  (every other page keeps everything). One tab per kind — Produits · Bons de livraison · Produit sur
 *  un BL · Fournisseurs — each in 2 steps: « 1. Cherchez … » (its search, one click « Exclure »,
 *  « Annuler » in the message) and « 2. … exclus » (its list: « Réintégrer », « Ajouter une note »).
 *  Nothing is deleted. */
import { useState } from "react";
import { Building2, FileText, ListChecks, Package, Search } from "lucide-react";

import { Page } from "@/_components/Page";
import { TabBar } from "@/_components/TabBar";
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
      <section className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 shadow-sm">
        <div className="flex flex-col gap-1">
          <h2 className="text-base font-semibold text-foreground">{t(`ps.find.${kind}`)}</h2>
          <p className="text-sm text-muted-foreground">{t(`ps.hint.${kind}`)}</p>
        </div>
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <input
            type="search"
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t(`ps.placeholder.${kind}`)}
            aria-label={t(`ps.find.${kind}`)}
            className="h-12 w-full rounded-xl border border-input bg-surface-subtle pl-12 pr-4 text-base text-foreground placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          />
        </div>
        {ready && kind === "product" && <ProductResults {...common} products={foundProducts} />}
        {ready && kind === "bl" && <BlResults {...common} bls={foundBls} />}
        {ready && kind === "line" && <LineResults {...common} products={foundProducts} onReintegrate={reintegrate} />}
        {ready && kind === "supplier" && <SupplierResults {...common} suppliers={foundSuppliers} />}
      </section>

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
