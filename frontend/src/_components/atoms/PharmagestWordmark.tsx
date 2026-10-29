import { PharmagestIcon } from "@/_components/atoms/PharmagestIcon";
import { cn } from "@/utils/cn";

interface Props {
  className?: string;
  /** Icon pixel size. The text scales with the parent font-size class. */
  iconSize?: number;
}

/**
 * Brand wordmark: icon + "Pharma" + "Gest".
 * "Pharma" inherits the foreground color; "Gest" is brand teal via text-primary.
 * Themes automatically in light + dark via tokens.
 */
export function PharmagestWordmark({ className, iconSize = 28 }: Props) {
  return (
    <span className={cn("inline-flex items-center gap-2 font-extrabold tracking-tight", className)}>
      <PharmagestIcon className="text-primary shrink-0" size={iconSize} />
      <span>
        <span className="text-foreground">Pharma</span>
        <span className="text-primary">Gest</span>
      </span>
    </span>
  );
}
