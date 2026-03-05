import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

export function useMe() {
  return useQuery({
    queryKey: ["me"],
    queryFn: api.auth.me,
    staleTime: 1000 * 60 * 5,
  });
}
