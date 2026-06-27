import { useState, type ReactNode } from "react";
import {
  Maximize, Download, Monitor, Tablet, Smartphone, Sun, Moon,
  GripVertical, Eye, EyeOff, MoreHorizontal, Loader2, Upload, FolderCog,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  EDITOR_SECTION_LABEL, FONT_PAIRINGS,
  TEMPLATE_LABEL, TEMPLATES,
  type DeviceMode, type EditorSection, type EditorSectionKey,
  type StoreTemplate,
} from "@/types/storeWebsite";


/** Screen 17 — /dev/requests/:id/editor. THREE-PANE editor.
 *
 *  Left rail (320px): template picker + sections (drag-reorder + visibility).
 *  Center: device toggle + light/dark + responsive preview frame. Templates
 *    don't exist until Chunk E — until then, the frame holds a styled
 *    placeholder. When Chunk E lands, swap the placeholder for the real
 *    template render.
 *  Right rail (360px): per-section properties when a section is selected,
 *    otherwise global controls (brand colors, logo, typography, featured
 *    categories, "Gérer les catégories" shortcut).
 *
 *  Top bar: Aperçu plein écran · Exporter le projet (re-clickable any number
 *  of times) · Marquer comme livrée (disabled until ≥1 export).
 *
 *  react-grid-layout LIVES INSIDE the templates (Chunk E), not in this editor —
 *  per the user-locked decision (Webflow-style 2D canvas on the public-store
 *  Home page, NOT on the editor's section list). */

export interface EditorPageProps {
  pharmacyName:         string;
  template:             StoreTemplate;
  sections:             EditorSection[];
  selectedSection:      EditorSectionKey | null;
  device:               DeviceMode;
  dark:                 boolean;
  brandPalette:         string[];
  fontPairing:          string;
  featuredCategoryIds:  string[];
  allCategories:        { id: string; name: string }[];
  exporting?:           boolean;
  hasExport?:           boolean;
  onSelectTemplate:     (t: StoreTemplate) => void;
  onSelectSection:      (key: EditorSectionKey | null) => void;
  onToggleSection:      (key: EditorSectionKey, visible: boolean) => void;
  onReorderSections:    (orderedKeys: EditorSectionKey[]) => void;
  onDevice:             (d: DeviceMode) => void;
  onToggleDark:         () => void;
  onBrandColor:         (index: number, hex: string) => void;
  onLogoUpload:         (file: File) => void;
  onFontPairing:        (id: string) => void;
  onFeaturedCategories: (ids: string[]) => void;
  onManageCategories:   () => void;
  onFullscreen:         () => void;
  onExport:             () => void;
  onMarkDelivered:      () => void;
}


const DEVICE_W: Record<DeviceMode, string> = {
  desktop: "100%",
  tablet:  "768px",
  mobile:  "390px",
};


