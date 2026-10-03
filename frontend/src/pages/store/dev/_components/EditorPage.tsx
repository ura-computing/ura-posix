import { useState, type ReactNode } from "react";
import { CheckCircle2, Download, ExternalLink, Eye, EyeOff, Loader2, RotateCcw, Save, Upload } from "lucide-react";

import { ConfirmDialog } from "@/_components/ConfirmDialog";
import { Button } from "@/_components/button";
import {
  EDITOR_SECTION_LABEL,
  FONT_PAIRINGS,
  TEMPLATES,
  type EditorSectionKey,
  type StoreTemplate,
} from "@/types/storeWebsite";
import { cn } from "@/utils/cn";

import { TemplateCard } from "./TemplateCard";

/** /requests/:id/editor — developer editor, redesigned 2026-06-27.
 *
 *  Single scrollable column of settings, sticky top bar for actions. No
 *  more 3-pane rail layout (nothing worth splitting into). Fully
 *  responsive: 5-col template row on md+, 2-col on sm, stacked below.
 *
 *  Save flow:
 *    - Auto-save toggle in the top bar (persisted in localStorage).
 *    - Explicit "Enregistrer" button. Always available while there are
 *      unsaved edits.
 *    - Three-state indicator next to the breadcrumb:
 *        * `Enregistrement…` while a mutation is in flight.
 *        * `Modifications non enregistrées` when the buffer is dirty
 *          and auto-save is OFF.
 *        * `Enregistré` (briefly) after a successful flush. */

export interface EditorPageProps {
  pharmacyName: string;
  template: StoreTemplate;
  sections: { key: EditorSectionKey; visible: boolean }[];
  brandColors: { primary: string; secondary: string; accent: string };
  fontPairing: string;
  logoUrl: string | null;

  autoSave: boolean;
  hasUnsaved: boolean;
  isSaving?: boolean;
  isUploading?: boolean;
  isResetting?: boolean;
  exporting?: boolean;
  hasExport?: boolean;

  onSelectTemplate: (t: StoreTemplate) => void;
  onToggleSection: (key: EditorSectionKey, visible: boolean) => void;
  onBrandColor: (which: "primary" | "secondary" | "accent", hex: string) => void;
  onFontPairing: (id: string) => void;
  onLogoUpload: (file: File) => void;
  onSetAutoSave: (on: boolean) => void;
  onSave: () => void;
  onReset: () => void;
  onOpenPreview: () => void;
  onExport: () => void;
  onMarkDelivered: () => void;
}

export function EditorPage(props: EditorPageProps) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <TopBar {...props} />
      <main className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-6 sm:px-6">
        <TemplateSection {...props} />
        <SectionsSection {...props} />
        <BrandColorsSection {...props} />
        <LogoSection {...props} />
        <TypographySection {...props} />
      </main>
    </div>
  );
}

// ── TOP BAR ─────────────────────────────────────────────────────────────────

