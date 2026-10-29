/** Form pieces shared by every dialog form (user, pharmacy, catégorie, paiement). */
import { Input, type InputProps } from "@/_components/atoms/Input";

/** Label (+ red * when required) above its input, optional hint below.
 *  `group`: children are buttons (role cards, picker, copy) — render a
 *  div role="group", not a <label>: a <label> names its first button after the
 *  whole block (the Propriétaire card was announced "Rôle* Employé…"). */
export function FormField({
  label,
  required,
  hint,
  group,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  group?: boolean;
  children: React.ReactNode;
}) {
  const Tag = group ? "div" : "label";
  return (
    <Tag className="flex flex-col gap-1.5" {...(group ? { role: "group", "aria-label": label } : {})}>
      <span className="text-sm font-medium text-foreground">
        {label}
        {required && <span className="ml-1 text-error">*</span>}
      </span>
      {children}
      {hint && <span className="text-[11.5px] leading-snug text-muted-foreground">{hint}</span>}
    </Tag>
  );
}

/** Text input bound to a string: `onChange` gets the value, not the event (the `Input` atom). */
export function FormInput({
  value,
  onChange,
  ...rest
}: { value: string; onChange: (v: string) => void } & Omit<InputProps, "value" | "onChange" | "onValueChange">) {
  return <Input {...rest} value={value} onValueChange={onChange} />;
}
