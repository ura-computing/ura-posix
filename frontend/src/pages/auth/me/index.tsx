import { useState } from "react";

import { TabBar } from "@/components/shared/TabBar";
import type { TabItem } from "@/components/shared/TabBar";
import { useMe } from "@/hooks/useMe";
import { useT, type TFn } from "@/i18n/I18nProvider";

import { PasswordTab } from "./_components/PasswordTab";
import { ProfileTab } from "./_components/ProfileTab";
import { SessionsTab } from "./_components/SessionsTab";

const buildTabs = (t: TFn): TabItem[] => [
  { id: "profil",   label: t("me.tabProfil") },
  { id: "password", label: t("me.tabPassword") },
  { id: "sessions", label: t("me.tabSessions") },
];

export default function MePage() {
  const t = useT();
  const { me } = useMe();
  const [active, setActive] = useState("profil");
  if (!me) return null;

  return (
    <div className="flex max-w-[680px] flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">{t("me.title")}</h1>
      <TabBar tabs={buildTabs(t)} activeId={active} onChange={setActive} />
      <div>
        {active === "profil"   && <ProfileTab me={me} />}
        {active === "password" && <PasswordTab />}
        {active === "sessions" && <SessionsTab me={me} />}
      </div>
    </div>
  );
}