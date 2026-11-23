/** The top bar of every page: its title, the language, the theme, the account. */
import { useLocation } from "react-router-dom";

import { useMe } from "@/hooks/useMe";
import { ROLES } from "@/types";
import { Menu } from "lucide-react";
import type { Role } from "@/types";
import { useI18n, useT } from "@/i18n/I18nProvider";
import { LANGS, LANG_LABELS } from "@/i18n/config";
import { cn } from "@/utils/cn";
import { ThemeToggle } from "@/_components/molecules/ThemeToggle";
import { PharmagestWordmark } from "@/_components/atoms/PharmagestWordmark";
import { navTitle } from "@/_components/templates/nav";

function LanguageToggle() {
  const { lang, setLang, t } = useI18n();
  return (
    <div
      className="flex items-center gap-0.5 rounded-[9px] border border-border bg-surface-subtle p-0.5"
      aria-label={t("lang.label")}
    >
      {LANGS.map((l) => {
        const active = lang === l;
        return (
          <button
            key={l}
            type="button"
            onClick={() => setLang(l)}
            aria-label={t(`lang.${l}`)}
            aria-pressed={active}
            className={cn(
              "flex h-7 w-[30px] cursor-pointer items-center justify-center rounded-md text-[11px] font-bold transition-colors",
              active ? "bg-card text-primary shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {LANG_LABELS[l]}
          </button>
        );
      })}
    </div>
  );
}

export interface HeaderProps {
  onOpenMobile: () => void;
}

const ROLE_KEYS: Record<Role, string> = {
  [ROLES.ADMIN]: "roles.admin",
  [ROLES.SUPPORT]: "roles.support",
  [ROLES.OWNER]: "roles.owner",
  [ROLES.EMPLOYEE]: "roles.employee",
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
          <span className="truncate text-sm font-semibold leading-tight tracking-tight">{title}</span>
          <span className="text-[11px] text-muted-foreground">
            {t("header.home")} · {title}
          </span>
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
                background: `color-mix(in srgb, var(--role-${me.role}) 14%, transparent)`,
                color: `var(--role-${me.role})`,
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

/** Admin catalog hooks — used cross-page (Sidebar badge + admin/catalogue page).
 *  Page-local catalog state stays in pages/admin/catalogue/_hooks/. */

/** Admin-only count of unclassified medicaments. Drives the "Catalogue"
 *  sidebar badge. Refetches every 60s; cheap query. */
