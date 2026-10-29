import { useState, type ReactNode } from "react";
import { ChevronDown, ExternalLink, Phone, Store } from "lucide-react";

import { Button } from "@/_components/atoms/Button";
import { REQUEST_STATE_LABEL, URGENCY_LABEL, type RequestBrief, type RequestState } from "@/types/storeWebsite";

import { formatMAD } from "../../store-website/_format";

/** /requests/:id — developer's read-only brief + state-aware action stack.
 *
 *  Visually aligned with /rapport + /comptabilite: page wrapper is a
 *  plain `flex flex-col gap-6` (AppLayout already wraps in
 *  `<main className="p-7"/>`), heading uses the standard
 *  `text-2xl font-semibold tracking-tight text-foreground` shape, every
 *  card uses `rounded-2xl border border-border bg-card`, hover states use
 *  `bg-surface-subtle`, semantic tone tokens drive the destructive
 *  hover on the "Libérer" button. */

export interface RequestDetailPageProps {
  brief: RequestBrief;
  isLoading?: boolean;
  onClaim: (id: string) => void;
  onRelease: (id: string) => void;
  onMarkInProgress: (id: string) => void;
  onMarkDelivered: (id: string) => void;
  onClose: (id: string) => void;
  onOpenEditor: (id: string) => void;
  renderBreadcrumb?: (pharmacyName: string) => ReactNode;
}

export function RequestDetailPage(props: RequestDetailPageProps) {
  const { brief, isLoading } = props;
  if (isLoading) return <DetailSkeleton />;

  return (
    <div className="flex flex-col gap-6">
      {props.renderBreadcrumb?.(brief.pharmacyName) ?? (
        <nav className="text-sm text-muted-foreground">
          Demandes <span className="px-1">›</span>
          <span className="text-foreground">{brief.pharmacyName}</span>
        </nav>
      )}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_320px]">
        <BriefColumn brief={brief} />
        <ActionColumn {...props} />
      </div>
    </div>
  );
}

// ── Brief column ───────────────────────────────────────────────────────────

function BriefColumn({ brief }: { brief: RequestBrief }) {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5">
        <div className="flex items-start gap-4">
          <div className="flex size-20 flex-none items-center justify-center overflow-hidden rounded-xl border border-border bg-surface-subtle">
            {brief.logoUrl ? (
              <img src={brief.logoUrl} alt="" className="size-full object-contain" />
            ) : (
              <Store className="size-8 text-muted-foreground" />
            )}
          </div>
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">{brief.storeName}</h1>
            {brief.slogan && <p className="text-sm italic text-muted-foreground">{brief.slogan}</p>}
            <div className="mt-1 flex items-center gap-1.5">
              {brief.brandPalette.map((c) => (
                <span
                  key={c}
                  className="size-5 rounded-md border border-border"
                  style={{ background: c }}
                  title={c}
                  aria-hidden
                />
              ))}
            </div>
          </div>
        </div>

        <dl className="grid grid-cols-2 gap-3 border-t border-border pt-4 text-sm">
          <Info label="Pharmacie" value={brief.pharmacyName} />
          <Info label="Urgence" value={URGENCY_LABEL[brief.urgency]} />
          <Info label="Domaine souhaité" value={brief.customDomain ?? "—"} mono />
          <Info label="État" value={REQUEST_STATE_LABEL[brief.state]} />
        </dl>

        {brief.vision && (
          <div className="flex flex-col gap-1.5 border-t border-border pt-4">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Vision libre</span>
            <p className="whitespace-pre-line text-sm leading-relaxed text-foreground/90">{brief.vision}</p>
          </div>
        )}
      </div>

      <Collapsible title={`Catégories (${brief.categories.length})`} defaultOpen>
        <div className="flex flex-col divide-y divide-border">
          {brief.categories.map((c) => (
            <div key={c.id} className="flex items-center justify-between py-2 text-sm">
              <span className="font-medium text-foreground">{c.name}</span>
              <span className="font-mono text-xs tabular-nums text-muted-foreground">{c.productCount} produits</span>
            </div>
          ))}
        </div>
      </Collapsible>

      <Collapsible title={`SOLDES (${brief.soldes.length})`}>
        <div className="flex flex-col divide-y divide-border">
          {brief.soldes.map((s) => (
            <div key={s.id} className="flex items-center justify-between py-2 text-sm">
              <span className="font-medium text-foreground">{s.name}</span>
              <span className="flex items-baseline gap-2 font-mono text-xs tabular-nums">
                <span className="text-muted-foreground line-through">{formatMAD(s.ppv)}</span>
                <span className="font-semibold text-foreground">{formatMAD(s.solde)}</span>
              </span>
            </div>
          ))}
        </div>
      </Collapsible>
    </div>
  );
}

