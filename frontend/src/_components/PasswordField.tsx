import { forwardRef, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import type { InputHTMLAttributes } from "react";

import { TextField } from "./TextField";
import { useT } from "@/i18n/I18nProvider";

interface Props extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  label: string;
  error?: string;
  hint?: string;
}

export const PasswordField = forwardRef<HTMLInputElement, Props>(function PasswordField(props, ref) {
  const [visible, setVisible] = useState(false);
  const Icon = visible ? EyeOff : Eye;
  const t = useT();
  const toggleLabel = visible ? t("shared.hidePassword") : t("shared.showPassword");

  return (
    <TextField
      ref={ref}
      type={visible ? "text" : "password"}
      autoComplete="current-password"
      rightSlot={
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={toggleLabel}
          className="rounded p-1.5 text-muted-foreground cursor-pointer hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
        >
          <Icon className="h-4 w-4" />
        </button>
      }
      {...props}
    />
  );
});