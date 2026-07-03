/** Admin catalog hooks — used cross-page (Sidebar badge + admin/catalogue page).
 *  Page-local catalog state stays in pages/admin/catalogue/_hooks/. */
import { useQuery } from "@tanstack/react-query";

import { getUnclassifiedCount } from "@/api/adminCatalog";
import { ROLES } from "@/types";
import type { Role } from "@/types";


/** Admin-only count of unclassified medicaments. Drives the "Catalogue"
 *  sidebar badge. Refetches every 60s; cheap query. */
export function useUnclassifiedCount(role: Role): number {
  const q = useQuery({
    queryKey:        ["admin-catalog-unclassified-count"],
    queryFn:         getUnclassifiedCount,
    enabled:         role === ROLES.ADMIN,
    staleTime:       60_000,
    refetchInterval: 60_000,
  });
  return q.data?.count ?? 0;
}
