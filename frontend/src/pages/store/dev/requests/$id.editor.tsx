/** Route container for /requests/:id/editor (developer editor).
 *
 *  Fetches the request + customization from the backend via
 *  `useEditorCustomization`, which buffers patches locally. Auto-save is
 *  ON by default (500ms debounce); the developer can toggle it off + use
 *  the Save button in the top bar. */
import { useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { toast } from "sonner";

import {
  EDITOR_SECTION_LABEL,
  type EditorSectionKey, type StoreTemplate,
} from "@/types/storeWebsite";
import type { FontPairing } from "@/types/storeWebsite";

import { EditorPage } from "@/pages/store/dev/_components/EditorPage";
import { useEditorCustomization } from "@/pages/store/dev/_hooks/useEditorCustomization";
import { api } from "@/api/client";
import { URLS } from "@/api/urls";
import { useT } from "@/i18n/I18nProvider";


const SECTION_KEYS = Object.keys(EDITOR_SECTION_LABEL) as EditorSectionKey[];


export default function DevEditorRoute() {
  const { id } = useParams<{ id: string }>();
  const t = useT();
  const {
    request, customization, isLoading, isError,
    isSaving, isUploading, isResetting,
    autoSave, hasUnsaved, setAutoSave, save, reset,
    patch, uploadLogo,
  } = useEditorCustomization(id);

  const [exporting, setExporting] = useState(false);
  const [hasExport, setHasExport] = useState(false);

  const sections = useMemo(() => {
    // Backend's `sections` is a map keyed by EditorSectionKey; normalize into
    // an ordered array so the UI renders every section (even if the DB missed
    // a key on some legacy row).
    const src = customization?.sections ?? {};
    return SECTION_KEYS.map((k) => ({
      key:     k,
      visible: src[k]?.visible ?? true,
    }));
  }, [customization?.sections]);

  const brandColors = useMemo(() => ({
    primary:   customization?.brand_colors.primary   ?? "#0E9E8C",
    secondary: customization?.brand_colors.secondary ?? "#34CBB7",
    accent:    customization?.brand_colors.accent    ?? "#F59E0B",
  }), [customization?.brand_colors]);

  const previewUrl = useMemo(() => {
    if (!id || !customization) return "#";
    return `/preview/${customization.template}/home?request=${id}`;
  }, [id, customization]);

  const handleOpenPreview = () => {
    if (previewUrl === "#") {
      toast.error(t("store.previewUnavailable"));
      return;
    }
    window.open(previewUrl, "_blank", "noopener,noreferrer");
  };

  const handleExport = () => {
    setExporting(true);
    setTimeout(() => {
      setExporting(false);
      setHasExport(true);
      toast.success(t("store.exportSimulated"));
    }, 1200);
  };

  const handleMarkDelivered = async () => {
    if (!hasExport || !id) return;
    try {
      await api.patch(URLS.storeWebsite.request.state(id), { state: "livree" });
      toast.success(t("store.markedDelivered"));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("toast.genericError"));
    }
  };

  if (isLoading || !id) {
    return (
      <div className="flex h-screen items-center justify-center bg-background text-sm text-muted-foreground">
        Chargement de l'éditeur…
      </div>
    );
  }
  if (isError || !request || !customization) {
    return (
      <div className="flex h-screen items-center justify-center bg-background text-sm text-muted-foreground">
        Impossible de charger cette demande.
      </div>
    );
  }

  return (
    <EditorPage
      pharmacyName={request.store_name}
      template={customization.template}
      sections={sections}
      brandColors={brandColors}
      fontPairing={customization.font_pairing}
      logoUrl={customization.logo_url}
      autoSave={autoSave}
      hasUnsaved={hasUnsaved}
      isSaving={isSaving}
      isUploading={isUploading}
      isResetting={isResetting}
      exporting={exporting}
      hasExport={hasExport}
      onSelectTemplate={(t: StoreTemplate) => patch({ template: t })}
      onToggleSection={(key, visible) => patch({ sections: { [key]: { visible } } })}
      onBrandColor={(which, hex) => patch({ brand_colors: { [which]: hex } })}
      onFontPairing={(id: string) => patch({ font_pairing: id as FontPairing })}
      onLogoUpload={uploadLogo}
      onSetAutoSave={setAutoSave}
      onSave={save}
      onReset={reset}
      onOpenPreview={handleOpenPreview}
      onExport={handleExport}
      onMarkDelivered={handleMarkDelivered}
    />
  );
}
