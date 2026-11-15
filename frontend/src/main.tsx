import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { CircleAlert, CircleCheck, Info, LoaderCircle, TriangleAlert, X } from "lucide-react";
import { Toaster, toast } from "sonner";

import { ApiErr, setLockedHandler, setUnauthorizedHandler } from "@/api/client";
import { API } from "@/api/api";
import App from "@/App";
import { UploadProvider } from "@/hooks/UploadContext";
import { GlobalDateRangeProvider } from "@/hooks/useGlobalDateRange";
import { I18nProvider, translate, useT } from "@/i18n/I18nProvider";

import "@/styles/globals.css";
import { ConfirmDialog } from "@/_components/molecules/ConfirmDialog";

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
  if (err instanceof ApiErr && (err.status === 401 || err.status === 423)) return; // 423: the lock screen says it
  toast.error(err instanceof ApiErr ? err.detail : translate("toast.genericError"));
}

/** Round icon chip, same as ConfirmDialog's. */
const chip = (Icon: typeof Info, tone: string) => (
  <span className={`flex size-8 items-center justify-center rounded-full ${tone}`}>
    <Icon className="size-4" aria-hidden />
  </span>
);

const TOAST_ICONS = {
  success: chip(CircleCheck, "bg-success-subtle text-success"),
  error: chip(CircleAlert, "bg-error-subtle text-error"),
  warning: chip(TriangleAlert, "bg-warning-subtle text-warning"),
  info: chip(Info, "bg-info-subtle text-info"),
  loading: chip(LoaderCircle, "bg-muted text-muted-foreground [&>svg]:animate-spin"),
  close: <X className="size-4" aria-hidden />,
};

/** Every toast looks like a small ConfirmDialog (card, border, icon chip) + close button. */
function AppToaster() {
  const t = useT();
  return (
    <Toaster
      closeButton
      position="top-right"
      icons={TOAST_ICONS}
      toastOptions={{
        unstyled: true,
        closeButtonAriaLabel: t("common.close"),
        classNames: {
          toast: "flex w-full items-center gap-3 rounded-lg border border-border bg-card py-3 pl-3 pr-10 shadow-md",
          content: "flex min-w-0 flex-col gap-0.5",
          title: "text-sm font-medium leading-snug text-foreground",
          description: "text-sm text-muted-foreground",
          closeButton:
            "absolute right-2 top-1/2 flex size-7 cursor-pointer -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
        },
      }}
    />
  );
}

// After a deploy, an open tab asks for page files that no longer exist (new
// hashed names): reload once per tab to get the new version instead of a blank page.
window.addEventListener("vite:preloadError", (event) => {
  if (sessionStorage.getItem("reloadedAfterDeploy")) return; // reloaded already: show the error
  event.preventDefault();
  sessionStorage.setItem("reloadedAfterDeploy", "1");
  window.location.reload();
});

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
// Lock screen: a 423 anywhere → `me` again (its `lock.locked` shows the lock screen over the page).
setLockedHandler(() => {
  void queryClient.invalidateQueries({ queryKey: API.auth.me.key });
});

setUnauthorizedHandler(() => {
  if (queryClient.getQueryData(API.auth.me.key) !== undefined) {
    openSessionExpiredDialog();
  }
});

// The page's own crashes in Sentry, only when the build got a DSN (VITE_SENTRY_DSN): nothing is loaded otherwise.
const sentryDsn = import.meta.env.VITE_SENTRY_DSN as string | undefined;
if (sentryDsn) {
  void import("@sentry/react").then(
    (Sentry) => Sentry.init({ dsn: sentryDsn, environment: import.meta.env.MODE }), // no personal data by default
  );
}

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
            <AppToaster />
          </GlobalDateRangeProvider>
        </UploadProvider>
      </I18nProvider>
    </QueryClientProvider>
  </StrictMode>,
);
