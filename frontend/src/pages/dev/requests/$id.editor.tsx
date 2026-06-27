/** Route container for /dev/requests/:id/editor (3-pane editor).
 *
 *  Owns all the customization state (template, sections, device, dark,
 *  brand palette, font, featured categories) locally. The editor component
 *  is purely presentational; this container hosts mutation handlers + the
 *  export toast wiring. Persisting customization to localStorage is
 *  deferred until the templates land in Chunk E. */
import { useState } from "react";
import { useParams } from "react-router-dom";
import { toast } from "sonner";

import {
  DEFAULT_EDITOR_SECTIONS, MOCK_STORE_CATEGORIES, getMockBrief,
} from "@/fixtures/storeWebsite";
import type {
  DeviceMode, EditorSection, EditorSectionKey, StoreTemplate,
} from "@/types/storeWebsite";

import { EditorPage } from "@/pages/dev/_components/EditorPage";


export default function DevEditorRoute() {
  const { id } = useParams<{ id: string }>();
  const brief  = id ? getMockBrief(id) : null;

  const [template,         setTemplate]         = useState<StoreTemplate>("lumiere");
  const [sections,         setSections]         = useState<EditorSection[]>(DEFAULT_EDITOR_SECTIONS);
  const [selectedSection,  setSelectedSection]  = useState<EditorSectionKey | null>(null);
  const [device,           setDevice]           = useState<DeviceMode>("desktop");
  const [dark,             setDark]             = useState(false);
  const [brandPalette,     setBrandPalette]     = useState<string[]>(brief?.brandPalette ?? ["#0E9E8C", "#34CBB7", "#F59E0B"]);
  const [fontPairing,      setFontPairing]      = useState<string>("moderne");
  const [featured,         setFeatured]         = useState<string[]>([]);
  const [exporting,        setExporting]        = useState(false);
  const [hasExport,        setHasExport]        = useState(false);

  const handleExport = () => {
    setExporting(true);
    setTimeout(() => {
      setExporting(false);
      setHasExport(true);
      toast.success("Export simulé — backend à venir");
    }, 1200);
  };

  const handleMarkDelivered = () => {
    if (!hasExport) return;
    toast.success("Demande marquée comme livrée — simulé");
  };

  return (
    <EditorPage
      pharmacyName={brief?.pharmacyName ?? "Pharmacie"}
      template={template}
      sections={sections}
      selectedSection={selectedSection}
      device={device}
      dark={dark}
      brandPalette={brandPalette}
      fontPairing={fontPairing}
      featuredCategoryIds={featured}
      allCategories={MOCK_STORE_CATEGORIES.filter((c) => !c.isDefault).map((c) => ({ id: c.id, name: c.name }))}
      exporting={exporting}
      hasExport={hasExport}
      onSelectTemplate={setTemplate}
      onSelectSection={setSelectedSection}
      onToggleSection={(key, visible) =>
        setSections((ss) => ss.map((s) => s.key === key ? { ...s, visible } : s))
      }
      onReorderSections={(orderedKeys) => {
        const byKey = new Map(sections.map((s) => [s.key, s]));
        setSections(orderedKeys.map((k) => byKey.get(k)!).filter(Boolean));
      }}
      onDevice={setDevice}
      onToggleDark={() => setDark((d) => !d)}
      onBrandColor={(i, hex) =>
        setBrandPalette((p) => p.map((c, idx) => idx === i ? hex : c))
      }
      onLogoUpload={(file) => toast.info(`Logo "${file.name}" chargé (simulé)`)}
      onFontPairing={setFontPairing}
      onFeaturedCategories={setFeatured}
      onManageCategories={() => toast.info("Gérer les catégories — modale partagée à venir")}
      onFullscreen={() => toast.info("Aperçu plein écran — à venir")}
      onExport={handleExport}
      onMarkDelivered={handleMarkDelivered}
    />
  );
}
