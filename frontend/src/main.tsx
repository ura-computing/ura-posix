import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster, toast } from "sonner";

import { ApiErr, setUnauthorizedHandler } from "@/api/client";
import App from "@/App";
import { UploadProvider } from "@/hooks/UploadContext";
import { GlobalDateRangeProvider } from "@/hooks/useGlobalDateRange";
import { I18nProvider, translate, useT } from "@/i18n/I18nProvider";
import { QUERY_KEYS } from "@/types";
import "@/styles/globals.css";
import { ConfirmDialog } from "@/_components/ConfirmDialog";

/** Global modal that surfaces when the API client receives a 401 mid-session.
 *
 *  Singleton subscriber pattern (mirrors `setUnauthorizedHandler` in
 *  `api/client.ts`): a module-level setter holds the React `setOpen` from the
 *  mounted instance, and `openSessionExpiredDialog()` flips it. Mount the
 *  component ONCE at app root (`main.tsx`); calling it from multiple places
 *  would race on the setter ref.
 *
 *  UX: the user clicks "Actualiser" → `window.location.reload()` → fresh boot
 *  → no auth cookie → AppLayout's auth guard bounces them to /login. The
 *  "Plus tard" button just dismisses; the next 401 will re-open this dialog,
 *  so the user can't really escape — but we keep the dismiss option so the
 *  modal isn't a hard trap if someone needs to copy a value off the page
 *  before reloading.
 */

let _setOpen: ((open: boolean) => void) | null = null;

function openSessionExpiredDialog(): void {
  _setOpen?.(true);
}

function SessionExpiredDialog() {
  const t = useT();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    _setOpen = setOpen;
    return () => {
      _setOpen = null;
    };
  }, []);

  return (
    <ConfirmDialog
      open={open}
      onClose={() => setOpen(false)}
      onConfirm={() => window.location.reload()}
      title={t("session.expiredTitle")}
      description={t("session.expiredDesc")}
      variant="destructive"
      confirmLabel={t("session.refresh")}
      cancelLabel={t("session.later")}
    />
  );
}

/** Every failed request shows a toast (users must see each error). Skipped:
 *  401 (SessionExpiredDialog handles it) and mutations whose own onError
 *  already toasts. The text is the server's French `detail` (or the
 *  translated network / generic message from api/client.ts). */
function toastError(err: unknown): void {
  if (err instanceof ApiErr && err.status === 401) return;
  toast.error(err instanceof ApiErr ? err.detail : translate("toast.genericError"));
}

const queryClient = new QueryClient({
  queryCache: new QueryCache({ onError: toastError }),
  mutationCache: new MutationCache({
    onError: (err, _vars, _ctx, mutation) => {
      if (!mutation.options.onError) toastError(err);
    },
  }),
  defaultOptions: {
    queries: { retry: false, refetchOnWindowFocus: false },
  },
});

// Global 401 handler. Only fires when there WAS a cached me — i.e. mid-session
// (session killed elsewhere, password changed on another device, etc.). Fresh-
// load 401s (no cache yet) are handled naturally by useMe's isError state, so
// we skip them here to avoid showing the popup on a first-paint auth failure.
//
// We deliberately DO NOT clear the me cache here. Clearing would make
// AppLayout's auth guard navigate to /login instantly, which would unmount
// the SessionExpiredDialog before the user sees it. Instead we leave the
// stale cache in place and open the dialog; the user's "Actualiser" click
// triggers a hard reload, which boots without a session cookie and lands on
// /login through the natural auth-guard path.
setUnauthorizedHandler(() => {
  if (queryClient.getQueryData(QUERY_KEYS.ME) !== undefined) {
    openSessionExpiredDialog();
  }
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <I18nProvider>
        <UploadProvider>
          <GlobalDateRangeProvider>
            <BrowserRouter>
              <App />
            </BrowserRouter>
            <SessionExpiredDialog />
            <Toaster richColors position="top-right" />
          </GlobalDateRangeProvider>
        </UploadProvider>
      </I18nProvider>
    </QueryClientProvider>
  </StrictMode>,
);