/** The text controls of the app, one look: 36 px, light surface, red border when `invalid`.
 *  - `Input`: `onValueChange` gets the text (or `onChange` the event); `leftIcon` / `rightSlot`
 *    (e.g. the eye of a password) inside its edges
 *  - `SearchInput`: loupe + ✕ to clear; one size everywhere (filters, Produits spéciaux…)
 *  - `Textarea`: same border and focus (a dropdown: `SingleSelect`, the app's own list) */
import type { InputHTMLAttributes, ReactNode, Ref, TextareaHTMLAttributes } from "react";
import { Search, X } from "lucide-react";

import { useT } from "@/i18n/I18nProvider";
import { cn } from "@/utils/cn";

const FIELD =
  "w-full rounded-md border bg-surface-subtle text-sm text-foreground placeholder:text-muted-foreground transition-colors duration-fast focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-60";

const border = (invalid?: boolean) => (invalid ? "border-error" : "border-input");

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
  onValueChange?: (value: string) => void;
  leftIcon?: ReactNode;
  rightSlot?: ReactNode;
  ref?: Ref<HTMLInputElement>;
}

export function Input({ invalid, onValueChange, onChange, leftIcon, rightSlot, className, ...rest }: InputProps) {
  const input = (
    <input
      aria-invalid={invalid || undefined}
      onChange={(e) => {
        onChange?.(e);
        onValueChange?.(e.target.value);
      }}
      className={cn(FIELD, "h-9 px-3", border(invalid), leftIcon && "pl-9", rightSlot && "pr-10", className)}
      {...rest}
    />
  );
  if (!leftIcon && !rightSlot) return input;
  return (
    <div className="relative w-full">
      {leftIcon && (
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
          {leftIcon}
        </span>
      )}
      {input}
      {rightSlot && <div className="absolute inset-y-0 right-0 flex items-center pr-1.5">{rightSlot}</div>}
    </div>
  );
}

export function SearchInput({
  value,
  onValueChange,
  className,
  ...rest
}: Omit<InputProps, "value" | "onValueChange" | "leftIcon" | "rightSlot" | "type"> & {
  value: string;
  onValueChange: (value: string) => void;
}) {
  const t = useT();
  return (
    <Input
      type="search"
      value={value}
      onValueChange={onValueChange}
      leftIcon={<Search className="size-4" />}
      rightSlot={
        value ? (
          <button
            type="button"
            onClick={() => onValueChange("")}
            aria-label={t("shared.clearSearch")}
            className="cursor-pointer rounded p-1 text-muted-foreground hover:text-foreground"
          >
            <X className="size-3.5" />
          </button>
        ) : undefined
      }
      className={cn("[&::-webkit-search-cancel-button]:hidden", className)}
      {...rest}
    />
  );
}

export function Textarea({
  invalid,
  className,
  ...rest
}: TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean; ref?: Ref<HTMLTextAreaElement> }) {
  return (
    <textarea
      aria-invalid={invalid || undefined}
      className={cn(FIELD, "resize-none px-3 py-2", border(invalid), className)}
      {...rest}
    />
  );
}
