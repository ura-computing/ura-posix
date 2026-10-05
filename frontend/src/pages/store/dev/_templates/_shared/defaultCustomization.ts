import type { StoreTemplate } from "@/types/storeWebsite";

import type { SectionConfig, TemplateCustomization } from "./customizationTypes";

const HERO_COPY = {
  title: "Votre pharmacie de confiance",
  subtitle: "Livraison rapide et conseils personnalisés pour votre santé.",
  cta: "Découvrir la boutique",
};

/** Home-page section defaults. Order = display order (y ascending).
 *  Each section spans the full width (w:12); heights are approximate. */
export const DEFAULT_SECTIONS: SectionConfig[] = [
  {
    key: "hero",
    visible: true,
    layout: { i: "hero", x: 0, y: 0, w: 12, h: 18, static: true },
    content: HERO_COPY,
  },
  {
    key: "brands",
    visible: true,
    layout: { i: "brands", x: 0, y: 18, w: 12, h: 4 },
    content: { title: "Nos marques de confiance" },
  },
  {
    key: "catalogue",
    visible: true,
    layout: { i: "catalogue", x: 0, y: 22, w: 12, h: 10 },
    content: {
      title: "Explorez par catégorie",
      sub: "Trouvez ce dont vous avez besoin en un clin d'œil.",
    },
  },
  {
    key: "soldes",
    visible: true,
    layout: { i: "soldes", x: 0, y: 32, w: 12, h: 12 },
    content: { title: "SOLDES en cours", sub: "Des prix doux, cette semaine." },
  },
  {
    key: "featured_categories",
    visible: true,
    layout: { i: "featured_categories", x: 0, y: 44, w: 12, h: 12 },
    content: {
      title: "Produits en vedette",
      sub: "Sélection de la pharmacienne.",
    },
  },
  {
    key: "testimonials",
    visible: true,
    layout: { i: "testimonials", x: 0, y: 56, w: 12, h: 6 },
    content: { title: "Ils nous font confiance" },
  },
  {
    key: "contact",
    visible: true,
    layout: { i: "contact", x: 0, y: 62, w: 12, h: 10 },
    content: {
      title: "Nous trouver",
      sub: "Ouvert du lundi au samedi, 8h—20h.",
      body: "Depuis vingt ans, nous accompagnons les familles du quartier avec attention, écoute et conseils personnalisés.",
    },
  },
  {
    key: "footer",
    visible: true,
    layout: { i: "footer", x: 0, y: 72, w: 12, h: 6 },
    content: { title: "" },
  },
];

/** Per-template default customization. Palettes are tuned to each
 *  template's visual personality (Lumière is airy pastels, Apothéose will
 *  be dark + gold, etc.). */
const PALETTES: Record<StoreTemplate, TemplateCustomization["brandColors"]> = {
  lumiere: { primary: "#1FA97E", secondary: "#F4C9D9", accent: "#E9C887" },
  classique: { primary: "#3D5A3B", secondary: "#D9C7A5", accent: "#8C6A3F" },
  moderne: { primary: "#0F172A", secondary: "#64748B", accent: "#F97316" },
  apotheose: { primary: "#0A0A0A", secondary: "#C7A662", accent: "#F5E6C9" },
  elegance: { primary: "#1E293B", secondary: "#7C3AED", accent: "#F59E0B" },
};

const FONTS: Record<StoreTemplate, TemplateCustomization["fontPairing"]> = {
  lumiere: "moderne",
  classique: "classique",
  moderne: "moderne",
  apotheose: "classique",
  elegance: "editorial",
};

export function defaultCustomization(template: StoreTemplate): TemplateCustomization {
  return {
    brandColors: PALETTES[template],
    fontPairing: FONTS[template],
    logoUrl: null,
    sections: DEFAULT_SECTIONS.map((s) => ({
      ...s,
      content: { ...s.content },
    })),
    featuredCategoryIds: [],
  };
}
