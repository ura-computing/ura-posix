/**
 * Shared card primitive — single visual contract across Rapport, Stock, Alertes.
 *
 *   rounded-2xl border border-border bg-card p-5 shadow-sm
 *   ├─ label (small uppercase muted) ........... [badge?] [icon top-right circle?]
 *   ├─ value? (big mono)
 *   ├─ sub? / delta? (small muted row)
 *   ├─ children? (body slot — mini-stat grid, chart, gauge)
 *   └─ footerLink? ("voir les alertes →")
 *
 * Severity reads from the icon-circle tone (and optional badge tone).
 * Hero variant flips to brand-aurora gradient + white text + bigger value + sparkline.
 *
 * Replaces: pages/rapport/_components/KpiTile.tsx, pages/alertes/_components/AlertCard.tsx,
 * inline Tile duplicates in TvaTiles / StockSummaryTiles, and ad-hoc tone maps across
 * Stock + Alertes cards.
 */
import type { ReactNode } from "react";
import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";

import { cn } from "@/utils/cn";


export type IconTone = "primary" | "error" | "warning" | "success" | "info" | "slate" | "muted" | "emerald" | "rose";


const ICON_TONE: Record<IconTone, string> = {
  primary: "bg-primary/10 text-primary",
  error:   "bg-error/15 text-error",
  warning: "bg-warning/15 text-warning",
  success: "bg-success/15 text-success",
  info:    "bg-info/15 text-info",
  slate:   "bg-muted text-muted-foreground",
  muted:   "bg-muted text-muted-foreground",
  emerald: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  rose:    "bg-rose-500/15 text-rose-700 dark:text-rose-300",
};

const BADGE_TONE: Record<IconTone, string> = {
  primary: "bg-primary/10 text-primary",
  error:   "bg-error-subtle text-error",
  warning: "bg-warning-subtle text-warning",
  success: "bg-success-subtle text-success",
  info:    "bg-info-subtle text-info",
  slate:   "bg-muted text-muted-foreground",
  muted:   "bg-muted text-muted-foreground",
  emerald: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  rose:    "bg-rose-500/10 text-rose-700 dark:text-rose-300",
};

const SUB_TONE: Record<IconTone, string> = {
  primary: "text-primary",
  error:   "text-error",
  warning: "text-warning",
  success: "text-success",
  info:    "text-info",
  slate:   "text-muted-foreground",
  muted:   "text-muted-foreground",
  emerald: "text-emerald-700 dark:text-emerald-300",
  rose:    "text-rose-700 dark:text-rose-300",
};


export type CategoryTint = "all" | "pharmacie" | "parapharmacie";


export interface KpiTileProps {
  label:      ReactNode;
  value?:     ReactNode;                                             // optional: chart cards use children instead
  sub?:       ReactNode;
  /** Tone applied to `sub` text (defaults to muted-foreground). */
  subTone?:   IconTone;
  delta?:     { value: number; invertColor?: boolean } | null;       // raw % (+ = up). invertColor = down-is-good (Achats)
  icon?:      ReactNode;
  iconTone?:  IconTone;                                              // default "primary"
  /** Top-right count pill — Stock peremptions / Alertes severity pattern. */
  badge?:     { label: ReactNode; tone?: IconTone };
  hero?:      boolean;                                               // brand-aurora gradient variant
  sparkline?: number[];                                              // hero-only inline SVG
  href?:      string;                                                // <Link> wrapper
  onClick?:   () => void;                                            // <button> wrapper
  disabled?:  boolean;                                               // opacity-60 + cursor-not-allowed
  /** Footer link "voir les alertes →" pattern (Stock cards). */
  footerLink?: { label: ReactNode; href: string };
  /** Body slot: 2×2 grid, chart, gauge, mini-stats. */
  children?:  ReactNode;
  className?: string;
  /** Category tint — swaps the default `border-border bg-card` surface for the
   *  pharmacie or parapharmacie palette. "all" (or omitted) = neutral. Hero
   *  variant ignores this (its aurora gradient is already brand-branded). */
  tint?:      CategoryTint;
}


const TINT_SURFACE: Record<CategoryTint, string> = {
  all:           "border border-border bg-card",
  pharmacie:     "border border-pharmacie-border bg-pharmacie-bg/30",
  parapharmacie: "border border-parapharmacie-border bg-parapharmacie-bg/30",
};


