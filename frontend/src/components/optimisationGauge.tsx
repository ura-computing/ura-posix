import { GAUGE_COLORS } from "@/constants/theme";
import { fmt } from "@/utils/format";

export function OptimisationGauge({ gain }: { gain: number | null }) {
  const val = gain ?? 0;
  const clamped = Math.min(100, Math.max(0, val > 0 ? Math.min(50 + val / 2, 100) : Math.max(50 + val / 2, 0)));
  const angle = 90 - (clamped / 100) * 180;

  return (
    <div className="flex flex-col items-center">
      <p className="text-xs font-medium text-muted-foreground mb-1">Optimisation marge</p>
      <svg viewBox="0 0 200 120" className="w-40 h-24">
        <path d="M 20 100 A 80 80 0 0 1 56 28" fill="none" stroke={GAUGE_COLORS.badHex} strokeWidth="16" strokeLinecap="round" />
        <path d="M 56 28 A 80 80 0 0 1 144 28" fill="none" stroke={GAUGE_COLORS.warnHex} strokeWidth="16" />
        <path d="M 144 28 A 80 80 0 0 1 180 100" fill="none" stroke={GAUGE_COLORS.goodHex} strokeWidth="16" strokeLinecap="round" />
        <g transform={`rotate(${angle}, 100, 100)`}>
          <line x1="100" y1="100" x2="100" y2="30" stroke={GAUGE_COLORS.needleHex} strokeWidth="3" strokeLinecap="round" />
          <circle cx="100" cy="100" r="6" fill={GAUGE_COLORS.needleHex} />
          <circle cx="100" cy="100" r="3" fill="white" />
        </g>
      </svg>
      <p className="text-sm font-bold mt-1">{val > 0 ? "+" : ""}{fmt(val)} MAD</p>
    </div>
  );
}
