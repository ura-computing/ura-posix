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
  minimumFractionDigits: 2, maximumFractionDigits: 2,
});
const QTY     = new Intl.NumberFormat("fr-FR");
const QTY_DEC = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 });
const PCT3    = new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 3, maximumFractionDigits: 3 });


export function formatMAD(n: number | null | undefined): ReactNode {
  if (n == null) return "—";
  // Split the number from the "MAD" suffix so a too-narrow container wraps
  // ONLY before the currency (never mid-number): the digits live in a
  // whitespace-nowrap span, followed by a plain (breakable) space + "MAD".
  // Intl glues "MAD" with U+00A0 (never breaks) while the inline-block group
  // separators WOULD break — i.e. exactly the wrong wrap points without this.
  const parts    = MAD.formatToParts(n);
  const curIdx   = parts.findIndex((p) => p.type === "currency");
  if (curIdx === -1) return tighten(MAD.format(n));   // defensive — fr-FR always has one
  const currency = parts[curIdx].value;
  const numberStr = parts
    .filter((p, i) => p.type !== "currency" && !(p.type === "literal" && i === curIdx - 1))
    .map((p) => p.value)
    .join("");
  return (
    <>
      <span className="whitespace-nowrap">{tighten(numberStr)}</span>
      {" "}
      {currency}
    </>
  );
}

/** Plain-string MAD — for contexts that can't render the JSX separator spans
 *  `formatMAD` emits (SVG `<text>`, aria-labels, title attributes, …). */
export function formatMADStr(n: number | null | undefined): string {
  if (n == null) return "—";
  return MAD.format(n);
}

const NUM_FR  = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 });
const NUM_FR2 = new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
/** Plain-string number with fr-FR grouping ("1 500 000" or "1 500 000,00") — full
 *  numbers, no k/M abbreviation, no currency suffix. `decimals` = 0 (default, e.g.
 *  chart axis ticks) or 2 (money columns whose header already says "MAD"). */
export function formatNumStr(n: number | null | undefined, decimals: 0 | 2 = 0): string {
  if (n == null) return "—";
  return (decimals === 2 ? NUM_FR2 : NUM_FR).format(n);
}

export function formatQty(n: number | null | undefined): ReactNode {
  if (n == null) return "—";
  return tighten(QTY.format(n));
}

export function formatQtyDec(n: number | null | undefined): ReactNode {
  if (n == null) return "—";
  return tighten(QTY_DEC.format(n));
}

export function formatPct(n: number | null | undefined, decimals = 3): ReactNode {
  if (n == null) return "—";
  const fmt = decimals === 3
    ? PCT3
    : new Intl.NumberFormat("fr-FR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  return tighten(`${fmt.format(n)} %`);
}

/** Variation: ((current - previous) / previous) × 100. Returns null if previous is 0. */
export function pctChange(current: number, previous: number): number | null {
  if (!previous) return null;
  return ((current - previous) / previous) * 100;
}