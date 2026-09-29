/** /admin/pharmacies — « Pharmacies et utilisateurs ». Two tabs:
 *    Pharmacies   — the pharmacies list (_components/PharmaciesTab)
 *    Utilisateurs — EVERY account, with or without a pharmacy (_components/UsersTab):
 *                   the only admin view where nobody is hidden.
 *  The tab lives in the URL (?tab=utilisateurs) so a reload keeps it. */
import { useSearchParams } from "react-router-dom";

import { TabBar } from "@/components/shared/TabBar";
import { useT } from "@/i18n/I18nProvider";

import { PharmaciesTab } from "./_components/PharmaciesTab";
import { UsersTab } from "./_components/UsersTab";


export default function AdminPharmaciesIndex() {
  const t = useT();
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") === "utilisateurs" ? "users" : "pharmacies";

  return (
    <div className="mx-auto flex max-w-[1320px] flex-col gap-4">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">{t("adminUsers.pageTitle")}</h1>
        <p className="text-sm text-muted-foreground">{t("adminUsers.pageSubtitle")}</p>
      </header>

      <TabBar
        tabs={[
          { id: "pharmacies", label: t("adminUsers.tabPharmacies") },
          { id: "users",      label: t("adminUsers.tabUsers") },
        ]}
        activeId={tab}
        onChange={(id) => setParams(id === "users" ? { tab: "utilisateurs" } : {})}
      />

      {tab === "pharmacies" ? <PharmaciesTab /> : <UsersTab />}
    </div>
  );
}
