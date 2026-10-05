/** Form pieces shared by every dialog form (user, pharmacy, catégorie, paiement). */

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

/** Text input bound to a string: `onChange` gets the value, not the event. */
export function FormInput({
  value,
  onChange,
  className,
  ...rest
}: { value: string; onChange: (v: string) => void; className?: string } & Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "value" | "onChange" | "className"
>) {
  return (
    <input
      {...rest}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`h-9 w-full rounded-md border border-input bg-surface-subtle px-3 text-sm focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2 ${className ?? ""}`}
    />
  );
}
