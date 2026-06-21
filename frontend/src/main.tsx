import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";

import { setUnauthorizedHandler } from "@/api/client";
import App from "@/App";
import { UploadProvider } from "@/contexts/UploadContext";
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
// we skip them here to avoid an invalidate→refetch→401→invalidate loop.
// We set data to `undefined` (not null) because useMe's `select: toFlat` would
// crash on null. And we DO NOT call invalidateQueries — that would force a
// refetch and re-trigger the handler. Setting data is enough: AppLayout's
// auth guard sees me=null and navigates to /login.
setUnauthorizedHandler(() => {
  if (queryClient.getQueryData(QUERY_KEYS.ME) !== undefined) {
    queryClient.setQueryData(QUERY_KEYS.ME, undefined);
  }
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <UploadProvider>
        <BrowserRouter>
          <App />
        </BrowserRouter>
        <Toaster richColors position="top-right" />
      </UploadProvider>
    </QueryClientProvider>
  </StrictMode>,
);