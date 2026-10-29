import { forwardRef, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import type { InputHTMLAttributes } from "react";

import { Button } from "@/_components/atoms/Button";
import { TextField } from "@/_components/molecules/TextField";
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
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => setVisible((v) => !v)}
          aria-label={toggleLabel}
          className="text-muted-foreground"
        >
          <Icon className="size-4" />
        </Button>
      }
      {...props}
    />
  );
});
