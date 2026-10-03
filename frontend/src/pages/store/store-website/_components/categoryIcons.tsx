import {
  Baby,
  Leaf,
  Pill,
  Droplet,
  SprayCan,
  Sparkles,
  Sun,
  Smile,
  Stethoscope,
  Sprout,
  Heart,
  Dumbbell,
  type LucideIcon,
} from "lucide-react";

/** The 12 fixed storefront-category icons. Professional lucide SVGs (no
 *  emoji). Keys are stored on `StoreCategory.icon`; both Tab 2 + the dev
 *  editor render from this single registry. */
export const CATEGORY_ICONS: { key: string; label: string; Icon: LucideIcon }[] = [
  { key: "bebe", label: "Soins bébé", Icon: Baby },
  { key: "bienetre", label: "Bien-être", Icon: Leaf },
  { key: "vitamines", label: "Vitamines", Icon: Pill },
  { key: "soins", label: "Soins", Icon: Droplet },
  { key: "hygiene", label: "Hygiène", Icon: SprayCan },
  { key: "beaute", label: "Beauté", Icon: Sparkles },
  { key: "solaire", label: "Solaire", Icon: Sun },
  { key: "bucco", label: "Bucco-dentaire", Icon: Smile },
  { key: "materiel", label: "Matériel médical", Icon: Stethoscope },
  { key: "bio", label: "Bio / naturel", Icon: Sprout },
  { key: "maman", label: "Maman", Icon: Heart },
  { key: "sport", label: "Sport", Icon: Dumbbell },
];

export const CATEGORY_ICON_MAP: Record<string, LucideIcon> = Object.fromEntries(
  CATEGORY_ICONS.map((i) => [i.key, i.Icon]),
);

export function CategoryIcon({ name, className }: { name: string; className?: string }) {
  const Icon = CATEGORY_ICON_MAP[name] ?? Leaf;
  return <Icon className={className} />;
}
