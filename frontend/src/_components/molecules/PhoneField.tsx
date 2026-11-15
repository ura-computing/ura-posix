/** A phone number: country code (+212, +33…) + the number, typed as it is read (« 06 12 34 56 78 »).
 *  `value` / `onChange`: E.164 (« +212612345678 »). Same look as `Input` (atoms/Input.tsx). */
import { forwardRef, useId, useState } from "react";
import { AsYouType, getCountryCallingCode, type CountryCode } from "libphonenumber-js";

import { useT } from "@/i18n/I18nProvider";
import { cn } from "@/utils/cn";
import { SingleSelect } from "@/_components/molecules/SingleSelect";

const COUNTRIES: { code: CountryCode; label: string }[] = [
  { code: "MA", label: "Maroc" },
  { code: "FR", label: "France" },
  { code: "ES", label: "Espagne" },
  { code: "US", label: "États-Unis" },
];

interface PhoneFieldProps {
  label: string;
  value: string; // stored as E.164, e.g. "+212600000000"
  onChange: (value: string) => void;
  country?: CountryCode;
  error?: string;
  hint?: string;
}

export const PhoneField = forwardRef<HTMLInputElement, PhoneFieldProps>(
  ({ label, value, onChange, country: countryProp, error, hint }, ref) => {
    const t = useT();
    const id = useId();
    const [country, setCountry] = useState<CountryCode>(countryProp ?? "MA");

    const dial = `+${getCountryCallingCode(country)}`;
    const national = value.startsWith(dial) ? value.slice(dial.length) : value.replace(/^\+/, "");
    const display = new AsYouType(country).input(national);

    const emit = (rawNational: string, c: CountryCode) =>
      onChange(`+${getCountryCallingCode(c)}${rawNational.replace(/\D/g, "")}`);

    return (
      <div className="flex flex-col gap-1.5">
        <label htmlFor={id} className="text-sm font-medium text-foreground">
          {label}
        </label>
        <div
          className={cn(
            "flex items-stretch overflow-hidden rounded-md border bg-surface-subtle",
            error ? "border-error" : "border-input",
            "focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-ring",
          )}
        >
          {/* The app's dropdown (not the browser's own list), inside the field. */}
          <SingleSelect
            inline
            label=""
            ariaLabel={t("shared.countryCode")}
            options={COUNTRIES.map((c) => ({ value: c.code, label: `+${getCountryCallingCode(c.code)}` }))}
            value={country}
            onChange={(v) => {
              const c = v as CountryCode;
              setCountry(c);
              emit(national, c);
            }}
          />
          <input
            id={id}
            ref={ref}
            type="tel"
            inputMode="tel"
            value={display}
            onChange={(e) => emit(e.target.value, country)}
            className="w-full bg-transparent px-3 py-2 text-sm text-foreground outline-none"
          />
        </div>
        {error ? (
          <span className="text-xs text-error-subtle-foreground">{error}</span>
        ) : hint ? (
          <span className="text-xs text-muted-foreground">{hint}</span>
        ) : null}
      </div>
    );
  },
);
PhoneField.displayName = "PhoneField";
