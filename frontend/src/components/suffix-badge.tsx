const COLOR_MAP: Record<string, string> = {
  teal:    "bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300",
  blue:    "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  purple:  "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300",
  amber:   "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  rose:    "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300",
  emerald: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  orange:  "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
  pink:    "bg-pink-100 text-pink-700 dark:bg-pink-900/40 dark:text-pink-300",
};

export const SUFFIX_COLORS = Object.keys(COLOR_MAP);

export const SWATCH_BG: Record<string, string> = {
  teal:    "bg-teal-500",
  blue:    "bg-blue-500",
  purple:  "bg-purple-500",
  amber:   "bg-amber-500",
  rose:    "bg-rose-500",
  emerald: "bg-emerald-500",
  orange:  "bg-orange-500",
  pink:    "bg-pink-500",
};

export function SuffixBadge({
  suffix,
  color,
}: {
  suffix: string;
  color: string | null | undefined;
}) {
  const cls = color && COLOR_MAP[color]
    ? COLOR_MAP[color]
    : "bg-muted text-muted-foreground";
  return (
    <span className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-semibold font-mono ${cls}`}>
      {suffix}
    </span>
  );
}
