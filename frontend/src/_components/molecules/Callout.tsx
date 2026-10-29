/** A message in the page: an error with « Réessayer », a warning, an information. Its icon, its text,
 *  its action on the right; `onDismiss` adds a ✕. `role="alert"` for errors (read at once). */
import type { ReactNode } from "react";
import { CircleAlert, CircleCheck, Info, TriangleAlert, X } from "lucide-react";

import { Button } from "@/_components/atoms/Button";
import { Card } from "@/_components/atoms/Card";
import { useT } from "@/i18n/I18nProvider";
import { cn } from "@/utils/cn";

const ICON = { error: CircleAlert, warning: TriangleAlert, info: Info, success: CircleCheck } as const;

export function Callout({
  tone = "info",
  title,
  children,
  action,
  onDismiss,
  className,
}: {
  tone?: keyof typeof ICON;
  title?: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
  onDismiss?: () => void;
  className?: string;
}) {
  const t = useT();
  const Icon = ICON[tone];
  return (
    <Card
      as="div"
      tone={tone}
      padding="sm"
      role={tone === "error" ? "alert" : "status"}
      className={cn("flex flex-wrap items-start gap-3 shadow-none", className)}
    >
      <Icon className="mt-0.5 size-5 shrink-0" aria-hidden />
      <div className="flex min-w-0 flex-1 flex-col gap-1 text-sm">
        {title && <div className="font-semibold">{title}</div>}
        {children && <div className="font-medium">{children}</div>}
      </div>
      {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
      {onDismiss && (
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onDismiss}
          aria-label={t("common.close")}
          className="text-current"
        >
          <X className="size-4" />
        </Button>
      )}
    </Card>
  );
}
