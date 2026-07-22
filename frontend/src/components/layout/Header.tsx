import { useLocation } from "react-router-dom";
import { Menu } from "lucide-react";

import { LanguageToggle } from "@/components/shared/LanguageToggle";
import { ThemeToggle } from "@/components/shared/ThemeToggle";
import { PharmagestWordmark } from "@/components/shared/PharmagestWordmark";
import { useMe } from "@/hooks/useMe";
import { useT } from "@/i18n/I18nProvider";
import { ROLES } from "@/types";
import type { Role } from "@/types";

import { navTitle } from "./navConfig";

interface HeaderProps {
  onOpenMobile: () => void;
}

const ROLE_KEYS: Record<Role, string> = {
  [ROLES.ADMIN]:     "roles.admin",
  [ROLES.OWNER]:     "roles.owner",
  [ROLES.EMPLOYEE]:  "roles.employee",
  [ROLES.DEVELOPER]: "roles.developer",
};

export function Header({ onOpenMobile }: HeaderProps) {
  const { pathname } = useLocation();
  const { me } = useMe();
  const t = useT();
  const title = t(navTitle(pathname));
  const code = me?.pharmacy?.code;
  const roleLabel = me ? t(ROLE_KEYS[me.role]) : "";

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-card px-5">
      <div className="flex min-w-0 items-center gap-3">
        <button
          type="button"
          onClick={onOpenMobile}
          aria-label={t("nav.expand")}
          className="flex cursor-pointer p-1 text-foreground md:hidden"
        >
          <Menu className="size-[22px]" />
        </button>
        <div className="hidden min-w-0 flex-col md:flex">
          <span className="truncate text-sm font-semibold leading-tight tracking-tight">
            {title}
          </span>
          <span className="text-[11px] text-muted-foreground">{t("header.home")} · {title}</span>
        </div>
        <PharmagestWordmark className="md:hidden" iconSize={22} />
      </div>

      <div className="flex items-center gap-3">
        {me && (
          <div className="hidden items-center gap-2 md:flex">
            <span className="truncate text-xs font-medium text-foreground max-w-[160px]" title={me.name}>
              {me.name}
            </span>
            <span
              className="rounded-full border px-[11px] py-1 text-xs font-semibold"
              style={{
                background:  `color-mix(in srgb, var(--role-${me.role}) 14%, transparent)`,
                color:       `var(--role-${me.role})`,
                borderColor: `color-mix(in srgb, var(--role-${me.role}) 38%, transparent)`,
              }}
              aria-label={roleLabel}
            >
              {roleLabel}
            </span>
          </div>
        )}
        {code && (
          <span className="hidden rounded-full border border-border px-[11px] py-1 font-mono text-xs font-semibold text-muted-foreground md:inline">
            {code}
          </span>
        )}
        <LanguageToggle />
        <ThemeToggle />
      </div>
    </header>
  );
}