import { useMe } from "@/hooks/useMe";
import { eUserRole } from "@/types";
import { AdminRapports } from "./adminRapports";
import { PharmacyRapports } from "./pharmacyRapports";

export default function RapportsPage() {
  const { me: identity } = useMe();
  if (!identity) return null;
  if (identity.role === eUserRole.ADMIN) return <AdminRapports />;
  return <PharmacyRapports />;
}
