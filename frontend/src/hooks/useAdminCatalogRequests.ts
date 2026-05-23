import { useQuery } from "@tanstack/react-query";
import * as adminApi from "@/api/admin";

const QUERY_KEY = ["admin", "non-declared"] as const;

export function useAdminSpecialProducts() {
  const { data: products = [], isLoading: productsLoading } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: () => adminApi.listAllNonDeclared(),
  });
  return { products, productsLoading };
}
