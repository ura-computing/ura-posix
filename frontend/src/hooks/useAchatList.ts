import { useQuery } from "@tanstack/react-query";
import * as transactionsApi from "@/api/transactions";

type UseAchatListParams = {
  page: number;
  limit: number;
  search?: string;
  categories?: string[];
  tva?: string[];
  dateFrom?: string;
  dateTo?: string;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
};

export function useAchatList(params: UseAchatListParams) {
  const { page, limit, search, categories, tva, dateFrom, dateTo, sortBy, sortOrder } = params;
  const { data, isLoading: achatLoading } = useQuery({
    queryKey: ["achat", page, limit, search, categories, tva, dateFrom, dateTo, sortBy, sortOrder],
    queryFn: () =>
      transactionsApi.listAchats({
        page,
        limit,
        search: search || undefined,
        categories: categories?.length ? categories : undefined,
        tva: tva?.length ? tva : undefined,
        dateFrom,
        dateTo,
        sortBy,
        sortOrder,
      }),
  });

  const achatRows = data?.data ?? [];
  const achatPagination = data?.pagination;
  const achatPageCount = achatPagination?.totalPages ?? 1;

  return { achatRows, achatPagination, achatPageCount, achatLoading };
}
