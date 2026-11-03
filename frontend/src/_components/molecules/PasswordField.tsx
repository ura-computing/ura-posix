import { forwardRef, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import type { InputHTMLAttributes } from "react";

import { Button } from "@/_components/atoms/Button";
import { Input, type InputProps } from "@/_components/atoms/Input";
import { TextField } from "@/_components/molecules/TextField";
import { useT } from "@/i18n/I18nProvider";

interface Props extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  label: string;
  error?: string;
  hint?: string;
}

/** The eye inside a password input: shows / hides what was typed. */
function EyeToggle({ visible, onToggle }: { visible: boolean; onToggle: () => void }) {
  const t = useT();
  const Icon = visible ? EyeOff : Eye;
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      onClick={onToggle}
      aria-label={visible ? t("shared.hidePassword") : t("shared.showPassword")}
      className="text-muted-foreground"
    >
      <Icon className="size-4" />
    </Button>
  );
}

export const PasswordField = forwardRef<HTMLInputElement, Props>(function PasswordField(props, ref) {
  const [visible, setVisible] = useState(false);

  return (
    <TextField
      ref={ref}
      type={visible ? "text" : "password"}
      autoComplete="current-password"
      rightSlot={<EyeToggle visible={visible} onToggle={() => setVisible((v) => !v)} />}
      {...props}
    />
  );
});

/** A password input without its own label (inside a `FormField`), with the same eye. */
export function PasswordInput({
  value,
  onChange,
  ...rest
}: { value: string; onChange: (v: string) => void } & Omit<
  InputProps,
  "value" | "onChange" | "onValueChange" | "type" | "rightSlot"
>) {
  const [visible, setVisible] = useState(false);
  return (
    <Input
      {...rest}
      type={visible ? "text" : "password"}
      value={value}
      onValueChange={onChange}
      rightSlot={<EyeToggle visible={visible} onToggle={() => setVisible((v) => !v)} />}
    />
  );
}
