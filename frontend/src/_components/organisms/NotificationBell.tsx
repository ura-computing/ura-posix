/** The bell of the top bar (every user): a count of unread lines, and on click the last 30 lines, newest first.
 *  A line opens its page and becomes read; « Tout marquer comme lu » on top. Same panel as every dropdown
 *  (`popover.ts`), same trigger look as the theme switch. */
import { FloatingPortal } from "@floating-ui/react";
import { Bell, CircleAlert, CloudDownload, Globe, Tags, UserPlus, type LucideIcon } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { Button } from "@/_components/atoms/Button";
import { EmptyState } from "@/_components/molecules/EmptyState";
import { POPOVER_PANEL, usePopover } from "@/_components/molecules/popover";
import { useMe } from "@/hooks/useMe";
import { useNotifications } from "@/hooks/useNotifications";
import { useT } from "@/i18n/I18nProvider";
import type { NotificationKind, NotificationOut } from "@/types/notifications";
import { cn } from "@/utils/cn";
import { formatDateTime } from "@/utils/format";
import { notificationText } from "@/utils/notifications";

const ICON: Record<NotificationKind, LucideIcon> = {
  signupRequest: UserPlus,
  storeRequest: Globe,
  catalogueToClassify: Tags,
  sobrusDone: CloudDownload,
  sobrusFailed: CircleAlert,
  storeStep: Globe,
};

export function NotificationBell() {
  const t = useT();
  const navigate = useNavigate();
  const { me } = useMe();
  const { notifications, unread, markRead, markAllRead } = useNotifications();
  const { open, setOpen, triggerRef, panelRef, panelStyle, getReferenceProps, getFloatingProps } = usePopover(
    "bottom",
    "end",
  );

  const openLine = (n: NotificationOut) => {
    if (!n.read_at) markRead(n.id);
    setOpen(false);
    if (n.link && me) navigate(`/${me.role}/${n.link}`);
  };

  return (
    <>
      <div className="flex items-center rounded-[9px] border border-border bg-surface-subtle p-0.5">
        <button
          ref={triggerRef}
          type="button"
          aria-label={t("notifications.title")}
          aria-expanded={open}
          {...getReferenceProps({ onClick: () => setOpen(!open) })}
          className="relative flex h-7 w-[30px] cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground"
        >
          <Bell className="size-[15px]" aria-hidden />
          {unread > 0 && (
            <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold tabular-nums text-destructive-foreground">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </button>
      </div>
      {open && (
        <FloatingPortal>
          <div
            ref={panelRef}
            {...getFloatingProps()}
            style={panelStyle}
            className={cn(POPOVER_PANEL, "max-h-[28rem] w-96 max-w-[calc(100vw-2rem)] p-0")}
          >
            <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
              <span className="text-sm font-semibold text-foreground">{t("notifications.title")}</span>
              <Button variant="link" disabled={unread === 0} onClick={() => markAllRead()}>
                {t("notifications.readAll")}
              </Button>
            </div>
            {notifications.length === 0 ? (
              <EmptyState icon={<Bell className="size-5" />} title={t("notifications.empty")} className="py-10" />
            ) : (
              <ul data-list="notifications" className="flex flex-col divide-y divide-border">
                {notifications.map((n) => {
                  const Icon = ICON[n.kind] ?? Bell;
                  return (
                    <li key={n.id}>
                      <button
                        type="button"
                        onClick={() => openLine(n)}
                        className={cn(
                          "flex w-full cursor-pointer items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-subtle",
                          !n.read_at && "bg-primary/5",
                        )}
                      >
                        <span
                          className={cn(
                            "flex size-8 shrink-0 items-center justify-center rounded-lg",
                            n.kind === "sobrusFailed" ? "bg-error-subtle text-error" : "bg-primary/10 text-primary",
                          )}
                        >
                          <Icon className="size-4" aria-hidden />
                        </span>
                        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                          <span className={cn("text-sm text-foreground", !n.read_at && "font-semibold")}>
                            {notificationText(t, n)}
                          </span>
                          <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
                            {formatDateTime(n.created_at)}
                          </span>
                        </span>
                        {!n.read_at && <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" aria-hidden />}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </FloatingPortal>
      )}
    </>
  );
}
