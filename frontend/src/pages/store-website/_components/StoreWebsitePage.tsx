import { useState } from "react";

import { TabBar, type TabItem } from "@/components/shared/TabBar";

import { CategoriesTab, type CategoriesTabProps } from "./CategoriesTab";
import { DemandeTab, type DemandeTabProps } from "./DemandeTab";
import { ProduitsVisiblesTab, type ProduitsVisiblesTabProps } from "./ProduitsVisiblesTab";


/** Owner-facing shell for /store-website. 3 tabs, deep-linkable via `?tab=`.
 *  Each tab is independent — the parent passes typed props per tab; the
 *  shell only owns the active-tab state. */

export type StoreTab = "demande" | "categories" | "produits";

export interface StoreWebsitePageProps {
  initialTab?: StoreTab;
  demande:    DemandeTabProps;
  categories: CategoriesTabProps;
  produits:   ProduitsVisiblesTabProps;
}


const TABS: TabItem[] = [
  { id: "demande",    label: "Demande" },
  { id: "categories", label: "Catégories" },
  { id: "produits",   label: "Produits visibles" },
];


export function StoreWebsitePage({
  initialTab = "demande", demande, categories, produits,
}: StoreWebsitePageProps) {
  const [tab, setTab] = useState<StoreTab>(initialTab);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Ma boutique en ligne</h1>
        <p className="text-sm text-muted-foreground">Gérez la vitrine en ligne de votre pharmacie.</p>
      </header>

      <TabBar tabs={TABS} activeId={tab} onChange={(id) => setTab(id as StoreTab)} />

      {tab === "demande"    && <DemandeTab {...demande} />}
      {tab === "categories" && <CategoriesTab {...categories} />}
      {tab === "produits"   && <ProduitsVisiblesTab {...produits} />}
    </div>
  );
}
