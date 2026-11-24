/** Every page of the app, for the specs that check all of them (24-matrix): who opens it, the switch that hides it,
 *  the GET that fills it. A new page = one line here, and every generic check covers it.
 *  The online store's Support pages (/admin/boutiques…): Support only (no opener here → 404 for everyone below),
 *  checked in 09-boutique with the store's own pages. A product sheet (/produits/:id): 18. */

/** The accounts that open pages. An employee has every permission unless a test removes one. */
export type Opener = "owner" | "employee" | "admin";
export const OPENERS: Opener[] = ["owner", "employee", "admin"];

export interface AppPage {
  path: string;
  /** Its title (h1), in French. */
  title: string;
  /** Its link in the sidebar; null = reached from another page (« Importer » → /upload-file). */
  nav: string | null;
  /** The pharmacy feature (admin switch, employee permission) that shows it; null = by role only. */
  feature: string | null;
  /** Who opens it → the GET that fills the page for them, with the query it needs (null: nothing to load).
   *  Anyone else: no menu entry, 404 inside the layout. */
  open: Partial<Record<Opener, string | null>>;
}

const DATA = (main: string) => ({ owner: main, employee: main });

export const PAGES: AppPage[] = [
  {
    path: "/rapport",
    title: "Tableau de bord",
    nav: "Tableau de bord",
    feature: "rapports",
    open: { ...DATA("/stats"), admin: "/admin/stats" },
  },
  { path: "/achats", title: "Achats", nav: "Achats", feature: "achats", open: DATA("/achats") },
  { path: "/ventes", title: "Ventes", nav: "Ventes", feature: "ventes", open: DATA("/ventes") },
  { path: "/stock", title: "Stock", nav: "Stock", feature: "stock", open: DATA("/stats/stock-abcd") },
  { path: "/produits", title: "Produits", nav: "Produits", feature: "produits", open: DATA("/products") },
  {
    path: "/analyses",
    title: "Analyse de marge",
    nav: "Analyses",
    feature: "analyse",
    open: DATA("/stats/analyse-marge?mode=produit"),
  },
  { path: "/alertes", title: "Alertes", nav: "Alertes", feature: "alertes", open: DATA("/stats/margin-alerts") },
  {
    path: "/comptabilite",
    title: "Comptabilité",
    nav: "Comptabilité",
    feature: "accounting",
    open: DATA("/accounting/payments"),
  },
  {
    path: "/produits-speciaux",
    title: "Produits spéciaux",
    nav: "Produits spéciaux",
    feature: "special_products",
    open: DATA("/special-products/"),
  },
  {
    path: "/imports",
    title: "Gestion des imports",
    nav: "Gestion des imports",
    feature: "import",
    open: { ...DATA("/data/imports"), admin: "/data/imports" },
  },
  {
    path: "/upload-file",
    title: "Importer un fichier",
    nav: null,
    feature: "import",
    open: { owner: null, employee: null, admin: null },
  },
  {
    path: "/sobrus",
    title: "Connexion Sobrus",
    nav: "Connexion Sobrus",
    feature: "sobrus",
    open: { owner: "/sobrus/connection" }, // connected or not (the runs: only once connected)
  },
  {
    path: "/owner/employees",
    title: "Gérer mon équipe",
    nav: "Gérer mon équipe",
    feature: null,
    open: { owner: "/owner/employees" },
  },
  {
    path: "/historique",
    title: "Historique des modifications",
    nav: "Historique",
    feature: null,
    open: { owner: "/history" },
  },
  {
    path: "/ma-boutique",
    title: "Ma boutique en ligne",
    nav: "Ma boutique en ligne",
    feature: null,
    open: { owner: "/store-website/my-request" },
  },
  {
    path: "/admin/boutiques",
    title: "Boutiques en ligne",
    nav: null,
    feature: null,
    open: {}, // Support only (09-boutique): the admin, the owner, the employee get the 404
  },
  {
    path: "/auth/me",
    title: "Mon compte",
    nav: "Mon compte",
    feature: null,
    open: { owner: null, employee: null, admin: null },
  },
  {
    path: "/admin/pharmacies",
    title: "Pharmacies et utilisateurs",
    nav: "Pharmacies et utilisateurs",
    feature: null,
    open: { admin: "/admin/pharmacies" },
  },
  {
    path: "/admin/catalogue",
    title: "Catalogue médicaments",
    nav: "Catalogue",
    feature: null,
    open: { admin: "/admin/catalog" },
  },
  {
    path: "/admin/categories",
    title: "Catégories",
    nav: "Catégories",
    feature: null,
    open: { admin: "/category-suffixes" },
  },
];

/** The pages `who` opens, each with its main GET. */
export const pagesOf = (who: Opener): (AppPage & { main: string | null })[] =>
  PAGES.filter((p) => who in p.open).map((p) => ({ ...p, main: p.open[who] ?? null }));

/** « /stats/analyse-marge?mode=produit » → its path and query. */
export function splitGet(main: string): { path: string; params: Record<string, string> } {
  const [path, query = ""] = main.split("?");
  return { path, params: Object.fromEntries(new URLSearchParams(query)) };
}
