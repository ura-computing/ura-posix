/** /admin/catalogue page state: filters + pagination + sort + CRUD + CSV import. */
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import {
  createMedicament,
  deleteMedicament,
  importCatalogCsv,
  listCatalog,
  listCatalogCategories,
  updateMedicament,
} from "@/api/adminCatalog";
import { QUERY_KEYS } from "@/types";
import type { CatalogFilters, Medicament, MedicamentInput, ProductType } from "@/types";


const DEFAULT_FILTERS: CatalogFilters = {
  search:     "",
  category:   [],
  type:       null,
  sort_by:    "product",
  sort_order: "asc",
  page:       1,
  limit:      25,
};


export function useCatalogPage() {
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState<CatalogFilters>(DEFAULT_FILTERS);

  const list = useQuery({
    queryKey: QUERY_KEYS.CATALOG(filters),
    queryFn:  () => listCatalog(filters),
  });

  const categories = useQuery({
    queryKey:  QUERY_KEYS.CATALOG_CATEGORIES,
    queryFn:   listCatalogCategories,
    staleTime: 5 * 60_000,
  });

  // Filter helpers — every filter change resets pagination to page 1.
  const patch = (next: Partial<CatalogFilters>) => setFilters((p) => ({ ...p, ...next, page: 1 }));
  const setSearch     = (search: string)              => patch({ search });
  const setCategories = (category: string[])          => patch({ category });
  const setType       = (type: ProductType | null)    => patch({ type });

  // Sort: toggle order on same key, reset to "asc" on new key.
  const setSort = (key: string) =>
    setFilters((p) => ({
      ...p,
      sort_by:    key,
      sort_order: p.sort_by === key ? (p.sort_order === "asc" ? "desc" : "asc") : "asc",
    }));
  const setPage     = (page: number) => setFilters((p) => ({ ...p, page }));
  const setPageSize = (limit: number) => setFilters((p) => ({ ...p, limit, page: 1 }));

  const reset = () => setFilters(DEFAULT_FILTERS);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["catalog"] });
    queryClient.invalidateQueries({ queryKey: QUERY_KEYS.CATALOG_CATEGORIES });
  };

  const create = useMutation({
    mutationFn: (body: MedicamentInput) => createMedicament(body),
    onSuccess:  () => { toast.success("Médicament ajouté"); invalidate(); },
    onError:    (e: Error) => toast.error(e.message),
  });

  const update = useMutation({
    mutationFn: ({ id, body }: { id: number; body: Partial<MedicamentInput> }) =>
      updateMedicament(id, body),
    onSuccess:  () => { toast.success("Médicament modifié"); invalidate(); },
    onError:    (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: (id: number) => deleteMedicament(id),
    onSuccess:  () => { toast.success("Médicament supprimé"); invalidate(); },
    onError:    (e: Error) => toast.error(e.message),
  });

  const importCsv = useMutation({
    mutationFn: (file: File) => importCatalogCsv(file),
    onSuccess:  (r) => {
      toast.success(`Import terminé : ${r.inserted} ajoutés · ${r.updated} mis à jour · ${r.skipped} ignorés`);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return {
    filters,
    setSearch, setCategories, setType,
    setSort, setPage, setPageSize, reset,
    list:        list.data,
    isLoading:   list.isLoading,
    isError:     list.isError,
    categories:  categories.data ?? [],
    create:      (body: MedicamentInput)                          => create.mutate(body),
    update:      (id: number, body: Partial<MedicamentInput>)     => update.mutate({ id, body }),
    remove:      (id: number)                                     => remove.mutate(id),
    importCsv:   (file: File)                                     => importCsv.mutate(file),
    creating:    create.isPending,
    updating:    update.isPending,
    removing:    remove.isPending,
    importing:   importCsv.isPending,
    lastImport:  importCsv.data,
  };
}


export type { Medicament };
