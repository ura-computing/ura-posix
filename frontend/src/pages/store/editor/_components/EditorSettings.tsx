/** The store editor's left column, only app pieces: « Enregistrement automatique » and the home-page sections are
 *  `SwitchCard`s (like the admin « Fonctionnalités »), the model and the font are `ChoiceCard`s, the colors
 *  `ColorField`s, the logo a `FileDropZone`. Every change calls `onPatch`; the logo is sent at once. */
import {
  BadgeCheck,
  Gift,
  Image,
  LayoutGrid,
  MapPin,
  PanelBottom,
  Percent,
  Save,
  Star,
  type LucideIcon,
} from "lucide-react";

import { Badge } from "@/_components/atoms/Badge";
import { ColorSwatch } from "@/_components/atoms/ColorSwatch";
import { Spinner } from "@/_components/atoms/Spinner";
import { ChoiceCard } from "@/_components/molecules/ChoiceCard";
import { ColorField } from "@/_components/molecules/ColorField";
import { FileDropZone } from "@/_components/molecules/FileDropZone";
import { SectionCard } from "@/_components/molecules/SectionCard";
import { SwitchCard } from "@/_components/molecules/SwitchCard";
import { apiUrl } from "@/api/client";
import { useT } from "@/i18n/I18nProvider";
import {
  EDITOR_SECTION_LABEL,
  FONT_PAIRINGS,
  TEMPLATE_LABEL,
  TEMPLATES,
  type CustomizationOut,
  type CustomizationPatch,
  type EditorSectionKey,
  type StoreTemplate,
} from "@/types/storeWebsite";

import { TEMPLATE_REGISTRY } from "../../_templates/registry";

const SECTION_ICON: Record<EditorSectionKey, LucideIcon> = {
  hero: Image,
  brands: BadgeCheck,
  catalogue: LayoutGrid,
  soldes: Percent,
  packs: Gift,
  featured_categories: Star,
  contact: MapPin,
  footer: PanelBottom,
};
const SECTION_KEYS = Object.keys(EDITOR_SECTION_LABEL) as EditorSectionKey[];

/** Each model's own colors (its look before the pharmacy's colors). */
const TEMPLATE_COLORS: Record<StoreTemplate, string[]> = {
  lumiere: ["#F4C9D9", "#9BE0C4", "#E9C887"],
  classique: ["#F4EEDF", "#C9BFA3", "#6B584A"],
  moderne: ["#F5F5F5", "#0F172A", "#F97316"],
  apotheose: ["#0A0A0A", "#C7A662", "#F5E6C9"],
  elegance: ["#1E293B", "#7C3AED", "#F59E0B"],
};

const COLOR_KEYS = ["primary", "secondary", "accent"] as const;
const COLOR_LABEL = { primary: "store.colorPrimary", secondary: "store.colorSecondary", accent: "store.colorAccent" };
const DEFAULT_COLOR = { primary: "#0E9E8C", secondary: "#34CBB7", accent: "#F59E0B" };
const LOGO_TYPES = "image/png,image/jpeg,image/svg+xml,image/webp";

export function EditorSettings({
  customization,
  onPatch,
  onLogo,
  isUploading,
  autoSave,
  onAutoSave,
}: {
  customization: CustomizationOut;
  onPatch: (patch: CustomizationPatch) => void;
  onLogo: (file: File) => void;
  isUploading: boolean;
  autoSave: boolean;
  onAutoSave: (on: boolean) => void;
}) {
  const t = useT();
  const { template, sections, brand_colors, logo_url, font_pairing } = customization;

  return (
    <div className="flex flex-col gap-4">
      <SwitchCard
        icon={Save}
        title={t("store.autoSave")}
        description={t("store.autoSaveHint")}
        checked={autoSave}
        onChange={onAutoSave}
      />

      <SectionCard title={t("store.blockTemplate")}>
        <div role="radiogroup" aria-label={t("store.blockTemplate")} className="grid grid-cols-2 gap-2.5">
          {TEMPLATES.map((tpl) => (
            <ChoiceCard
              key={tpl}
              selected={template === tpl}
              onSelect={() => onPatch({ template: tpl })}
              className="items-start gap-2 p-3"
            >
              <span className="flex items-center gap-1">
                {TEMPLATE_COLORS[tpl].map((c) => (
                  <ColorSwatch key={c} color={c} size="md" />
                ))}
              </span>
              <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
                {TEMPLATE_LABEL[tpl]}
                {!TEMPLATE_REGISTRY[tpl].ready && <Badge>{t("store.soon")}</Badge>}
              </span>
            </ChoiceCard>
          ))}
        </div>
      </SectionCard>

      <SectionCard title={t("store.blockSections")} hint={t("store.blockSectionsHint")}>
        <div className="grid grid-cols-1 gap-2.5">
          {SECTION_KEYS.map((k) => (
            <SwitchCard
              key={k}
              icon={SECTION_ICON[k]}
              title={t(EDITOR_SECTION_LABEL[k])}
              description={t(`${EDITOR_SECTION_LABEL[k]}Hint`)}
              checked={sections[k]?.visible ?? true}
              onChange={(on) => onPatch({ sections: { [k]: { visible: on } } })}
            />
          ))}
        </div>
      </SectionCard>

      <SectionCard title={t("store.blockColors")}>
        <div className="grid grid-cols-1 gap-3">
          {COLOR_KEYS.map((k) => (
            <ColorField
              key={k}
              label={t(COLOR_LABEL[k])}
              value={brand_colors[k] ?? DEFAULT_COLOR[k]}
              onChange={(hex) => onPatch({ brand_colors: { [k]: hex } })}
            />
          ))}
        </div>
      </SectionCard>

      <SectionCard title={t("store.blockLogo")}>
        <FileDropZone
          title={logo_url ? t("store.replaceLogo") : t("store.addLogo")}
          hint={t("store.logoHint")}
          accept={LOGO_TYPES}
          onFiles={([file]) => onLogo(file)}
          preview={
            isUploading ? (
              <Spinner />
            ) : logo_url ? (
              <img src={apiUrl(logo_url)} alt="" className="size-16 rounded-xl border border-border object-contain" />
            ) : undefined
          }
        />
      </SectionCard>

      <SectionCard title={t("store.blockFonts")}>
        <div role="radiogroup" aria-label={t("store.blockFonts")} className="grid grid-cols-1 gap-2">
          {FONT_PAIRINGS.map((f) => (
            <ChoiceCard
              key={f.id}
              selected={font_pairing === f.id}
              onSelect={() => onPatch({ font_pairing: f.id })}
              className="items-start gap-0.5 p-3"
            >
              <span className="text-sm font-semibold text-foreground">{t(f.label)}</span>
              <span className="text-xs text-muted-foreground">{f.sample}</span>
            </ChoiceCard>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}
