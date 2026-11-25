/** Single source of truth for the permission features rendered on the admin
 *  permission pages. Same keys as backend's ALLOWED_FEATURES (see models.py). */
import {
  LayoutDashboard,
  Upload,
  ShoppingCart,
  TrendingUp,
  Boxes,
  LineChart,
  Wallet,
  Bell,
  Star,
  Package,
  PackagePlus,
  PackageX,
  HandHeart,
  Printer,
  RefreshCw,
  type LucideIcon,
} from "lucide-react";

export type FeatureKey =
  | "rapports"
  | "import"
  | "achats"
  | "ventes"
  | "stock"
  | "analyse"
  | "accounting"
  | "alertes"
  | "special_products"
  | "produits"
  | "sobrus"
  | "labels"
  | "orders"
  | "damaged"
  | "promis";

export interface FeatureDef {
  key: FeatureKey;
  label: string;
  description: string;
  icon: LucideIcon;
  /** Owners only (« Connexion Sobrus »): not offered on an employee's accesses. */
  ownerOnly?: boolean;
  /** Premium (« Étiquette », « Commander »): OFF for a new pharmacy, the admin switches it on. */
  premium?: boolean;
}

// label/description hold i18n KEYS (adminFeat.*) — translate at render with t().
export const FEATURES: FeatureDef[] = [
  { key: "rapports", label: "adminFeat.rapports", description: "adminFeat.rapportsD", icon: LayoutDashboard },
  { key: "import", label: "adminFeat.import", description: "adminFeat.importD", icon: Upload },
  { key: "achats", label: "adminFeat.achats", description: "adminFeat.achatsD", icon: ShoppingCart },
  { key: "ventes", label: "adminFeat.ventes", description: "adminFeat.ventesD", icon: TrendingUp },
  { key: "stock", label: "adminFeat.stock", description: "adminFeat.stockD", icon: Boxes },
  { key: "analyse", label: "adminFeat.analyse", description: "adminFeat.analyseD", icon: LineChart },
  { key: "accounting", label: "adminFeat.accounting", description: "adminFeat.accountingD", icon: Wallet },
  { key: "alertes", label: "adminFeat.alertes", description: "adminFeat.alertesD", icon: Bell },
  { key: "special_products", label: "adminFeat.special", description: "adminFeat.specialD", icon: Star },
  { key: "produits", label: "adminFeat.produits", description: "adminFeat.produitsD", icon: Package },
  { key: "sobrus", label: "adminFeat.sobrus", description: "adminFeat.sobrusD", icon: RefreshCw, ownerOnly: true },
  { key: "damaged", label: "adminFeat.damaged", description: "adminFeat.damagedD", icon: PackageX },
  { key: "promis", label: "adminFeat.promis", description: "adminFeat.promisD", icon: HandHeart },
  { key: "labels", label: "adminFeat.labels", description: "adminFeat.labelsD", icon: Printer, premium: true },
  { key: "orders", label: "adminFeat.orders", description: "adminFeat.ordersD", icon: PackagePlus, premium: true },
];

export const FEATURE_KEYS: readonly FeatureKey[] = FEATURES.map((f) => f.key);

export const FEATURE_LABELS: Record<FeatureKey, string> = Object.fromEntries(
  FEATURES.map((f) => [f.key, f.label]),
) as Record<FeatureKey, string>;

/** Enabled-feature list (API shape) → full on/off record (toggle UI shape). */
export function toFeatureRecord(keys: readonly string[] | null | undefined): Record<FeatureKey, boolean> {
  const set = new Set(keys ?? []);
  const out = {} as Record<FeatureKey, boolean>;
  for (const k of FEATURE_KEYS) out[k] = set.has(k);
  return out;
}

/** Every feature set to `v` (Tout activer / Tout désactiver). */
export function allFeatures(v: boolean): Record<FeatureKey, boolean> {
  const out = {} as Record<FeatureKey, boolean>;
  for (const k of FEATURE_KEYS) out[k] = v;
  return out;
}

// Values are i18n KEYS — translate at render with t().
export const ROLE_LABEL = {
  owner: "adminFeat.roleOwner",
  employee: "adminFeat.roleEmployee",
  support: "roles.support",
  admin: "roles.admin",
} as const;
export const STATUS_LABEL = { active: "adminFeat.statusActive", inactive: "adminFeat.statusInactive" } as const;
