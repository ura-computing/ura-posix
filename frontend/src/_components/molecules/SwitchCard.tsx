/** One on / off setting as a card: icon, title (+ a tag), one-line explanation, switch. Admin « Fonctionnalités de la
 *  pharmacie », « Mon compte » → « Verrouillage ». `dirty`: changed, not saved yet (primary tint). */
import type { ComponentType, ReactNode } from "react";

import { Switch } from "@/_components/atoms/Switch";
import { cn } from "@/utils/cn";

export function SwitchCard({
  icon: Icon,
  title,
  tag,
  description,
  checked,
  onChange,
  disabled,
  dirty,
  className,
}: {
  icon: ComponentType<{ className?: string }>;
  title: string;
  tag?: ReactNode;
  description: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  dirty?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-xl border border-border bg-card p-3.5 transition-colors",
        dirty && "border-primary/40 bg-primary/5",
        className,
      )}
    >
      <span
        data-on={checked}
        className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground data-[on=true]:bg-primary/15 data-[on=true]:text-primary"
      >
        <Icon className="size-4" />
      </span>
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
          {title}
          {tag}
        </span>
        <span className="text-[11.5px] leading-snug text-muted-foreground">{description}</span>
      </div>
      <Switch checked={checked} onChange={onChange} disabled={disabled} aria-label={title} />
    </div>
  );
}