function TopBar(props: EditorPageProps) {
  const canSave = props.hasUnsaved && !props.isSaving;
  const [resetOpen, setResetOpen] = useState(false);

  const handleReset = () => {
    if (props.isResetting) return;
    setResetOpen(true);
  };

  return (
    <header className="sticky top-0 z-20 flex flex-wrap items-center gap-2 border-b border-border bg-card/95 px-3 py-2 backdrop-blur sm:gap-3 sm:px-4">
      <ConfirmDialog
        open={resetOpen}
        onClose={() => setResetOpen(false)}
        variant="destructive"
        title="Réinitialiser la personnalisation ?"
        description="Toutes les modifications (modèle, sections, couleurs, logo, typographie) seront restaurées aux valeurs par défaut. Cette action est irréversible."
        onConfirm={() => {
          setResetOpen(false);
          props.onReset();
        }}
      />
      {/* Breadcrumb + save state indicator */}
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <div className="min-w-0 truncate text-sm text-muted-foreground">
          Éditeur <span className="px-1">·</span>
          <span className="font-semibold text-foreground">{props.pharmacyName}</span>
        </div>
        <SaveIndicator hasUnsaved={props.hasUnsaved} isSaving={props.isSaving} autoSave={props.autoSave} />
      </div>

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-2">
        <AutoSaveToggle checked={props.autoSave} onChange={props.onSetAutoSave} />

        <Button size="sm" onClick={props.onSave} disabled={!canSave} title="Enregistrer">
          <Save className="size-4" />
          <span className="hidden sm:inline">Enregistrer</span>
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={handleReset}
          disabled={props.isResetting}
          title="Réinitialiser la personnalisation"
        >
          {props.isResetting ? <Loader2 className="size-4 animate-spin" /> : <RotateCcw className="size-4" />}
          <span className="hidden sm:inline">{props.isResetting ? "Réinitialisation…" : "Réinitialiser"}</span>
        </Button>

        <Button variant="outline" size="sm" onClick={props.onOpenPreview} title="Ouvrir l'aperçu">
          <ExternalLink className="size-4" />
          <span className="hidden sm:inline">Aperçu</span>
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={props.onExport}
          disabled={props.exporting}
          title="Exporter le projet"
        >
          {props.exporting ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
          <span className="hidden sm:inline">{props.exporting ? "Génération…" : "Exporter"}</span>
        </Button>

        <Button size="sm" onClick={props.onMarkDelivered} disabled={!props.hasExport} title="Marquer comme livrée">
          <CheckCircle2 className="size-4" />
          <span className="hidden sm:inline">Livrée</span>
        </Button>
      </div>
    </header>
  );
}

function SaveIndicator({
  hasUnsaved,
  isSaving,
  autoSave,
}: {
  hasUnsaved: boolean;
  isSaving?: boolean;
  autoSave: boolean;
}) {
  if (isSaving) {
    return (
      <span className="flex items-center gap-1.5 whitespace-nowrap text-xs text-muted-foreground">
        <Loader2 className="size-3 animate-spin" />
        Enregistrement…
      </span>
    );
  }
  if (hasUnsaved && !autoSave) {
    return (
      <span className="whitespace-nowrap rounded-md bg-warning-subtle px-2 py-0.5 text-xs font-medium text-warning-subtle-foreground">
        Modifications non enregistrées
      </span>
    );
  }
  return null;
}

function AutoSaveToggle({ checked, onChange }: { checked: boolean; onChange: (on: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center gap-1.5 rounded-md border border-border bg-card px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="size-3.5 cursor-pointer accent-primary"
      />
      <span className="hidden sm:inline">Auto-save</span>
    </label>
  );
}

// ── SECTIONS ────────────────────────────────────────────────────────────────

function TemplateSection(props: EditorPageProps) {
  return (
    <SectionShell title="Modèle">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
        {TEMPLATES.map((t) => (
          <TemplateCard key={t} template={t} active={props.template === t} onClick={() => props.onSelectTemplate(t)} />
        ))}
      </div>
    </SectionShell>
  );
}

function SectionsSection(props: EditorPageProps) {
  return (
    <SectionShell title="Sections">
      <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
        {props.sections.map((sec) => (
          <div
            key={sec.key}
            className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 transition-colors hover:bg-surface-subtle/50"
          >
            <span className="flex-1 truncate text-sm font-medium text-foreground">{EDITOR_SECTION_LABEL[sec.key]}</span>
            <button
              type="button"
              onClick={() => props.onToggleSection(sec.key, !sec.visible)}
              className={cn(
                "text-muted-foreground transition-colors hover:text-foreground",
                sec.visible ? "opacity-100" : "opacity-50",
              )}
              aria-label={sec.visible ? "Masquer" : "Afficher"}
              aria-pressed={sec.visible}
            >
              {sec.visible ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
            </button>
          </div>
        ))}
      </div>
    </SectionShell>
  );
}

function BrandColorsSection(props: EditorPageProps) {
  return (
    <SectionShell title="Couleurs de marque">
      <div className="flex flex-wrap items-center gap-3">
        {(["primary", "secondary", "accent"] as const).map((k) => (
          <label key={k} className="flex items-center gap-2 rounded-lg border border-border bg-card px-2.5 py-1.5">
            <input
              type="color"
              value={props.brandColors[k]}
              onChange={(e) => props.onBrandColor(k, e.target.value)}
              className="h-7 w-10 cursor-pointer rounded-md border border-border bg-transparent p-0.5"
              aria-label={COLOR_LABELS[k]}
            />
            <span className="text-xs font-medium text-foreground">{COLOR_LABELS[k]}</span>
            <span className="font-mono text-xs text-muted-foreground">{props.brandColors[k]}</span>
          </label>
        ))}
      </div>
    </SectionShell>
  );
}

function LogoSection(props: EditorPageProps) {
  return (
    <SectionShell title="Logo">
      <LogoRow currentUrl={props.logoUrl} isUploading={props.isUploading} onFile={props.onLogoUpload} />
    </SectionShell>
  );
}

function TypographySection(props: EditorPageProps) {
  return (
    <SectionShell title="Typographie">
      <div className="flex flex-wrap gap-2">
        {FONT_PAIRINGS.map((f) => {
          const on = props.fontPairing === f.id;
          return (
            <button
              key={f.id}
              type="button"
              onClick={() => props.onFontPairing(f.id)}
              data-on={on}
              className="flex flex-col items-start gap-0.5 rounded-lg border border-border bg-card px-3 py-2 text-left transition-colors hover:bg-surface-subtle/50 data-[on=true]:border-primary data-[on=true]:bg-surface-subtle"
            >
              <span className="text-sm font-semibold text-foreground">{f.label}</span>
              <span className="text-xs text-muted-foreground">{f.sample}</span>
            </button>
          );
        })}
      </div>
    </SectionShell>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────

const COLOR_LABELS = {
  primary: "Principale",
  secondary: "Secondaire",
  accent: "Accent",
} as const;

function SectionShell({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h2>
      {children}
    </section>
  );
}

function LogoRow({
  currentUrl,
  isUploading,
  onFile,
}: {
  currentUrl: string | null;
  isUploading?: boolean;
  onFile: (file: File) => void;
}) {
  const [hover, setHover] = useState(false);
  return (
    <label
      data-hover={hover}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className="flex cursor-pointer items-center gap-3 rounded-lg border border-border bg-card px-3 py-2.5 text-sm transition-colors hover:bg-surface-subtle/50 data-[hover=true]:border-primary"
    >
      {currentUrl && (
        <img
          src={currentUrl}
          alt="Logo actuel"
          className="size-10 shrink-0 rounded-md border border-border object-contain"
        />
      )}
      <span className="flex flex-1 items-center gap-2 text-muted-foreground data-[hover=true]:text-foreground">
        {isUploading ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
        {isUploading ? "Téléversement…" : currentUrl ? "Remplacer le logo" : "Téléverser un logo"}
      </span>
      <span className="hidden text-xs text-muted-foreground sm:inline">PNG · JPG · SVG · WEBP · 2 Mo max</span>
      <input
        type="file"
        accept="image/png,image/jpeg,image/svg+xml,image/webp"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onFile(file);
        }}
      />
    </label>
  );
}
