/** Mocked fixtures for "Ma boutique en ligne" — single source of truth for
 *  the demo. Owner/dev/admin pages all read from here for v1; backend wiring
 *  comes later.
 *
 *  Conventions:
 *    - 2 named developers ("Yassir Benali" + "Mehdi Tazi"), per the locked
 *      memory decision. The "logged-in dev" used by the dashboard is Yassir.
 *    - All 5 request states are represented across the dev's queue so every
 *      visual treatment is reachable from the demo.
 *    - Mock data is INTENTIONALLY in-memory + non-mutating; pages that need
 *      to simulate "updates" do so in local component state. */

import type {
  DevRequest, DevKpis, DeveloperAccount, EditorSection, ExportRow,
  PastRequest, RequestBrief, StoreCategory, StoreTemplate,
  VisibleProduct, WebsiteRequest,
} from "@/types/storeWebsite";


// ── Developers ──────────────────────────────────────────────────────────────

export const MOCK_ME_DEVELOPER = {
  id:   "dev-1",
  name: "Yassir Benali",
} as const;

export const MOCK_OTHER_DEVELOPER = {
  id:   "dev-2",
  name: "Mehdi Tazi",
} as const;

export const MOCK_DEVELOPER_ACCOUNTS: DeveloperAccount[] = [
  {
    id:             "dev-1",
    name:           "Yassir Benali",
    email:          "dev@gmail.com",
    status:         "actif",
    activeRequests: 2,
    lastActiveAt:   "2026-06-27T08:30:00Z",
  },
  {
    id:             "dev-2",
    name:           "Mehdi Tazi",
    email:          "mehdi.tazi@apcm.local",
    status:         "actif",
    activeRequests: 1,
    lastActiveAt:   "2026-06-26T17:12:00Z",
  },
];


// ── Owner request (the one belonging to the logged-in owner) ────────────────

/** The active request on the current owner's pharmacy. Drives `/store-website`
 *  Tab 1. Default state is `soumise` so SOLDE editing is unlocked and the
 *  owner can interact with all flows; flip the state below to demo other
 *  banner colors + edit/cancel disabled states. */
export const MOCK_ACTIVE_REQUEST: WebsiteRequest = {
  id:           "req-1",
  storeName:    "Pharmacie Demo",
  slogan:       "Votre santé, notre engagement.",
  logoUrl:      null,
  brand:        { palette: ["#0E9E8C", "#34CBB7", "#F59E0B"] },
  phone:        "0600000001",
  customDomain: null,
  urgency:      "ce_mois",
  vision:       "Une boutique élégante, claire, qui inspire confiance. Mettre en avant nos soins bébé et la parapharmacie.",
  template:     null,
  state:        "soumise",
  timeline: [
    { state: "soumise",         reachedAt: "2026-06-25T09:00:00Z" },
    { state: "prise_en_charge", reachedAt: null },
    { state: "en_cours",        reachedAt: null },
    { state: "livree",          reachedAt: null },
    { state: "cloturee",        reachedAt: null },
  ],
  developerName: null,
  createdAt:     "2026-06-25T09:00:00Z",
  deliverable:   null,
};

export const MOCK_PAST_REQUESTS: PastRequest[] = [
  {
    id:         "past-1",
    storeName:  "Pharmacie Demo v1",
    brandColor: "#0E9E8C",
    logoUrl:    null,
    template:   "classique",
    createdAt:  "2025-12-10T11:00:00Z",
  },
];


// ── Owner categories ────────────────────────────────────────────────────────

export const MOCK_STORE_CATEGORIES: StoreCategory[] = [
  {
    id:                 "cat-default",
    name:               "Autres",
    description:        "Produits sans catégorie attribuée.",
    icon:               "vitamines",
    color:              "#0E9E8C",
    productCount:       42,
    updatedByDeveloper: false,
    isDefault:          true,
  },
  {
    id:                 "cat-bebe",
    name:               "Soins bébé",
    description:        "Tout pour les nourrissons et enfants en bas âge.",
    icon:               "bebe",
    color:              "#EC4899",
    productCount:       18,
    updatedByDeveloper: false,
  },
  {
    id:                 "cat-bien-etre",
    name:               "Bien-être",
    description:        "Compléments alimentaires, vitamines, énergie.",
    icon:               "bienetre",
    color:              "#10B981",
    productCount:       24,
    updatedByDeveloper: true,         // recently edited by developer → badge
  },
  {
    id:                 "cat-soin-quotidien",
    name:               "Soins quotidiens",
    description:        "Hygiène, dentaire, soins du visage.",
    icon:               "hygiene",
    color:              "#34CBB7",
    productCount:       31,
    updatedByDeveloper: false,
  },
];


