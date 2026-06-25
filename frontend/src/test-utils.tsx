/** Shared renderHook + provider stack for hook tests.
 *
 *  Most hooks need TanStack Query; many also use react-router (NavLink-aware
 *  utilities) and `GlobalDateRangeProvider`. Wrap once here so tests stay
 *  succinct.
 *
 *  Reset the QueryClient per test — otherwise cache pollution masks bugs
 *  between cases. */
import { type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { renderHook, type RenderHookOptions } from "@testing-library/react";

import { GlobalDateRangeProvider } from "@/hooks/useGlobalDateRange";


export function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, staleTime: 0 },
      mutations: { retry: false },
    },
  });
}


export function AllProviders({
  children, qc,
}: { children: ReactNode; qc?: QueryClient }) {
  const client = qc ?? makeQueryClient();
  return (
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <GlobalDateRangeProvider>{children}</GlobalDateRangeProvider>
      </MemoryRouter>
    </QueryClientProvider>
  );
}


/** renderHook with the standard provider stack. Pass `qc` to share a
 *  QueryClient across multiple hook renders (mutation → query invalidation
 *  tests). */
export function renderHookWithProviders<TResult, TProps>(
  callback: (props: TProps) => TResult,
  options?: RenderHookOptions<TProps> & { qc?: QueryClient },
) {
  const qc = options?.qc ?? makeQueryClient();
  return {
    qc,
    ...renderHook(callback, {
      ...options,
      wrapper: ({ children }) => <AllProviders qc={qc}>{children}</AllProviders>,
    }),
  };
}
