/** Route container for /admin/developers.
 *
 *  Lists APCM developer users via `GET /v1/store-website/admin/developers`.
 *  Actions (invite, reset password, activate/deactivate) rely on endpoints
 *  that haven't been implemented yet — they toast a "à venir" message
 *  until the backend catches up. */
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

import { listDevelopers, type DeveloperAccountOut } from "@/api/storeWebsite";
import type { DeveloperAccount } from "@/types/storeWebsite";

import { DevelopersPage } from "./_components/DevelopersPage";


function toAccount(api: DeveloperAccountOut): DeveloperAccount {
  return {
    id:             api.id,
    name:           api.name,
    email:          api.email,
    status:         api.status,
    activeRequests: api.active_requests,
    lastActiveAt:   api.last_active_at,
  };
}


export default function AdminDevelopersRoute() {
  const [search, setSearch] = useState("");

  const q = useQuery({
    queryKey: ["admin", "developers"],
    queryFn:  listDevelopers,
  });

  const filtered = useMemo(() => {
    const all = (q.data ?? []).map(toAccount);
    const term = search.trim().toLowerCase();
    if (!term) return all;
    return all.filter(
      (d) => d.name.toLowerCase().includes(term) || d.email.toLowerCase().includes(term),
    );
  }, [q.data, search]);

  return (
    <DevelopersPage
      developers={filtered}
      search={search}
      isLoading={q.isLoading}
      onSearch={setSearch}
      onInvite={() => toast.info("Invitation d'un développeur — endpoint à venir")}
      onResetPassword={() => toast.info("Réinitialisation du mot de passe — endpoint à venir")}
      onToggleActive={() => toast.info("Activer/désactiver un compte — endpoint à venir")}
    />
  );
}
