/** A store model (Lumière, Classique, Moderne, Apothéose, Élégance): its look around the pharmacy's 3 colors, its
 *  fonts, its photo and its own top of the home page. Every model shows the same 4 pages (`storefront/ui/*`), drawn
 *  with the CSS variables below: `bg-[var(--sf-surface)]`, `font-[family-name:var(--sf-font-display)]`. */
import type { ComponentType, CSSProperties } from "react";

import type { FontPairing } from "@/types/storeWebsite";

import type { SectionConfig, TemplateCustomization, TemplateProps } from "../templates/_shared/customizationTypes";

/** What every page of the store receives: the data, the customization, and the model to draw with. */
export type PageProps = TemplateProps & { model: StoreModel };

/** One home section: its texts and switch (`section`). */
export type SectionProps = PageProps & { section: SectionConfig };

export interface StoreModel {
  look: {
    /** The page behind everything. */
    page: string;
    /** Cards, the header on scroll. */
    surface: string;
    /** Every other home section (`transparent`: none). */
    tint: string;
    ink: string;
    inkSoft: string;
    line: string;
    /** Text on the pharmacy's main color (buttons). */
    onPrimary: string;
    radius: string;
    buttonRadius: string;
    shadow: string;
  };
  fonts: Record<FontPairing, { display: string; body: string }>;
  /** A free photo (Unsplash license): the contact band, and the hero of the models that show one. */
  photo: string;
  Hero: ComponentType<SectionProps>;
  /** Drawn behind the whole page (Lumière's blooms). */
  Decor?: ComponentType;
}

/** The CSS variables of a model + the pharmacy's colors, on the store's outer `div`. */
export function modelVars(model: StoreModel, c: TemplateCustomization): CSSProperties {
  const { look } = model;
  const fonts = model.fonts[c.fontPairing];
  return {
    "--sf-primary": c.brandColors.primary,
    "--sf-secondary": c.brandColors.secondary,
    "--sf-accent": c.brandColors.accent,
    "--sf-page": look.page,
    "--sf-surface": look.surface,
    "--sf-tint": look.tint,
    "--sf-ink": look.ink,
    "--sf-ink-soft": look.inkSoft,
    "--sf-line": look.line,
    "--sf-on-primary": look.onPrimary,
    "--sf-radius": look.radius,
    "--sf-button-radius": look.buttonRadius,
    "--sf-shadow": look.shadow,
    "--sf-font-display": fonts.display,
    "--sf-font-body": fonts.body,
    "--sf-font-mono": "'JetBrains Mono', monospace",
  } as CSSProperties;
}

/** An Unsplash photo at the width shown. */
export const unsplash = (id: string, width = 1600) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${width}&q=70`;
