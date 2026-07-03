/** Currency / quantity / percentage formatters — SINGLE source of truth.
 *
 *  RULES:
 *    - Money values → `formatMAD()` (always emits "X MAD" suffix)
 *    - Counts / quantities → `formatQty()` or `formatQtyDec()`
 *    - Percentages → `formatPct()`
 *    - NEVER call `.toLocaleString()` or `.toFixed()` directly in a component
 *    - NEVER use a template literal to interpolate these. Use JSX:
 *        WRONG : sub={`Ticket : ${formatMAD(x)}`}
 *        RIGHT : sub={<>Ticket : {formatMAD(x)}</>}
 *      (template literals would coerce JSX to "[object Object]")
 *
 *  Why JSX: digit-group separator is a CSS-controlled inline-block span
 *  (width: 0.03em — way tighter than any Unicode space). Tune the width in
 *  ONE place below.
 */
import { Fragment, type ReactNode } from "react";


// Intl emits U+202F NARROW NO-BREAK SPACE between digit groups (fr-FR default).
// We split on it and rebuild with a CSS-width span — way tighter than Unicode.
const SEP_CODE = " ";
// TUNE HERE — width of the gap between digit groups (relative to font size).
// 0.05em ≈ half of HAIR SPACE: visibly tighter than the Intl default but
// readable at every font size (1.4px @ 28px, 0.65px @ 13px).
const SEP      = <span className="inline-block w-[0.15em]" aria-hidden />;


function tighten(s: string): ReactNode {
  const parts = s.split(SEP_CODE);
  if (parts.length === 1) return s;
  return parts.map((p, i) => (
    <Fragment key={i}>
      {i > 0 && SEP}
      {p}
    </Fragment>
  ));
}


const MAD = new Intl.NumberFormat("fr-FR", {
  style: "currency", currency: "MAD",
  minimumFractionDigits: 0, maximumFractionDigits: 0,
});
const QTY     = new Intl.NumberFormat("fr-FR");
const QTY_DEC = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 });
const PCT     = new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 2 });


export function formatMAD(n: number | null | undefined): ReactNode {
  if (n == null) return "—";
  return tighten(MAD.format(n));
}

export function formatQty(n: number | null | undefined): ReactNode {
  if (n == null) return "—";
  return tighten(QTY.format(n));
}

export function formatQtyDec(n: number | null | undefined): ReactNode {
  if (n == null) return "—";
  return tighten(QTY_DEC.format(n));
}

export function formatPct(n: number | null | undefined, decimals = 1): ReactNode {
  if (n == null) return "—";
  const trimmed = `${PCT.format(n)} %`.replace(/,(\d+)/, (_, d) => `,${d.slice(0, decimals)}`);
  return tighten(trimmed);
}

/** Variation: ((current - previous) / previous) × 100. Returns null if previous is 0. */
export function pctChange(current: number, previous: number): number | null {
  if (!previous) return null;
  return ((current - previous) / previous) * 100;
}