/** The 6-digit code of the lock screen, in the app's password field (label, eye, hint / error): digits only, 6 at
 *  most. `onComplete`: the 6th digit typed (the lock screen unlocks at once). Lock screen, « Mon compte »,
 *  « Réinitialiser le code ». */
import { PasswordField } from "@/_components/molecules/PasswordField";

export function PinField({
  label,
  value,
  onChange,
  onComplete,
  hint,
  error,
  autoFocus,
}: {
  label: string;
  value: string;
  onChange: (pin: string) => void;
  onComplete?: (pin: string) => void;
  hint?: string;
  error?: string;
  autoFocus?: boolean;
}) {
  return (
    <PasswordField
      label={label}
      value={value}
      onChange={(e) => {
        const pin = e.target.value.replace(/\D/g, "").slice(0, 6);
        onChange(pin);
        if (pin.length === 6) onComplete?.(pin);
      }}
      inputMode="numeric"
      autoComplete="one-time-code"
      // No `maxLength`: the browser would cut « 12 34 56 » (pasted) to « 12 34 » before the digits are kept.
      placeholder="••••••"
      hint={hint}
      error={error}
      autoFocus={autoFocus}
    />
  );
}