export function EditorPage(props: EditorPageProps) {
  return (
    <div className="flex h-screen flex-col bg-background">
      {/* Top bar */}
      <header className="flex h-14 flex-none items-center gap-3 border-b border-border bg-card px-4">
        <span className="truncate text-sm text-muted-foreground">
          Demande <span className="px-1">/</span> Éditeur —{" "}
          <span className="font-semibold text-foreground">{props.pharmacyName}</span>
        </span>
        <div className="ml-auto flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={props.onFullscreen}>
            <Maximize className="size-4" />
            Aperçu plein écran
          </Button>
          <Button variant="outline" size="sm" onClick={props.onExport} disabled={props.exporting}>
            {props.exporting ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
            {props.exporting ? "Génération en cours…" : "Exporter le projet"}
          </Button>
          <Button size="sm" onClick={props.onMarkDelivered} disabled={!props.hasExport}>
            Marquer comme livrée
          </Button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <LeftRail {...props} />
        <CenterPreview {...props} />
        <RightRail {...props} />
      </div>
    </div>
  );
}


// ── LEFT RAIL ──────────────────────────────────────────────────────────────

function LeftRail(props: EditorPageProps) {
  return (
    <aside className="flex w-80 flex-none flex-col overflow-y-auto border-r border-border bg-card">
      <div className="flex flex-col gap-2 border-b border-border p-4">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Modèle</span>
        <div className="flex flex-col gap-1.5">
          {TEMPLATES.map((t) => {
            const on = props.template === t;
            return (
              <button
                key={t}
                onClick={() => props.onSelectTemplate(t)}
                data-on={on}
                className="flex items-center gap-3 rounded-lg border border-border p-2.5 text-left text-sm transition-colors hover:bg-surface-subtle/50 data-[on=true]:border-primary data-[on=true]:bg-surface-subtle"
              >
                <span
                  data-on={on}
                  className="flex size-4 items-center justify-center rounded-full border-2 data-[on=true]:border-primary"
                >
                  {on && <span className="size-2 rounded-full bg-primary" />}
                </span>
                <span className="font-medium">{TEMPLATE_LABEL[t]}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-col gap-2 p-4">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Sections</span>
        <p className="text-xs text-muted-foreground">
          Glissez pour réordonner. Masquez ce qui ne doit pas apparaître.
        </p>
        <div className="mt-1 flex flex-col gap-1">
          {props.sections.map((sec) => {
            const on = props.selectedSection === sec.key;
            return (
              <div
                key={sec.key}
                data-on={on}
                className="group flex items-center gap-2 rounded-lg border border-transparent px-2 py-2 transition-colors hover:bg-surface-subtle/50 data-[on=true]:border-border data-[on=true]:bg-surface-subtle"
              >
                <button
                  className="cursor-grab text-muted-foreground opacity-40 group-hover:opacity-100"
                  aria-label="Réordonner"
                >
                  <GripVertical className="size-4" />
                </button>
                <button
                  onClick={() => props.onSelectSection(sec.key)}
                  className="flex-1 text-left text-sm font-medium"
                >
                  {EDITOR_SECTION_LABEL[sec.key]}
                </button>
                <button
                  onClick={() => props.onToggleSection(sec.key, !sec.visible)}
                  className="text-muted-foreground hover:text-foreground"
                  aria-label={sec.visible ? "Masquer" : "Afficher"}
                >
                  {sec.visible ? <Eye className="size-4" /> : <EyeOff className="size-4 opacity-50" />}
                </button>
                <button className="text-muted-foreground hover:text-foreground" aria-label="Options">
                  <MoreHorizontal className="size-4" />
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </aside>
  );
}


// ── CENTER (responsive preview frame) ──────────────────────────────────────

function CenterPreview(props: EditorPageProps) {
  return (
    <main className="flex min-w-0 flex-1 flex-col bg-surface-subtle/40">
      <div className="flex h-12 flex-none items-center justify-center gap-2 border-b border-border bg-card">
        <div className="flex items-center gap-0.5 rounded-lg border border-border bg-card p-0.5">
          {(["desktop", "tablet", "mobile"] as DeviceMode[]).map((d) => {
            const Icon = d === "desktop" ? Monitor : d === "tablet" ? Tablet : Smartphone;
            const on = props.device === d;
            return (
              <button
                key={d}
                onClick={() => props.onDevice(d)}
                data-on={on}
                className="flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors data-[on=true]:bg-primary data-[on=true]:text-primary-foreground"
                aria-label={d}
              >
                <Icon className="size-4" />
              </button>
            );
          })}
        </div>
        <button
          onClick={props.onToggleDark}
          className="flex size-9 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground transition-colors hover:bg-surface-subtle hover:text-foreground"
          aria-label="Thème"
        >
          {props.dark ? <Moon className="size-4" /> : <Sun className="size-4" />}
        </button>
      </div>

      <div className="flex flex-1 items-start justify-center overflow-auto p-6">
        <div
          className="h-full overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition-all"
          style={{ width: DEVICE_W[props.device], maxWidth: "100%" }}
        >
          {/* Placeholder until Chunk E lands the real template renders.
              When templates exist, this will mount the chosen
              <TemplateHome customization={...} editMode={true} /> directly
              so brand-color / typography / section edits update in real
              time (no iframe reload). */}
          <PreviewPlaceholder
            template={props.template}
            dark={props.dark}
            brandPalette={props.brandPalette}
          />
        </div>
      </div>
    </main>
  );
}


function PreviewPlaceholder({
  template, dark, brandPalette,
}: { template: StoreTemplate; dark: boolean; brandPalette: string[] }) {
  const primary = brandPalette[0] ?? "#0E9E8C";
  return (
    <div
      className="flex h-full flex-col"
      style={{
        background: dark ? "#0a0a0a" : "#ffffff",
        color:      dark ? "#fafafa" : "#0a0a0a",
      }}
    >
      <div
        className="flex items-center justify-between border-b px-6 py-4"
        style={{ borderColor: dark ? "#262626" : "#e5e5e5" }}
      >
        <span className="text-sm font-semibold tracking-tight" style={{ color: primary }}>
          {TEMPLATE_LABEL[template]}
        </span>
        <div className="flex gap-1">
          {brandPalette.map((c) => (
            <span key={c} className="size-3 rounded-full" style={{ background: c }} />
          ))}
        </div>
      </div>
      <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
        <span
          className="rounded-2xl px-4 py-2 text-xs font-semibold uppercase tracking-wider"
          style={{ background: `${primary}22`, color: primary }}
        >
          Aperçu du modèle
        </span>
        <p className="max-w-xs text-sm opacity-70">
          Le rendu interactif du modèle {TEMPLATE_LABEL[template]} sera disponible
          après l'arrivée des composants de templates.
        </p>
      </div>
    </div>
  );
}


// ── RIGHT RAIL (properties) ────────────────────────────────────────────────

function RightRail(props: EditorPageProps) {
  if (props.selectedSection) {
    return (
      <aside className="flex w-[360px] flex-none flex-col gap-4 overflow-y-auto border-l border-border bg-card p-4">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-foreground">{EDITOR_SECTION_LABEL[props.selectedSection]}</span>
          <Button variant="ghost" size="sm" onClick={() => props.onSelectSection(null)}>
            Réglages globaux
          </Button>
        </div>
        {/* Per-section property fields (copy, color overrides, image swaps)
            are stubbed structurally. Wire each section's editable fields
            behind props when the template components land in Chunk E. */}
        <Field label="Titre de la section">
          <input
            className="w-full rounded-lg border border-border bg-surface-subtle px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2"
            placeholder="Texte…"
          />
        </Field>
        <Field label="Sous-titre">
          <textarea
            rows={3}
            className="w-full rounded-lg border border-border bg-surface-subtle px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2"
            placeholder="Texte…"
          />
        </Field>
        <Field label="Image">
          <UploadBox label="Remplacer l'image" onFile={() => undefined} />
        </Field>
        <Field label="Couleur d'accent (surcharge)">
          <input type="color" className="h-9 w-16 cursor-pointer rounded-md border border-border bg-transparent p-0.5" />
        </Field>
      </aside>
    );
  }

  // Nothing selected → global controls.
  return (
    <aside className="flex w-[360px] flex-none flex-col gap-5 overflow-y-auto border-l border-border bg-card p-4">
      <span className="text-sm font-semibold text-foreground">Réglages globaux</span>

      <Field label="Couleurs de marque">
        <div className="flex items-center gap-2">
          {props.brandPalette.map((hex, i) => (
            <input
              key={i}
              type="color"
              value={hex}
              onChange={(e) => props.onBrandColor(i, e.target.value)}
              className="h-9 w-14 cursor-pointer rounded-md border border-border bg-transparent p-0.5"
              aria-label={`Couleur ${i + 1}`}
            />
          ))}
        </div>
      </Field>

      <Field label="Logo">
        <UploadBox label="Téléverser un logo" onFile={props.onLogoUpload} />
      </Field>

      <Field label="Typographie">
        <div className="flex flex-col gap-2">
          {FONT_PAIRINGS.map((f) => {
            const on = props.fontPairing === f.id;
            return (
              <button
                key={f.id}
                onClick={() => props.onFontPairing(f.id)}
                data-on={on}
                className="flex flex-col items-start gap-0.5 rounded-lg border border-border p-3 text-left transition-colors hover:bg-surface-subtle/50 data-[on=true]:border-primary data-[on=true]:bg-surface-subtle"
              >
                <span className="text-sm font-semibold text-foreground">{f.label}</span>
                <span className="text-xs text-muted-foreground">{f.sample}</span>
              </button>
            );
          })}
        </div>
      </Field>

      <Field label="Catégories à mettre en avant">
        <div className="flex flex-col gap-1.5">
          {props.allCategories.map((c) => {
            const on = props.featuredCategoryIds.includes(c.id);
            return (
              <button
                key={c.id}
                onClick={() =>
                  props.onFeaturedCategories(
                    on ? props.featuredCategoryIds.filter((x) => x !== c.id) : [...props.featuredCategoryIds, c.id],
                  )
                }
                className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-surface-subtle"
              >
                <span
                  data-on={on}
                  className="flex size-4 items-center justify-center rounded border-2 border-border data-[on=true]:border-primary data-[on=true]:bg-primary"
                >
                  {on && <span className="text-[10px] font-semibold text-primary-foreground">✓</span>}
                </span>
                <span className="text-sm text-foreground">{c.name}</span>
              </button>
            );
          })}
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Alimente la section « Catégories en vedette » de l'accueil.
        </p>
      </Field>

      <Button variant="outline" className="w-full" onClick={props.onManageCategories}>
        <FolderCog className="size-4" />
        Gérer les catégories
      </Button>
    </aside>
  );
}


// ── Helpers ────────────────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}


function UploadBox({ label, onFile }: { label: string; onFile: (f: File) => void }) {
  const [hover, setHover] = useState(false);
  return (
    <label
      data-hover={hover}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border bg-surface-subtle px-3 py-4 text-center text-sm text-muted-foreground transition-colors data-[hover=true]:border-primary data-[hover=true]:text-foreground"
    >
      <Upload className="size-4" />
      {label}
      <input
        type="file"
        accept=".png,.svg,.jpg,.jpeg"
        className="hidden"
        onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
      />
    </label>
  );
}
