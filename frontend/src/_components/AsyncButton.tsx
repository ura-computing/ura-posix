import { Loader2 } from "lucide-react";
import type { ButtonHTMLAttributes, ReactNode } from "react";

import { cn } from "@/utils/cn";
import { useT } from "@/i18n/I18nProvider";

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  isLoading?: boolean;
  loadingText?: string;
  variant?: "primary" | "secondary" | "ghost" | "destructive";
  children: ReactNode;
}

const variants = {
  primary: "bg-primary text-primary-foreground hover:bg-primary-hover active:bg-primary-active",
  secondary: "bg-secondary text-secondary-foreground hover:bg-muted",
  ghost: "bg-transparent text-foreground hover:bg-muted",
  destructive: "bg-destructive text-destructive-foreground hover:opacity-90",
} as const;

export function AsyncButton({
  isLoading = false,
  loadingText,
  variant = "primary",
  children,
  className,
  disabled,
  type = "button",
  ...rest
}: Props) {
  const t = useT();
  const isDisabled = isLoading || disabled;
  return (
    <button
      type={type}
      disabled={isDisabled}
      aria-busy={isLoading || undefined}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium cursor-pointer",
        "transition-colors duration-fast",
        "focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2",
        "disabled:opacity-60 disabled:cursor-not-allowed",
        variants[variant],
        className,
      )}
      {...rest}
    >
      {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
      {isLoading ? (loadingText ?? t("common.loading")) : children}
    </button>
  );
}
