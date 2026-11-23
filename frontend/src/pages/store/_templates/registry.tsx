/** Template registry — maps `StoreTemplate` id → renderer.
 *
 *  Each entry knows how to render every page of the template. `/preview/:template/:page`
 *  reads from here, and the dev editor's inline preview does too. Adding a new
 *  template (Classique, Moderne, Apothéose, Élégance) is just: create the folder,
 *  export 4 page components, add an entry here.
 *
 *  Falls back to a "coming soon" screen for templates not yet built so the
 *  editor can still switch to them without crashing. */

import { Sparkles } from "lucide-react";

import { useT } from "@/i18n/I18nProvider";

import type { StoreTemplate } from "@/types/storeWebsite";
import { TEMPLATE_LABEL } from "@/types/storeWebsite";

import type { StorePage, TemplateProps } from "./_shared/customizationTypes";
import { LumiereCatalogue, LumiereContact, LumiereHome, LumiereProduit } from "./lumiere";

type Renderer = (props: TemplateProps) => React.ReactElement;

export interface TemplateEntry {
  ready: boolean;
  pages: Record<StorePage, Renderer>;
}

function comingSoonPage(template: StoreTemplate): Renderer {
  return function ComingSoon() {
    const t = useT();
    return (
      <div className="grid min-h-screen place-items-center bg-gradient-to-br from-slate-100 to-slate-200 p-8">
        <div className="flex max-w-md flex-col items-center gap-4 rounded-3xl bg-white p-10 text-center shadow-2xl ring-1 ring-black/5">
          <span className="grid size-14 place-items-center rounded-2xl bg-primary/10 text-primary">
            <Sparkles className="size-6" strokeWidth={1.75} />
          </span>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            {t("store.templateSoon", { name: TEMPLATE_LABEL[template] })}
          </h1>
          <p className="text-sm text-muted-foreground">{t("store.templateSoonHint")}</p>
        </div>
      </div>
    );
  };
}

function comingSoonEntry(template: StoreTemplate): TemplateEntry {
  const page = comingSoonPage(template);
  return {
    ready: false,
    pages: { home: page, catalogue: page, produit: page, contact: page },
  };
}

export const TEMPLATE_REGISTRY: Record<StoreTemplate, TemplateEntry> = {
  lumiere: {
    ready: true,
    pages: {
      home: LumiereHome,
      catalogue: LumiereCatalogue,
      produit: LumiereProduit,
      contact: LumiereContact,
    },
  },
  classique: comingSoonEntry("classique"),
  moderne: comingSoonEntry("moderne"),
  apotheose: comingSoonEntry("apotheose"),
  elegance: comingSoonEntry("elegance"),
};

export function renderTemplate(template: StoreTemplate, page: StorePage, props: TemplateProps): React.ReactElement {
  const entry = TEMPLATE_REGISTRY[template];
  const Renderer = entry.pages[page];
  return <Renderer {...props} />;
}
