import { useQuery } from "@tanstack/react-query";
import * as transactionsApi from "@/api/transactions";

type UseVentesListParams = {
  page: number;
  limit: number;
  search?: string;
  categories?: string[];
  tva?: string[];
  dateFrom?: string;
  dateTo?: string;
};

export function useVentesList(params: UseVentesListParams) {
  const { page, limit, search, categories, tva, dateFrom, dateTo } = params;
  const { data, isLoading: ventesLoading } = useQuery({
    queryKey: ["ventes", page, limit, search, categories, tva, dateFrom, dateTo],
    queryFn: () =>
      transactionsApi.listVentes({
        page,
        limit,
        search: search || undefined,
        categories: categories?.length ? categories : undefined,
        tva: tva?.length ? tva : undefined,
        dateFrom,
        dateTo,
      }),
  });

  const ventesRows = data?.data ?? [];
  const ventesPagination = data?.pagination;
  const ventesPageCount = ventesPagination?.totalPages ?? 1;

  return { ventesRows, ventesPagination, ventesPageCount, ventesLoading };
}