// ── Action column ──────────────────────────────────────────────────────────

function ActionColumn(props: RequestDetailPageProps) {
  const { brief } = props;
  const s: RequestState = brief.state;
  const pending = s === "soumise" && !brief.claimedByMe;

  return (
    <div className="flex flex-col gap-3 lg:sticky lg:top-5 lg:self-start">
      <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4">
        {pending ? (
          <Button className="w-full" onClick={() => props.onClaim(brief.id)}>
            Réclamer cette demande
          </Button>
        ) : (
          <>
            {brief.claimedByMe && (
              <Button className="w-full" onClick={() => props.onOpenEditor(brief.id)}>
                Ouvrir l'éditeur
              </Button>
            )}
            {s === "prise_en_charge" && (
              <Button variant="secondary" className="w-full" onClick={() => props.onMarkInProgress(brief.id)}>
                Marquer en cours
              </Button>
            )}
            {s === "en_cours" && (
              <Button variant="secondary" className="w-full" onClick={() => props.onMarkDelivered(brief.id)}>
                Marquer comme livrée
              </Button>
            )}
            {s === "livree" && (
              <Button variant="secondary" className="w-full" onClick={() => props.onClose(brief.id)}>
                Clôturer
              </Button>
            )}
            {(s === "prise_en_charge" || s === "en_cours") && brief.claimedByMe && (
              <Button
                variant="ghost"
                className="w-full text-muted-foreground hover:bg-error-subtle hover:text-error-subtle-foreground"
                onClick={() => props.onRelease(brief.id)}
              >
                Libérer la demande
              </Button>
            )}
          </>
        )}
      </div>

      <PhoneCallCard ownerName={brief.ownerName} ownerPhone={brief.ownerPhone} />
    </div>
  );
}

function PhoneCallCard({ ownerName, ownerPhone }: { ownerName: string; ownerPhone: string }) {
  return (
    <a
      href={`tel:${ownerPhone.replace(/\s/g, "")}`}
      className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 transition-colors hover:bg-surface-subtle"
    >
      <span className="flex size-10 flex-none items-center justify-center rounded-full bg-primary/10 text-primary">
        <Phone className="size-4" />
      </span>
      <span className="flex flex-col">
        <span className="text-sm font-semibold text-foreground">Appeler {ownerName}</span>
        <span className="font-mono text-xs tabular-nums text-muted-foreground">{ownerPhone}</span>
      </span>
      <ExternalLink className="ml-auto size-4 text-muted-foreground" />
    </a>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────

function Info({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd
        className={
          mono ? "font-mono text-[13px] tabular-nums text-foreground" : "text-[13px] font-medium text-foreground"
        }
      >
        {value}
      </dd>
    </div>
  );
}

function Collapsible({ title, defaultOpen, children }: { title: string; defaultOpen?: boolean; children: ReactNode }) {
  const [open, setOpen] = useState(!!defaultOpen);
  return (
    <div className="rounded-2xl border border-border bg-card">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-2 px-5 py-3.5 text-base font-semibold text-foreground transition-colors hover:bg-surface-subtle/40"
      >
        {title}
        <ChevronDown data-open={open} className="size-4 text-muted-foreground transition data-[open=true]:rotate-180" />
      </button>
      {open && <div className="border-t border-border px-5 py-3">{children}</div>}
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <div className="h-4 w-48 animate-pulse rounded bg-muted" />
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_320px]">
        <div className="flex flex-col gap-5">
          <div className="h-64 animate-pulse rounded-2xl border border-border bg-card" />
          <div className="h-24 animate-pulse rounded-2xl border border-border bg-card" />
          <div className="h-12 animate-pulse rounded-2xl border border-border bg-card" />
        </div>
        <div className="flex flex-col gap-3">
          <div className="h-32 animate-pulse rounded-2xl border border-border bg-card" />
          <div className="h-20 animate-pulse rounded-2xl border border-border bg-card" />
        </div>
      </div>
    </div>
  );
}
