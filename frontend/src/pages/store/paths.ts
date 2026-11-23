/** Links of the online-store pages, e.g. requestPath("3f2…") → "/admin/boutiques/3f2…". */
import { ROUTES } from "@/types";
import type { StoreTemplate } from "@/types/storeWebsite";

export const requestPath = (id: string): string => ROUTES.STORE_REQUEST.replace(":id", id);
export const editorPath = (id: string): string => ROUTES.STORE_EDITOR.replace(":id", id);

/** The public preview of a request's store: "/preview/lumiere/home?request=…". */
export const previewPath = (template: StoreTemplate, page: string, requestId: string): string =>
  `${ROUTES.STORE_PREVIEW.replace(":template", template).replace(":page", page)}?request=${requestId}`;
