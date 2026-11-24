/** Every store model and every page: `/preview/:template/:page` and the downloaded site draw a page with
 *  `renderTemplate(template, page, props)`. The 4 pages are the same for every model (`storefront/ui/`); a model
 *  brings its look and its hero (`templates/<model>/index.tsx`). */
import type { StoreTemplate } from "@/types/storeWebsite";

import type { StorePage, TemplateProps } from "./_shared/customizationTypes";
import { apotheose } from "./apotheose";
import { classique } from "./classique";
import { elegance } from "./elegance";
import { lumiere } from "./lumiere";
import { moderne } from "./moderne";
import { StoreCatalogue } from "../ui/Catalogue";
import { StoreContact } from "../ui/Contact";
import { StoreHome } from "../ui/Home";
import { StoreProduit } from "../ui/Produit";

const MODELS = { lumiere, classique, moderne, apotheose, elegance };

const PAGES = { home: StoreHome, catalogue: StoreCatalogue, produit: StoreProduit, contact: StoreContact };

export function renderTemplate(template: StoreTemplate, page: StorePage, props: TemplateProps) {
  const Page = PAGES[page];
  return <Page {...props} model={MODELS[template]} />;
}
