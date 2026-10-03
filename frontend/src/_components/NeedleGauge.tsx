/** Shared hand-rolled SVG needle gauge.
 *
 *  Semantics: `value` is a 0-100 "goodness percentage".
 *    - value=0   → needle points fully LEFT (red zone)   — critical
 *    - value=50  → needle points UP (yellow zone)        — neutral
 *    - value=100 → needle points fully RIGHT (green zone) — healthy
 *
 *  Used on:
 *    - Achats SupplierGauge      → value = 100 − grossiste_pct (more direct labo = better)
 *    - Stock AbcdAnalysisCard    → value = health_score × 10  (more ideal-coverage = better)
 *
 *  Arc geometry: 3 zones, RED 20% / YELLOW 60% / GREEN 20%. Same proportions
 *  as apcm-pharma's gauge. Needle reaches ~90% of the arc radius so it visibly
 *  meets the arc instead of falling short.
 */

const SIZE_W = 200;
const SIZE_H = 130;
const CX = 100;
const CY = 105;
const R = 80;

function arcPath(startDeg: number, endDeg: number): string {
  const s = ((startDeg - 90) * Math.PI) / 180;
  const e = ((endDeg - 90) * Math.PI) / 180;
  const x1 = CX + R * Math.cos(s);
  const y1 = CY + R * Math.sin(s);
  const x2 = CX + R * Math.cos(e);
  const y2 = CY + R * Math.sin(e);
  const large = endDeg - startDeg > 180 ? 1 : 0;
  return `M ${x1} ${y1} A ${R} ${R} 0 ${large} 1 ${x2} ${y2}`;
}

export function NeedleGauge({ value }: { value: number }) {
  // Clamp to [0, 100]
  const v = Math.max(0, Math.min(100, value));
  // Map 0..100 → −90..+90 degrees. 0=left, 100=right (matches arc zones).
  const needleDeg = (v / 100) * 180 - 90;
  const needleRad = ((needleDeg - 90) * Math.PI) / 180;
  const nx = CX + (R - 8) * Math.cos(needleRad);
  const ny = CY + (R - 8) * Math.sin(needleRad);

  return (
    <svg width={SIZE_W} height={SIZE_H} viewBox={`0 0 ${SIZE_W} ${SIZE_H}`} aria-hidden>
      <path d={arcPath(-90, -54)} stroke="rgb(244 63 94)" strokeWidth={14} fill="none" strokeLinecap="round" />
      <path d={arcPath(-54, +54)} stroke="rgb(245 158 11)" strokeWidth={14} fill="none" />
      <path d={arcPath(+54, +90)} stroke="rgb(16 185 129)" strokeWidth={14} fill="none" strokeLinecap="round" />
      <line x1={CX} y1={CY} x2={nx} y2={ny} stroke="var(--color-foreground)" strokeWidth={2.5} strokeLinecap="round" />
      <circle cx={CX} cy={CY} r={5} fill="var(--color-foreground)" />
      <circle cx={CX} cy={CY} r={2} fill="var(--color-background)" />
    </svg>
  );
}
