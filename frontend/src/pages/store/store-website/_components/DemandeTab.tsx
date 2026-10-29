import { Check, Pencil, X, Store, Phone, CheckCircle2 } from "lucide-react";

import { Button } from "@/_components/atoms/Button";
import {
  REQUEST_STATE_ORDER,
  REQUEST_STATE_LABEL,
  TEMPLATE_LABEL,
  type PastRequest,
  type WebsiteRequest,
} from "@/types/storeWebsite";

import { formatRelative } from "../_format";

/** TAB 1 — DEMANDE.
 *
 *  Three mutually exclusive states:
 *    (a) EMPTY (no request, no history)
 *    (b) EMPTY + past closed requests → hero + horizontal rail
 *    (c) ACTIVE request → status timeline + contact + delivered-status panel
 *
 *  IMPORTANT: only the developer can download the ZIP — owners aren't IT
 *  people. The delivered state shows a status panel instead of a download
 *  button. */

export interface DemandeTabProps {
  /** The single active (non-closed) request, or null. */
  activeRequest: WebsiteRequest | null;
  /** Past Clôturée requests for the "Vos sites précédents" rail. */
  pastRequests: PastRequest[];
  isLoading?: boolean;
  /** Inline error when trying to create while one is already active. */
  createBlockedError?: string | null;
  onCreate: () => void;
  onEdit: (requestId: string) => void;
  onCancel: (requestId: string) => void;
  onReuse: (pastRequestId: string) => void;
}

export function DemandeTab({
  activeRequest,
  pastRequests,
  isLoading,
  createBlockedError,
  onCreate,
  onEdit,
  onCancel,
  onReuse,
}: DemandeTabProps) {
  if (isLoading) {
    return <div className="h-72 animate-pulse rounded-2xl border border-border bg-card" />;
  }

  if (activeRequest) {
    return <ActiveRequestCard request={activeRequest} onEdit={onEdit} onCancel={onCancel} />;
  }

  return (
    <div className="flex flex-col gap-6">
      <Hero onCreate={onCreate} error={createBlockedError} />
      {pastRequests.length > 0 && <PastRequestsRail items={pastRequests} onReuse={onReuse} />}
    </div>
  );
}

function Hero({ onCreate, error }: { onCreate: () => void; error?: string | null }) {
  return (
    <div className="flex flex-col items-center gap-5 rounded-2xl border border-dashed border-border bg-card p-10 text-center">
      <span className="flex size-14 items-center justify-center rounded-2xl bg-surface-subtle text-primary">
        <Store className="size-7" />
      </span>
      <div className="flex max-w-md flex-col gap-2">
        <h2 className="text-lg font-semibold tracking-tight text-foreground">
          Créez la vitrine en ligne de votre pharmacie
        </h2>
        <p className="text-sm text-muted-foreground">
          Nos développeurs construisent un site sur mesure pour votre pharmacie, avec votre catalogue intégré.
        </p>
      </div>
      <Button size="lg" onClick={onCreate}>
        <Store className="size-4" />
        Faire une demande
      </Button>
      {error && (
        <p className="rounded-lg border border-error-border bg-error-subtle px-3 py-2 text-sm font-medium text-error-subtle-foreground">
          {error}
        </p>
      )}
    </div>
  );
}

