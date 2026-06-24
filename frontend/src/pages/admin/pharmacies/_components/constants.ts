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
  FileMinus,
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
  | "bl_exclusions"
  | "special_products";


export interface FeatureDef {
  key:         FeatureKey;
  label:       string;
  description: string;
  icon:        LucideIcon;
}


export const FEATURES: FeatureDef[] = [
  { key: "rapports",         label: "Rapports",           description: "Tableau de bord : KPIs, marges, alertes",                       icon: LayoutDashboard },
  { key: "import",           label: "Import",             description: "Importer les CSV Sobrus (achats, ventes, stock)",               icon: Upload },
  { key: "achats",           label: "Achats",             description: "Consulter le journal des achats fournisseurs",                  icon: ShoppingCart },
  { key: "ventes",           label: "Ventes",             description: "Consulter le journal des ventes",                               icon: TrendingUp },
  { key: "stock",            label: "Stock",              description: "État du stock, classification ABCD, péremptions",               icon: Boxes },
  { key: "analyse",          label: "Analyse",            description: "Analyses de marge avancées",                                    icon: LineChart },
  { key: "accounting",       label: "Comptabilité",       description: "Paiements (TPE/Espèces/Chèques/Virement) + KPIs comptables",   icon: Wallet },
  { key: "bl_exclusions",    label: "Exclusions BL",      description: "Exclure des bons de livraison de l'analyse",                    icon: FileMinus },
  { key: "special_products", label: "Produits spéciaux",  description: "Exclure des produits du calcul des marges",                     icon: Star },
];


export const FEATURE_LABELS: Record<FeatureKey, string> = Object.fromEntries(
  FEATURES.map((f) => [f.key, f.label]),
) as Record<FeatureKey, string>;


export const ROLE_LABEL = { owner: "Propriétaire", employee: "Employé" } as const;
export const STATUS_LABEL = { active: "Actif", inactive: "Inactif" } as const;
