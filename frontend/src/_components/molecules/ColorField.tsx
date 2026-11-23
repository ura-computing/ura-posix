/** One color to pick: label above, the browser's color picker + the hex code. Store editor « Couleurs ».
 *  Example: `<ColorField label="Principale" value="#0E9E8C" onChange={setColor} />`. */
import { Input } from "@/_components/atoms/Input";
import { FormField } from "@/_components/molecules/FormField";

export function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (hex: string) => void;
}) {
  return (
    <FormField label={label}>
      <span className="flex items-center gap-3">
        <Input type="color" value={value} onValueChange={onChange} className="w-14 cursor-pointer p-1" />
        <span className="font-mono text-sm uppercase text-muted-foreground">{value}</span>
      </span>
    </FormField>
  );
}