// ── Owner visible products ──────────────────────────────────────────────────

export const MOCK_VISIBLE_PRODUCTS: VisibleProduct[] = [
  { id: "p-1",  name: "Doliprane 1000mg",     sobrusCategory: "Médicament",   storeCategoryId: "cat-soin-quotidien", stock: 42, ppv: 28.50, solde: null,  visible: true },
  { id: "p-2",  name: "Sirop Strepsils",      sobrusCategory: "Médicament",   storeCategoryId: "cat-soin-quotidien", stock:  4, ppv: 45.00, solde: 38.00, visible: true },
  { id: "p-3",  name: "Vitamine C 1000",      sobrusCategory: "Parapharmacie", storeCategoryId: "cat-bien-etre",      stock: 18, ppv: 64.00, solde: null,  visible: true },
  { id: "p-4",  name: "Biberon Avent 260ml",  sobrusCategory: "Parapharmacie", storeCategoryId: "cat-bebe",           stock:  0, ppv: 89.00, solde: null,  visible: true },
  { id: "p-5",  name: "Crème solaire SPF 50", sobrusCategory: "Parapharmacie", storeCategoryId: null,                 stock: 12, ppv: 120.00, solde: 95.00, visible: true },
  { id: "p-6",  name: "Aspégic 1000",         sobrusCategory: "Médicament",   storeCategoryId: "cat-soin-quotidien", stock:  3, ppv: 22.00, solde: null,  visible: false },
  { id: "p-7",  name: "Smecta sachets",       sobrusCategory: "Médicament",   storeCategoryId: "cat-bebe",           stock: 25, ppv: 31.00, solde: null,  visible: true },
  { id: "p-8",  name: "Magnésium B6",         sobrusCategory: "Parapharmacie", storeCategoryId: "cat-bien-etre",      stock:  9, ppv: 55.00, solde: 44.00, visible: true },
];


// ── Developer side: KPIs + queues ──────────────────────────────────────────

export const MOCK_DEV_KPIS: DevKpis = {
  pending:          3,
  mineActive:       2,
  exportsThisMonth: 5,
};

/** Mix of states across pharmacies so every queue section is populated:
 *   - pending (claimable):              req-a, req-b, req-c
 *   - claimed by me (Yassir):           req-d (en_cours), req-e (prise_en_charge)
 *   - claimed by Mehdi (read-only):     req-f */
export const MOCK_DEV_REQUESTS: DevRequest[] = [
  {
    id: "req-a", pharmacyName: "Pharmacie Atlas",     brandColor: "#0E9E8C",
    submittedAt: "2026-06-26T10:00:00Z", urgency: "asap",
    state: "soumise", claimedBy: null, claimedAt: null,
  },
  {
    id: "req-b", pharmacyName: "Pharmacie Centrale",  brandColor: "#8B5CF6",
    submittedAt: "2026-06-26T14:30:00Z", urgency: "ce_mois",
    state: "soumise", claimedBy: null, claimedAt: null,
  },
  {
    id: "req-c", pharmacyName: "Pharmacie El Manar",  brandColor: "#F59E0B",
    submittedAt: "2026-06-27T07:15:00Z", urgency: "flexible",
    state: "soumise", claimedBy: null, claimedAt: null,
  },
  {
    id: "req-d", pharmacyName: "Pharmacie Demo",      brandColor: "#0E9E8C",
    submittedAt: "2026-06-25T09:00:00Z", urgency: "ce_mois",
    state: "en_cours",
    claimedBy: MOCK_ME_DEVELOPER,
    claimedAt: "2026-06-25T15:00:00Z",
  },
  {
    id: "req-e", pharmacyName: "Pharmacie Bouskoura", brandColor: "#EC4899",
    submittedAt: "2026-06-24T11:00:00Z", urgency: "asap",
    state: "prise_en_charge",
    claimedBy: MOCK_ME_DEVELOPER,
    claimedAt: "2026-06-26T09:00:00Z",
  },
  {
    id: "req-f", pharmacyName: "Pharmacie Maarif",    brandColor: "#3B82F6",
    submittedAt: "2026-06-23T16:00:00Z", urgency: "ce_mois",
    state: "en_cours",
    claimedBy: MOCK_OTHER_DEVELOPER,
    claimedAt: "2026-06-24T08:30:00Z",
  },
];

