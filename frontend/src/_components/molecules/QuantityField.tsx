/** A whole number of boxes: « − », the number (typed or scanned), « + ». Big buttons, never the browser's tiny arrows.
 *  `value` is the text typed (« » while erasing); the caller reads `Number(value)`.
 *
 *    <QuantityField label="Boîtes" value={qty} onChange={setQty} min={1} />   // 1 → « + » → 2 */
import { Minus, Plus } from "lucide-react";

import { Button } from "@/_components/atoms/Button";
import { Input } from "@/_components/atoms/Input";

interface Props {
  label: string;
  value: string;
  onChange: (value: string) => void;
  min?: number;
  max?: number;
  error?: string;
  autoFocus?: boolean;
  decreaseLabel: string;
  increaseLabel: string;
}

export function QuantityField({
  label,
  value,
  onChange,
  min = 0,
  max = 100_000,
  error,
  autoFocus,
  decreaseLabel,
  increaseLabel,
}: Props) {
  const n = Number(value) || 0;
  const step = (by: number) => onChange(String(Math.min(max, Math.max(min, n + by))));
  return (
    <div className="flex flex-col gap-1.5" role="group" aria-label={label}>
      <span className="text-sm font-medium text-foreground">{label}</span>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="icon" aria-label={decreaseLabel} onClick={() => step(-1)} disabled={n <= min}>
          <Minus className="size-4" />
        </Button>
        <Input
          inputMode="numeric"
          className="w-24 text-center font-mono text-base font-semibold"
          value={value}
          onChange={(e) => onChange(e.target.value.replace(/\D/g, ""))}
          invalid={!!error}
          autoFocus={autoFocus}
          aria-label={label}
        />
        <Button variant="outline" size="icon" aria-label={increaseLabel} onClick={() => step(1)} disabled={n >= max}>
          <Plus className="size-4" />
        </Button>
      </div>
      {error && <p className="text-xs text-error-subtle-foreground">{error}</p>}
    </div>
  );
}
