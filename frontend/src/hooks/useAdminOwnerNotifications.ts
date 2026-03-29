import { useQuery } from "@tanstack/react-query";
import { getNotifications as getAdminNotifications } from "@/api/admin";
import { getNotifications as getOwnerNotifications } from "@/api/owner";

export function useAdminNotifications(enabled: boolean) {
  const { data: adminNotifs } = useQuery({
    queryKey: ["admin-notifications"],
    queryFn: () => getAdminNotifications(),
    enabled,
    refetchInterval: 30_000,
  });
  return { adminNotifs };
}

export function useOwnerNotifications(enabled: boolean) {
  const { data: ownerNotifs } = useQuery({
    queryKey: ["owner-notifications"],
    queryFn: () => getOwnerNotifications(),
    enabled,
    refetchInterval: 30_000,
  });
  return { ownerNotifs };
}
