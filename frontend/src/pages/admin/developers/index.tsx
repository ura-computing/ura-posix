/** Route container for /admin/developers. */
import { useState } from "react";
import { toast } from "sonner";

import { MOCK_DEVELOPER_ACCOUNTS } from "@/fixtures/storeWebsite";
import type { DeveloperAccount } from "@/types/storeWebsite";

import { DevelopersPage } from "./_components/DevelopersPage";


export default function AdminDevelopersRoute() {
  const [devs, setDevs]   = useState<DeveloperAccount[]>(MOCK_DEVELOPER_ACCOUNTS);
  const [search, setSearch] = useState("");

  const filtered = devs.filter((d) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return d.name.toLowerCase().includes(q) || d.email.toLowerCase().includes(q);
  });

  return (
    <DevelopersPage
      developers={filtered}
      search={search}
      onSearch={setSearch}
      onInvite={() => toast.info("Invitation simulée — backend à venir")}
      onResetPassword={() => toast.success("Lien de réinitialisation envoyé (simulé)")}
      onToggleActive={(id, activate) => {
        setDevs((ds) =>
          ds.map((d) => d.id === id ? { ...d, status: activate ? "actif" : "desactive" } : d),
        );
        toast.success(activate ? "Compte activé" : "Compte désactivé");
      }}
    />
  );
}
