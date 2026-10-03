/** Filters + sort + pagination of a server-paginated list (achats, ventes, catalogue).
 *  - `patch` (any filter): back to page 1.
 *  - `setSort`: same column again flips the order; a new column starts with `firstOrder`.
 *  - `setPage` keeps the filters; `setPageSize` goes back to page 1.
 *  The date range is not here: it is shared between pages (`useGlobalDateRange`). */
import { useCallback, useState } from "react";

interface ListState {
  page: number;
  limit: number;
  sort_by: string | null;
  sort_order: "asc" | "desc";
}

export function useListFilters<F extends ListState>(defaults: F, firstOrder: "asc" | "desc") {
  const [filters, setFilters] = useState<F>(defaults);

  const patch = useCallback((next: Partial<F>) => setFilters((p) => ({ ...p, ...next, page: 1 })), []);
  const setSort = useCallback(
    (key: string) =>
      setFilters((p) => ({
        ...p,
        sort_by: key,
        sort_order: p.sort_by === key ? (p.sort_order === "asc" ? "desc" : "asc") : firstOrder,
      })),
    [firstOrder],
  );
  const setPage = useCallback((page: number) => setFilters((p) => ({ ...p, page })), []);
  const setPageSize = useCallback((limit: number) => setFilters((p) => ({ ...p, limit, page: 1 })), []);
  const reset = useCallback(() => setFilters(defaults), [defaults]);

  return {
    filters,
    patch,
    setSort,
    setPage,
    setPageSize,
    reset,
  };
}
