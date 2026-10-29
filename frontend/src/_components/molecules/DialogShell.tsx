/** The parts of every dialog, one look: `DialogHeader` (title 17 px, optional line under it, ✕),
 *  `DialogBody` (the content, scrolls when long), `DialogFooter` (buttons on the right).
 *  Put them inside `Dialog` + `DialogContent` (dialog.tsx). */
import type { ReactNode } from "react";
import { X } from "lucide-react";

import { Button } from "@/_components/atoms/Button";
import { useT } from "@/i18n/I18nProvider";
import { cn } from "@/utils/cn";

export function DialogHeader({
  title,
  subtitle,
  icon,
  media,
  onClose,
  children,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  /** Left of the title, in a primary tile (a lucide icon). */
  icon?: ReactNode;
  /** Left of the title as is (an avatar). */
  media?: ReactNode;
  /** The ✕; none when the dialog must be answered. */
  onClose?: () => void;
  /** Under the title (badges, a small form). */
  children?: ReactNode;
}) {
  const t = useT();
  return (
    <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
      <div className="flex min-w-0 items-start gap-3">
        {icon && (
          <span className="flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-primary/15 text-primary">
            {icon}
          </span>
        )}
        {media}
        <div className="flex min-w-0 flex-col gap-0.5">
          <h2 className="text-[17px] font-semibold text-foreground">{title}</h2>
          {subtitle && <div className="text-sm text-muted-foreground">{subtitle}</div>}
          {children}
        </div>
      </div>
      {onClose && (
        <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label={t("common.close")} className="-mr-1">
          <X className="size-4" />
        </Button>
      )}
    </div>
  );
}

export function DialogBody({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div className={cn("flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-5 py-4", className)}>{children}</div>
  );
}

export function DialogFooter({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-end gap-2 border-t border-border bg-surface-subtle px-5 py-3",
        className,
      )}
    >
      {children}
    </div>
  );
}
