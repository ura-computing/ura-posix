/** Single source of truth for the 9 permission features rendered on the admin
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
  | "special_products";


export interface FeatureDef {
  key:         FeatureKey;
  label:       string;
  description: string;
  icon:        LucideIcon;
}


// label/description hold i18n KEYS (adminFeat.*) — translate at render with t().
export const FEATURES: FeatureDef[] = [
  { key: "rapports",         label: "adminFeat.rapports",   description: "adminFeat.rapportsD",   icon: LayoutDashboard },
  { key: "import",           label: "adminFeat.import",     description: "adminFeat.importD",     icon: Upload },
  { key: "achats",           label: "adminFeat.achats",     description: "adminFeat.achatsD",     icon: ShoppingCart },
  { key: "ventes",           label: "adminFeat.ventes",     description: "adminFeat.ventesD",     icon: TrendingUp },
  { key: "stock",            label: "adminFeat.stock",      description: "adminFeat.stockD",      icon: Boxes },
  { key: "analyse",          label: "adminFeat.analyse",    description: "adminFeat.analyseD",    icon: LineChart },
  { key: "accounting",       label: "adminFeat.accounting", description: "adminFeat.accountingD", icon: Wallet },
  { key: "alertes",          label: "adminFeat.alertes",    description: "adminFeat.alertesD",    icon: Bell },
  { key: "special_products", label: "adminFeat.special",    description: "adminFeat.specialD",    icon: Star },
];


export const FEATURE_LABELS: Record<FeatureKey, string> = Object.fromEntries(
  FEATURES.map((f) => [f.key, f.label]),
) as Record<FeatureKey, string>;


// Values are i18n KEYS — translate at render with t().
export const ROLE_LABEL = { owner: "adminFeat.roleOwner", employee: "adminFeat.roleEmployee" } as const;
export const STATUS_LABEL = { active: "adminFeat.statusActive", inactive: "adminFeat.statusInactive" } as const;
