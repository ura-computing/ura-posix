/** Route container for /admin/developers.
 *
 *  Lists APCM developer users via `GET /v1/store-website/admin/developers`.
 *  Actions (invite, reset password, activate/deactivate) rely on endpoints
 *  that haven't been implemented yet — they toast a "à venir" message
 *  until the backend catches up. */
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

import { api } from "@/api/client";
import { API } from "@/api/api";
import { useT } from "@/i18n/I18nProvider";
import { matchesFields } from "@/utils/text";

import type { DeveloperAccount } from "@/types/storeWebsite";
import type { DeveloperAccountOut } from "@/types/storeWebsite";

import { DevelopersPage } from "./_components/DevelopersPage";


function toAccount(out: DeveloperAccountOut): DeveloperAccount {
  return {
    id:             out.id,
    name:           out.name,
    email:          out.email,
    status:         out.status,
    activeRequests: out.active_requests,
    lastActiveAt:   out.last_active_at,
  };
}


export default function AdminDevelopersRoute() {
  const t = useT();
  const [search, setSearch] = useState("");

  const q = useQuery({
    queryKey: API.storeWebsite.developers.key,
    queryFn:  () => api.get<DeveloperAccountOut[]>(API.storeWebsite.developers.url),
  });

  const filtered = useMemo(() => {
    const all = (q.data ?? []).map(toAccount);
    if (!search.trim()) return all;
    return all.filter((d) => matchesFields([d.name, d.email], search));
  }, [q.data, search]);

  return (
    <DevelopersPage
      developers={filtered}
      search={search}
      isLoading={q.isLoading}
      onSearch={setSearch}
      onInvite={() => toast.info(t("store.inviteSoon"))}
      onResetPassword={() => toast.info(t("store.resetPasswordSoon"))}
      onToggleActive={() => toast.info(t("store.toggleActiveSoon"))}
    />
  );
}
