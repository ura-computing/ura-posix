interface Props {
  className?: string;
  size?: number;
  ariaHidden?: boolean;
}

/**
 * PharmaGest brand mark. The ring is the G of Gest (closed loop of care),
 * the medical + sits on the crossbar.
 * Stroke uses `currentColor` so any text-* class tints it.
 *
 * Children selectors (used by 404 spinning-ring layout):
 *   [&_path]:hidden  → hides the medical + (keeps the ring only)
 *   [&_line]:hidden  → hides the ring (keeps the + only)
 */
export function PharmagestIcon({ className, size = 24, ariaHidden }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 240 240"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role={ariaHidden ? undefined : "img"}
      aria-label={ariaHidden ? undefined : "PharmaGest"}
      aria-hidden={ariaHidden || undefined}
      className={className}
    >
      <path d="M 216 120 A 96 96 0 1 1 200.5 67.7" stroke="currentColor" strokeWidth="22" strokeLinecap="round" />
      <line x1="120" y1="120" x2="214" y2="120" stroke="currentColor" strokeWidth="22" strokeLinecap="round" />
      <line x1="158" y1="92" x2="158" y2="148" stroke="currentColor" strokeWidth="22" strokeLinecap="round" />
    </svg>
  );
}
