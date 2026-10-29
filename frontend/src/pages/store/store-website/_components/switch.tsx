/** Shim mapping shadcn's <Switch checked onCheckedChange> API to the
 *  existing apcm `<Switch checked onChange>` primitive. */
import { Switch as SharedSwitch } from "@/_components/atoms/Switch";

export interface SwitchProps {
  checked: boolean;
  onCheckedChange?: (next: boolean) => void;
  disabled?: boolean;
  className?: string;
  "aria-label"?: string;
}

export function Switch({ onCheckedChange, ...rest }: SwitchProps) {
  return <SharedSwitch {...rest} onChange={onCheckedChange} />;
}
