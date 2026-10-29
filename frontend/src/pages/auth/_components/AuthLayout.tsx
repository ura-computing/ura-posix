import type { ReactNode } from "react";

import { ThemeToggle } from "@/_components/molecules/ThemeToggle";
import { PharmagestIcon } from "@/_components/atoms/PharmagestIcon";
import { useT } from "@/i18n/I18nProvider";

function BrandPanel() {
  const t = useT();
  return (
    <aside className="brand-aurora hidden md:flex flex-col justify-between p-12 text-white">
      <div className="flex items-center gap-3">
        <PharmagestIcon size={42} className="text-white" />
        <span className="text-2xl font-semibold tracking-tight">PharmaGest</span>
      </div>
      <div className="space-y-3">
        <h2 className="text-3xl font-semibold leading-tight max-w-md">{t("auth.brandTitle")}</h2>
        <p className="text-base opacity-80 max-w-md">{t("auth.brandText")}</p>
      </div>
      <p className="text-sm opacity-60">© 2026 PharmaGest</p>
    </aside>
  );
}

interface Props {
  children: ReactNode;
}

export function AuthLayout({ children }: Props) {
  return (
    <div className="grid min-h-screen md:grid-cols-[1fr_minmax(360px,520px)]">
      <BrandPanel />
      <main className="relative flex items-center justify-center bg-background p-6 md:p-12">
        <div className="absolute right-5 top-5">
          <ThemeToggle />
        </div>
        <div className="w-full max-w-sm">{children}</div>
      </main>
    </div>
  );
}
