/** The app's button look (frontend/src/_components/AsyncButton.tsx): primary / secondary. */
import type { ButtonHTMLAttributes } from "react";

const variants = {
  primary: "bg-primary text-primary-foreground hover:bg-primary-hover active:bg-primary-active",
  secondary: "border border-border bg-secondary text-secondary-foreground hover:bg-muted",
};

export function Button({
  variant = "primary",
  className = "",
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: keyof typeof variants }) {
  return (
    <button
      type="button"
      className={[
        "inline-flex cursor-pointer items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium",
        "transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
        "disabled:cursor-not-allowed disabled:opacity-60",
        variants[variant],
        className,
      ].join(" ")}
      {...rest}
    />
  );
}