export function KpiTile({
  label, value, sub, subTone, delta, icon, iconTone = "primary", badge,
  hero, sparkline, href, onClick, disabled, footerLink, children, className,
  tint = "all",
}: KpiTileProps) {
  const interactive = !disabled && (!!href || !!onClick);

  const baseClass = cn(
    "relative flex flex-col gap-2.5 rounded-2xl p-5 shadow-sm transition-shadow",
    hero
      ? "brand-aurora text-white overflow-hidden sm:col-span-2 sm:row-span-2"
      : TINT_SURFACE[tint],
    interactive && "cursor-pointer hover:shadow-md",
    disabled && "cursor-not-allowed opacity-60",
    className,
  );

  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <span className={cn(
          "text-xs font-semibold uppercase tracking-wide",
          hero ? "text-white/80" : "text-muted-foreground",
        )}>
          {label}
        </span>
        <div className="flex shrink-0 items-center gap-2">
          {badge && (
            <span className={cn(
              "rounded-full px-2.5 py-1 font-mono text-sm font-bold tabular-nums",
              hero ? "bg-white/15 text-white" : BADGE_TONE[badge.tone ?? iconTone],
            )}>
              {badge.label}
            </span>
          )}
          {icon && (
            <div className={cn(
              "flex size-9 items-center justify-center rounded-xl",
              hero ? "bg-white/15 text-white" : ICON_TONE[iconTone],
            )}>
              {icon}
            </div>
          )}
        </div>
      </div>

      {/* No whitespace-nowrap on the value — formatMAD guarantees the digits are
          one unbreakable unit and the only wrap point is before "MAD". */}
      {value != null && (
        <span className={cn(
          "font-mono font-bold tabular-nums tracking-tight",
          hero ? "text-[52px] leading-[52px]" : "text-[32px] leading-[32px]",
        )}>
          {value}
        </span>
      )}

      {(sub || delta) && (
        <div className={cn(
          "flex flex-wrap items-center gap-2 text-sm",
          hero ? "text-white/70" : subTone ? SUB_TONE[subTone] : "text-muted-foreground",
        )}>
          {delta && <DeltaBadge value={delta.value} invertColor={delta.invertColor} hero={hero} />}
          {sub && <span className="flex items-center gap-2">{sub}</span>}
        </div>
      )}

      {children}

      {footerLink && (
        <Link
          to={footerLink.href}
          onClick={(e) => e.stopPropagation()}
          className="mt-auto inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-primary"
        >
          {footerLink.label} <ArrowRight className="size-3.5" />
        </Link>
      )}

      {hero && sparkline && sparkline.length >= 2 && <Sparkline data={sparkline} />}
    </>
  );

  if (href) {
    return <Link to={href} className={baseClass}>{body}</Link>;
  }
  if (onClick) {
    return (
      <button
        type="button"
        onClick={disabled ? undefined : onClick}
        aria-disabled={disabled || undefined}
        className={cn(baseClass, "text-left")}
      >
        {body}
      </button>
    );
  }
  return <div className={baseClass}>{body}</div>;
}


function DeltaBadge({ value, invertColor, hero }: { value: number; invertColor?: boolean; hero?: boolean }) {
  const positive = invertColor ? value < 0 : value > 0;
  const sign = value > 0 ? "+" : value < 0 ? "" : "";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-mono text-xs font-semibold",
        hero
          ? "bg-white/15 text-white"
          : positive
            ? "bg-success-subtle text-success-subtle-foreground"
            : "bg-error-subtle text-error-subtle-foreground",
      )}
    >
      {sign}{value.toFixed(3)} %
    </span>
  );
}


/** Tiny inline SVG sparkline at the bottom of the hero tile. White stroke + thin
 *  area fill — visible over the aurora without competing with the big number. */
function Sparkline({ data }: { data: number[] }) {
  const W = 320, H = 56;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const stepX = data.length > 1 ? W / (data.length - 1) : 0;
  const pts = data.map((v, i) => [i * stepX, H - 2 - ((v - min) / range) * (H - 8)]);
  const line = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  const area = `${line} L${W} ${H} L0 ${H} Z`;
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width="100%"
      height={H}
      preserveAspectRatio="none"
      className="-mb-2 mt-auto"
      aria-hidden
    >
      <defs>
        <linearGradient id="kpi-spark" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.30" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#kpi-spark)" />
      <path d={line} fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity="0.85" />
    </svg>
  );
}
