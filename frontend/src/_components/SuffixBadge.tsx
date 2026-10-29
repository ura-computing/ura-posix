import { Badge } from "@/_components/atoms/Badge";
import type { SuffixColor } from "@/types";
import { cn } from "@/utils/cn";

const TINT: Record<SuffixColor, { bg: string; fg: string; border: string }> = {
  teal: {
    bg: "bg-teal-50/70    dark:bg-teal-500/15",
    fg: "text-teal-700    dark:text-teal-300",
    border: "border-teal-200/70    dark:border-teal-500/30",
  },
  blue: {
    bg: "bg-blue-50/70    dark:bg-blue-500/15",
    fg: "text-blue-700    dark:text-blue-300",
    border: "border-blue-200/70    dark:border-blue-500/30",
  },
  purple: {
    bg: "bg-purple-50/70  dark:bg-purple-500/15",
    fg: "text-purple-700  dark:text-purple-300",
    border: "border-purple-200/70  dark:border-purple-500/30",
  },
  amber: {
    bg: "bg-amber-50/70   dark:bg-amber-500/15",
    fg: "text-amber-700   dark:text-amber-300",
    border: "border-amber-200/70   dark:border-amber-500/30",
  },
  rose: {
    bg: "bg-rose-50/70    dark:bg-rose-500/15",
    fg: "text-rose-700    dark:text-rose-300",
    border: "border-rose-200/70    dark:border-rose-500/30",
  },
  emerald: {
    bg: "bg-emerald-50/70 dark:bg-emerald-500/15",
    fg: "text-emerald-700 dark:text-emerald-300",
    border: "border-emerald-200/70 dark:border-emerald-500/30",
  },
  orange: {
    bg: "bg-orange-50/70  dark:bg-orange-500/15",
    fg: "text-orange-700  dark:text-orange-300",
    border: "border-orange-200/70  dark:border-orange-500/30",
  },
  pink: {
    bg: "bg-pink-50/70    dark:bg-pink-500/15",
    fg: "text-pink-700    dark:text-pink-300",
    border: "border-pink-200/70    dark:border-pink-500/30",
  },
};

const NEUTRAL = { bg: "bg-muted", fg: "text-muted-foreground", border: "border-border" };

/** Small pill appended to a reference (ventes / achats) or shown in the
 *  categories list. Color from the row's CategorySuffix; « Aucune » (null) →
 *  neutral grey pill. Renders nothing without a suffix. */
export function SuffixBadge({ text, color }: { text: string | null; color: SuffixColor | null }) {
  if (!text) return null;
  const t = color ? TINT[color] : NEUTRAL;
  return (
    <Badge className={cn("ml-1 px-1.5 py-px font-mono text-[10px] font-semibold", t.bg, t.fg, t.border)}>{text}</Badge>
  );
}
