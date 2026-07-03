import { useState } from "react";

import { TabBar } from "@/components/shared/TabBar";
import type { TabItem } from "@/components/shared/TabBar";
import { useMe } from "@/hooks/useMe";

import { PasswordTab } from "./_components/PasswordTab";
import { ProfileTab } from "./_components/ProfileTab";
import { SessionsTab } from "./_components/SessionsTab";

const TABS: TabItem[] = [
  { id: "profil",   label: "Profil" },
  { id: "password", label: "Mot de passe" },
  { id: "sessions", label: "Sessions" },
];

export default function MePage() {
  const { me } = useMe();
  const [active, setActive] = useState("profil");
  if (!me) return null;

  return (
    <div className="flex max-w-[680px] flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">Mon compte</h1>
      <TabBar tabs={TABS} activeId={active} onChange={setActive} />
      <div>
        {active === "profil"   && <ProfileTab me={me} />}
        {active === "password" && <PasswordTab />}
        {active === "sessions" && <SessionsTab me={me} />}
      </div>
    </div>
  );
}