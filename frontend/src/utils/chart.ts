/** Line-chart helpers shared by the app's hand-drawn SVG charts (Rapport trend, product
 *  « Ventes par mois »). No chart library. */

/** Round the data max up to a "nice" axis top and return evenly-spaced ticks
 *  (0 … niceMax) so labels read as round numbers: 0, 100 000, 200 000, … */
export function niceScale(max: number, targetTicks = 4): { niceMax: number; ticks: number[] } {
  if (max <= 0) return { niceMax: 1, ticks: [0, 1] };
  const niceNum = (x: number, round: boolean) => {
    const exp = Math.floor(Math.log10(x));
    const f = x / 10 ** exp;
    const nf = round ? (f < 1.5 ? 1 : f < 3 ? 2 : f < 7 ? 5 : 10) : f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10;
    return nf * 10 ** exp;
  };
  const step = niceNum(max / targetTicks, true);
  const niceMax = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let v = 0; v <= niceMax + step / 2; v += step) ticks.push(Math.round(v));
  return {
    niceMax,
    ticks,
  };
}

/** Smooth monotone-cubic path (d3.curveMonotoneX style) through the points —
 *  a clean curve with no overshoot below the data, so the area fill stays sane. */
export function smoothPath(pts: { x: number; y: number }[]): string {
  const n = pts.length;
  if (n === 0) return "";
  if (n === 1) return `M${pts[0].x},${pts[0].y}`;
  const dx: number[] = [],
    slope: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    dx[i] = pts[i + 1].x - pts[i].x;
    slope[i] = (pts[i + 1].y - pts[i].y) / (dx[i] || 1);
  }
  const t = new Array<number>(n);
  t[0] = slope[0];
  t[n - 1] = slope[n - 2];
  for (let i = 1; i < n - 1; i++) t[i] = slope[i - 1] * slope[i] <= 0 ? 0 : (slope[i - 1] + slope[i]) / 2;
  for (let i = 0; i < n - 1; i++) {
    if (slope[i] === 0) {
      t[i] = 0;
      t[i + 1] = 0;
      continue;
    }
    const a = t[i] / slope[i],
      b = t[i + 1] / slope[i];
    const s = a * a + b * b;
    if (s > 9) {
      const tau = 3 / Math.sqrt(s);
      t[i] = tau * a * slope[i];
      t[i + 1] = tau * b * slope[i];
    }
  }
  let d = `M${pts[0].x},${pts[0].y}`;
  for (let i = 0; i < n - 1; i++) {
    const h = dx[i];
    d += `C${pts[i].x + h / 3},${pts[i].y + (t[i] * h) / 3} ${pts[i + 1].x - h / 3},${pts[i + 1].y - (t[i + 1] * h) / 3} ${pts[i + 1].x},${pts[i + 1].y}`;
  }
  return d;
}

export const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
