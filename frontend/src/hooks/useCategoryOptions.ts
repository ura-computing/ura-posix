import { useQuery } from "@tanstack/react-query";
import { listCatalogCategories } from "@/api/admin";

export function useCategoryOptions() {
  const { data: categories = [] } = useQuery({
    queryKey: ["catalog-categories"],
    queryFn: () => listCatalogCategories(),
    staleTime: 60_000,
  });
  return { categories };
}
