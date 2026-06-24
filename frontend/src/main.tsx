import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";

import { setUnauthorizedHandler } from "@/api/client";
import App from "@/App";
import { openSessionExpiredDialog, SessionExpiredDialog } from "@/components/shared/SessionExpiredDialog";
import { UploadProvider } from "@/contexts/UploadContext";
import { GlobalDateRangeProvider } from "@/hooks/useGlobalDateRange";
import { QUERY_KEYS } from "@/types";
import "@/styles/globals.css";

const queryClient = new QueryClient({
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
      <UploadProvider>
        <GlobalDateRangeProvider>
          <BrowserRouter>
            <App />
          </BrowserRouter>
          <SessionExpiredDialog />
          <Toaster richColors position="top-right" />
        </GlobalDateRangeProvider>
      </UploadProvider>
    </QueryClientProvider>
  </StrictMode>,
);