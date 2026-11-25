/** The account, top right of every page: a round button with the person's initials (their role's color); a click
 *  opens « Mon compte » and « Déconnexion » (red). ESC or a click outside closes it. */
import { FloatingPortal } from "@floating-ui/react";
import { CircleUser, LogOut } from "lucide-react";
import { Link } from "react-router-dom";

import { POPOVER_OPTION, POPOVER_PANEL, usePopover } from "@/_components/molecules/popover";
import { useLogout } from "@/hooks/useLogout";
import { useMe } from "@/hooks/useMe";
import { useT } from "@/i18n/I18nProvider";
import { ROUTES } from "@/routes";
import { cn } from "@/utils/cn";

/** « Karim Bennani » → « KB »; « ali@gmail.com » → « A ». */
const initials = (name: string) =>
  name
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");

export function ProfileMenu() {
  const t = useT();
  const { me } = useMe();
  const { handleLogout, isPending } = useLogout();
  const { open, setOpen, triggerRef, panelRef, panelStyle, getReferenceProps, getFloatingProps } = usePopover(
    "bottom",
    "end",
  );
  if (!me) return null;
  const color = `var(--role-${me.role})`;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-label={t("header.account")}
        aria-expanded={open}
        title={me.name}
        {...getReferenceProps({ onClick: () => setOpen(!open) })}
        className="flex size-9 cursor-pointer items-center justify-center rounded-full border-2 text-xs font-bold transition-shadow hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        style={{
          color,
          borderColor: `color-mix(in srgb, ${color} 45%, transparent)`,
          background: `color-mix(in srgb, ${color} 14%, transparent)`,
        }}
      >
        {initials(me.name)}
      </button>
      {open && (
        <FloatingPortal>
          <div
            ref={panelRef}
            {...getFloatingProps()}
            style={panelStyle}
            className={cn(POPOVER_PANEL, "w-60 p-1")}
            role="menu"
          >
            <div className="flex flex-col border-b border-border px-2 pb-2 pt-1">
              <span className="truncate text-sm font-semibold text-foreground">{me.name}</span>
              <span className="truncate text-xs text-muted-foreground">{me.email}</span>
            </div>
            <Link
              to={ROUTES.ME}
              role="menuitem"
              onClick={() => setOpen(false)}
              className={cn(POPOVER_OPTION, "mt-1 justify-between py-2")}
            >
              {t("nav.compte")}
              <CircleUser className="size-4 text-muted-foreground" aria-hidden />
            </Link>
            <button
              type="button"
              role="menuitem"
              disabled={isPending}
              onClick={handleLogout}
              className={cn(POPOVER_OPTION, "justify-between py-2 text-destructive hover:bg-destructive/5")}
            >
              {t("header.logout")}
              <LogOut className="size-4" aria-hidden />
            </button>
          </div>
        </FloatingPortal>
      )}
    </>
  );
}