/** Briefs the dev sees when opening a request. Only the dev's own claimed
 *  requests get a full brief; pending ones use a slimmer one. */
export const MOCK_REQUEST_BRIEFS: Record<string, RequestBrief> = {
  "req-d": {
    id:           "req-d",
    pharmacyName: "Pharmacie Demo",
    ownerName:    "Propriétaire Demo",
    ownerPhone:   "0600000001",
    storeName:    "Pharmacie Demo",
    slogan:       "Votre santé, notre engagement.",
    logoUrl:      null,
    brandPalette: ["#0E9E8C", "#34CBB7", "#F59E0B"],
    customDomain: null,
    urgency:      "ce_mois",
    vision:       "Une boutique élégante, claire, qui inspire confiance. Mettre en avant nos soins bébé et la parapharmacie.",
    state:        "en_cours",
    claimedByMe:  true,
    categories: [
      { id: "cat-soin-quotidien", name: "Soins quotidiens", productCount: 31 },
      { id: "cat-bien-etre",      name: "Bien-être",        productCount: 24 },
      { id: "cat-bebe",           name: "Soins bébé",       productCount: 18 },
    ],
    soldes: [
      { id: "p-2", name: "Sirop Strepsils",      ppv: 45,  solde: 38 },
      { id: "p-5", name: "Crème solaire SPF 50", ppv: 120, solde: 95 },
      { id: "p-8", name: "Magnésium B6",         ppv: 55,  solde: 44 },
    ],
  },
};


// ── Editor section defaults ─────────────────────────────────────────────────

export const DEFAULT_EDITOR_SECTIONS: EditorSection[] = [
  { key: "hero",                 visible: true  },
  { key: "brands",               visible: true  },
  { key: "catalogue",            visible: true  },
  { key: "soldes",               visible: true  },
  { key: "featured_categories",  visible: true  },
  { key: "testimonials",         visible: false },
  { key: "contact",              visible: true  },
  { key: "footer",               visible: true  },
];


// ── Past exports ────────────────────────────────────────────────────────────

export const MOCK_EXPORTS: ExportRow[] = [
  {
    id: "exp-1", pharmacyName: "Pharmacie Demo", brandColor: "#0E9E8C",
    template: "classique" as StoreTemplate,
    exportedAt: "2026-06-26T18:32:00Z",
    sizeBytes: 4_823_104,
    downloadUrl: "#",
  },
  {
    id: "exp-2", pharmacyName: "Pharmacie Maarif", brandColor: "#3B82F6",
    template: "moderne",
    exportedAt: "2026-06-25T11:18:00Z",
    sizeBytes: 5_120_512,
    downloadUrl: "#",
  },
  {
    id: "exp-3", pharmacyName: "Pharmacie Atlas", brandColor: "#0E9E8C",
    template: "lumiere",
    exportedAt: "2026-06-24T16:45:00Z",
    sizeBytes: 4_980_736,
    downloadUrl: "#",
  },
];


// ── Helpers ─────────────────────────────────────────────────────────────────

/** Look up a brief by request id (returns the canonical brief or a stub
 *  built from the dev-request row). Used by the dev's request-detail page. */
export function getMockBrief(requestId: string): RequestBrief | null {
  const explicit = MOCK_REQUEST_BRIEFS[requestId];
  if (explicit) return explicit;
  const row = MOCK_DEV_REQUESTS.find((r) => r.id === requestId);
  if (!row) return null;
  return {
    id:           row.id,
    pharmacyName: row.pharmacyName,
    ownerName:    "Propriétaire",
    ownerPhone:   "0600000000",
    storeName:    row.pharmacyName,
    slogan:       "",
    logoUrl:      null,
    brandPalette: [row.brandColor],
    customDomain: null,
    urgency:      row.urgency,
    vision:       "",
    state:        row.state,
    claimedByMe:  row.claimedBy?.id === MOCK_ME_DEVELOPER.id,
    categories:   [],
    soldes:       [],
  };
}
