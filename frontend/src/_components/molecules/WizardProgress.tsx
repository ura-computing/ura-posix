/** The top of a step-by-step form (like Gmail's sign-up): one bar per step, filled up to this one, then
 *  « Créer un compte · Étape 2 sur 5 ». `current` is 0-based. */
import { useT } from "@/i18n/I18nProvider";
import { cn } from "@/utils/cn";

export function WizardProgress({ label, total, current }: { label: string; total: number; current: number }) {
  const t = useT();
  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-1.5" aria-hidden>
        {Array.from({ length: total }, (_, i) => (
          <span key={i} className={cn("h-1 flex-1 rounded-full", i <= current ? "bg-primary" : "bg-muted")} />
        ))}
      </div>
      <span className="text-xs font-medium text-muted-foreground">
        {label} · {t("signup.stepOf", { n: current + 1, total })}
      </span>
    </div>
  );
}
