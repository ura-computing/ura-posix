import { ArrowRight, Briefcase, Clock, Download, Lock } from "lucide-react";
import type { ReactNode } from "react";

import { KpiTile } from "@/components/shared/KpiTile";
import { Button } from "@/components/ui/button";
import {
  REQUEST_STATE_LABEL, URGENCY_LABEL,
  type DevKpis, type DevRequest, type Urgency,
} from "@/types/storeWebsite";

import { formatRelative } from "../../store-website/_format";


/** /requests — developer dashboard. 3 KPI tiles + 3 queue sections
 *  (À traiter / Mes demandes en cours / En cours par d'autres).
 *
 *  Visually aligned with /rapport + /comptabilite: page wrapper is a plain
 *  `flex flex-col gap-6` (AppLayout already wraps in `<main className="p-7"/>`),
 *  KPI tiles come from the shared `KpiTile`, rows use the same hover +
 *  border tokens as /imports, semantic tone tokens drive the urgency +
 *  status badges. The third section ("En cours par d'autres") is
 *  read-only per the locked claim/lock semantics. */

export interface DevDashboardProps {
  kpis:         DevKpis;
  pending:      DevRequest[];
  mine:         DevRequest[];
  others:       DevRequest[];
  isLoading?:   boolean;
  onClaim:      (id: string) => void;
  onOpen:       (id: string) => void;
  onOpenEditor: (id: string) => void;
}


export function DevDashboard({
  kpis, pending, mine, others, isLoading, onClaim, onOpen, onOpenEditor,
}: DevDashboardProps) {
  if (isLoading) return <DashboardSkeleton />;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Demandes</h1>
        <p className="text-sm text-muted-foreground">
          Réclamez les nouvelles demandes et suivez vos sites en cours.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <KpiTile
          label="Demandes en attente"
          value={kpis.pending}
          icon={<Clock className="size-5" />}
          iconTone="warning"
        />
        <KpiTile
          label="Mes demandes actives"
          value={kpis.mineActive}
          icon={<Briefcase className="size-5" />}
          iconTone="primary"
        />
        <KpiTile
          label="Exports ce mois"
          value={kpis.exportsThisMonth}
          icon={<Download className="size-5" />}
          iconTone="info"
        />
      </div>

      <Section title="À traiter" empty="Aucune nouvelle demande pour le moment.">
        {pending.map((r) => (
          <ActionableRow key={r.id} r={r} onOpen={onOpen}>
            <Button size="sm" onClick={() => onClaim(r.id)}>Réclamer</Button>
          </ActionableRow>
        ))}
      </Section>

      <Section title="Mes demandes en cours" empty="Vous n'avez aucune demande en cours.">
        {mine.map((r) => (
          <ActionableRow key={r.id} r={r} onOpen={onOpen}>
            <Button size="sm" variant="outline" onClick={() => onOpenEditor(r.id)}>
              Ouvrir l'éditeur
              <ArrowRight className="size-3.5" />
            </Button>
          </ActionableRow>
        ))}
      </Section>

      <Section title="En cours par d'autres" empty="Aucune demande prise par un autre développeur.">
        {others.map((r) => (
          <ReadOnlyRow key={r.id} r={r} />
        ))}
      </Section>
    </div>
  );
}


// ── Helpers ────────────────────────────────────────────────────────────────

function Section({ title, empty, children }: { title: string; empty: string; children: ReactNode }) {
  const items   = Array.isArray(children) ? children : [children];
  const isEmpty = items.flat().filter(Boolean).length === 0;
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-base font-semibold text-foreground">{title}</h2>
      {isEmpty ? (
        <div className="rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          {empty}
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">{children}</div>
      )}
    </section>
  );
}


/** Actionable queue row — pending or claimed-by-me. Whole row is the
 *  click surface that opens the detail; the right-side button is the
 *  primary action (Réclamer / Ouvrir l'éditeur) and stops propagation. */
function ActionableRow({
  r, onOpen, children,
}: { r: DevRequest; onOpen: (id: string) => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={() => onOpen(r.id)}
      className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 text-left transition-colors hover:bg-surface-subtle/50"
    >
      <span
        className="size-2.5 shrink-0 rounded-full"
        style={{ background: r.brandColor }}
        aria-hidden
      />
      <span className="font-medium text-foreground">{r.pharmacyName}</span>
      <span className="font-mono text-xs tabular-nums text-muted-foreground">
        {formatRelative(r.submittedAt)}
      </span>
      <UrgencyBadge urgency={r.urgency} />
      <StateBadge state={r.state} />
      <div
        className="ml-auto"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
        role="presentation"
      >
        {children}
      </div>
    </button>
  );
}


/** Read-only row — claimed by the OTHER developer. No actions, no hover. */
function ReadOnlyRow({ r }: { r: DevRequest }) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-dashed border-border bg-surface-subtle/40 px-4 py-3">
      <span
        className="size-2.5 shrink-0 rounded-full"
        style={{ background: r.brandColor }}
        aria-hidden
      />
      <span className="font-medium text-foreground">{r.pharmacyName}</span>
      <span className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
        <Lock className="size-3.5" />
        Réclamée par {r.claimedBy?.name ?? "—"}
        {r.claimedAt && <> · {formatRelative(r.claimedAt)}</>}
      </span>
    </div>
  );
}


function UrgencyBadge({ urgency }: { urgency: Urgency }) {
  const tone =
    urgency === "asap"
      ? "bg-error-subtle text-error-subtle-foreground"
      : urgency === "ce_mois"
      ? "bg-warning-subtle text-warning-subtle-foreground"
      : "bg-surface-subtle text-muted-foreground";
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${tone}`}>
      {URGENCY_LABEL[urgency]}
    </span>
  );
}


function StateBadge({ state }: { state: DevRequest["state"] }) {
  return (
    <span className="rounded-full bg-surface-subtle px-2.5 py-0.5 text-[11px] font-semibold text-muted-foreground">
      {REQUEST_STATE_LABEL[state]}
    </span>
  );
}


function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <div className="h-7 w-40 animate-pulse rounded bg-muted" />
        <div className="h-4 w-72 animate-pulse rounded bg-muted" />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-44 animate-pulse rounded-2xl border border-border bg-card" />
        ))}
      </div>
      {Array.from({ length: 2 }).map((_, i) => (
        <section key={i} className="flex flex-col gap-3">
          <div className="h-5 w-40 animate-pulse rounded bg-muted" />
          {Array.from({ length: 2 }).map((_, j) => (
            <div key={j} className="h-16 animate-pulse rounded-xl border border-border bg-card" />
          ))}
        </section>
      ))}
    </div>
  );
}