function PastRequestsRail({ items, onReuse }: { items: PastRequest[]; onReuse: (id: string) => void }) {
  return (
    <section className="flex flex-col gap-3">
      <h3 className="text-base font-semibold text-foreground">Vos sites précédents</h3>
      <div className="flex gap-4 overflow-x-auto pb-2">
        {items.map((p) => (
          <article
            key={p.id}
            className="flex w-60 shrink-0 flex-col overflow-hidden rounded-2xl border border-border bg-card"
          >
            <div className="flex h-24 items-center justify-center" style={{ background: p.brandColor }}>
              {p.logoUrl ? (
                <img src={p.logoUrl} alt="" className="max-h-12 max-w-[60%] object-contain" />
              ) : (
                <Store className="size-8 text-white/80" />
              )}
            </div>
            <div className="flex flex-col gap-2 p-3.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold text-foreground">{p.storeName}</span>
                <span className="rounded-full bg-surface-subtle px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
                  {TEMPLATE_LABEL[p.template]}
                </span>
              </div>
              <span className="font-mono text-xs tabular-nums text-muted-foreground">
                {formatRelative(p.createdAt)}
              </span>
              <Button variant="secondary" size="sm" className="mt-1 justify-center" onClick={() => onReuse(p.id)}>
                Faire une nouvelle demande basée sur celle-ci
              </Button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function ActiveRequestCard({
  request,
  onEdit,
  onCancel,
}: {
  request: WebsiteRequest;
  onEdit: (id: string) => void;
  onCancel: (id: string) => void;
}) {
  const reachedIndex = REQUEST_STATE_ORDER.indexOf(request.state);
  const canEdit = request.state === "soumise";
  const delivered = request.state === "livree" || request.state === "cloturee";

  return (
    <div className="flex flex-col gap-6 rounded-2xl border border-border bg-card p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col">
          <span className="text-base font-semibold text-foreground">{request.storeName}</span>
          <span className="text-xs text-muted-foreground">
            Demande créée <span className="font-mono tabular-nums">{formatRelative(request.createdAt)}</span>
          </span>
        </div>
        {canEdit && (
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={() => onEdit(request.id)}>
              <Pencil className="size-3.5" />
              Modifier
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onCancel(request.id)}
              className="text-muted-foreground hover:bg-error-subtle hover:text-error-subtle-foreground"
            >
              <X className="size-3.5" />
              Annuler
            </Button>
          </div>
        )}
      </div>

      {/* Timeline */}
      <ol className="flex flex-col gap-0 sm:flex-row sm:items-start">
        {REQUEST_STATE_ORDER.map((state, i) => {
          const done = i < reachedIndex;
          const current = i === reachedIndex;
          const step = request.timeline.find((s) => s.state === state);
          return (
            <li key={state} className="flex flex-1 gap-3 sm:flex-col sm:items-center sm:text-center">
              <div className="flex flex-col items-center sm:w-full sm:flex-row">
                <span
                  className={`hidden h-0.5 flex-1 sm:block ${
                    i === 0 ? "opacity-0" : done || current ? "bg-primary" : "bg-border"
                  }`}
                />
                <span
                  data-done={done}
                  data-current={current}
                  className="flex size-7 shrink-0 items-center justify-center rounded-full border-2 border-border bg-card text-muted-foreground data-[current=true]:border-primary data-[current=true]:bg-surface-subtle data-[current=true]:text-primary data-[done=true]:border-primary data-[done=true]:bg-primary data-[done=true]:text-primary-foreground"
                >
                  {done ? <Check className="size-4" /> : <span className="size-2 rounded-full bg-current" />}
                </span>
                <span
                  className={`hidden h-0.5 flex-1 sm:block ${
                    i === REQUEST_STATE_ORDER.length - 1 ? "opacity-0" : done ? "bg-primary" : "bg-border"
                  }`}
                />
                <span
                  className={`my-1 h-6 w-0.5 sm:hidden ${
                    i === REQUEST_STATE_ORDER.length - 1 ? "opacity-0" : done ? "bg-primary" : "bg-border"
                  }`}
                />
              </div>
              <div className="flex flex-col pb-4 sm:pb-0">
                <span
                  data-current={current}
                  className="text-[13px] font-semibold text-muted-foreground data-[current=true]:text-foreground"
                >
                  {REQUEST_STATE_LABEL[state]}
                </span>
                {step?.reachedAt && (
                  <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
                    {formatRelative(step.reachedAt)}
                  </span>
                )}
              </div>
            </li>
          );
        })}
      </ol>

      {/* Contact panel — phone only, no in-app chat */}
      <div className="flex items-start gap-3 rounded-xl border border-border bg-surface-subtle p-4">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-card text-primary">
          <Phone className="size-4" />
        </span>
        <div className="flex flex-col gap-0.5 text-sm">
          <span className="font-semibold text-foreground">Votre développeur</span>
          {request.developerName ? (
            <span className="text-muted-foreground">
              {request.developerName}, il vous contactera au{" "}
              <span className="font-mono tabular-nums">{request.phone}</span>.
            </span>
          ) : (
            <span className="text-muted-foreground">
              Un développeur prendra bientôt en charge votre demande, puis vous contactera au{" "}
              <span className="font-mono tabular-nums">{request.phone}</span>.
            </span>
          )}
        </div>
      </div>

      {/* Delivered state — no ZIP download for the owner. Dev handles deployment. */}
      {delivered && (
        <div className="flex items-start gap-3 rounded-xl border border-success-border bg-success-subtle p-4">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-card text-success-subtle-foreground">
            <CheckCircle2 className="size-4" />
          </span>
          <div className="flex flex-col gap-0.5 text-sm">
            <span className="font-semibold text-success-subtle-foreground">Votre site est prêt</span>
            <span className="text-success-subtle-foreground/85">
              Votre développeur a livré le projet et vous contactera pour le déploiement.
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
