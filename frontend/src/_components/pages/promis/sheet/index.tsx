/** One promis, laid out like a store request (/support/boutiques/:id): left, who and what (`FieldList`, the products,
 *  the history); right, « Étapes » as a vertical timeline (`Stepper`), reached steps green, + what to do now. The next
 *  step is the big button; the other allowed ones are outline buttons beside it (« Annuler le promis » in red). Each
 *  step opens its pop-up; the server checks it.
 *
 *    Créé ✓ → Commandé ✓ → Reçu ◉ → Prêt à retirer ○ → Retiré ○
 *    A side state takes the place of the next step: Reçu ✓ → « Incident » (orange), Prêt ✓ → « Expiré » (orange),
 *    … → « Annulé » (red). */
import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Phone } from "lucide-react";

import { Badge } from "@/_components/atoms/Badge";
import { Button } from "@/_components/atoms/Button";
import { buttonClass } from "@/_components/atoms/buttonClass";
import { BackLink } from "@/_components/molecules/BackLink";
import { Callout } from "@/_components/molecules/Callout";
import { FieldList } from "@/_components/molecules/FieldList";
import { LoadError } from "@/_components/molecules/LoadError";
import { SectionCard } from "@/_components/molecules/SectionCard";
import { PageSkeleton } from "@/_components/molecules/Skeletons";
import { Stepper } from "@/_components/molecules/Stepper";
import { Page } from "@/_components/templates/Page";
import { useMe } from "@/hooks/useMe";
import { useT } from "@/i18n/I18nProvider";
import NotFoundPage from "@/pages/common/not-found";
import type { PromisEvent, PromisSheet, PromisState } from "@/types/promis";
import { formatDate, formatDateTime, formatNumStr, formatQty } from "@/utils/format";

import { ICON, STATE_TONE } from "../constants";
import { StepDialog } from "./_components/StepDialog";
import { usePromisSheet } from "./hooks";

/** The usual next step of each state: the big button. */
const MAIN: Partial<Record<PromisState, PromisState>> = {
  created: "ready",
  to_order: "ordered",
  ordered: "received",
  received: "ready",
  incident: "ordered",
  ready: "picked_up",
  expired: "returned",
};
/** The way a promis goes when all is well (« À commander » only when it went through it). */
const PATH: PromisState[] = ["created", "to_order", "ordered", "received", "ready", "picked_up"];

/** The timeline: its steps, which one is current, its color. */
function timeline(sheet: PromisSheet) {
  const { state, events } = sheet;
  const reached = new Set(events.map((e) => e.to_state));
  const at = PATH.indexOf(state);
  if (at >= 0) {
    // Behind: only the steps it really went through (Créé → Prêt directly: no « Commandé » ticked). Ahead: the rest.
    const past = PATH.slice(0, at).filter((s) => reached.has(s));
    const ahead = PATH.slice(at + 1).filter((s) => s !== "to_order");
    const steps = [...past, state, ...ahead];
    return { steps, current: state === "picked_up" ? steps.length : past.length, tone: "success" as const };
  }
  // A side state comes after the steps it went through, in their order.
  const past = PATH.filter((s) => reached.has(s));
  return {
    steps: [...past, state],
    current: past.length,
    tone: state === "cancelled" ? ("error" as const) : ("warning" as const),
  };
}

function PromisSheetPage({ id }: { id: number }) {
  const t = useT();
  const { me } = useMe();
  const role = me?.role;
  const { sheet, isLoading, isError, notFound, reload, move, isMoving } = usePromisSheet(id);
  const [target, setTarget] = useState<PromisState | null>(null);
  const back = <BackLink to={`/${role}/promis`} label={t("promis.backToList")} />;

  if (notFound) return <NotFoundPage embedded />;
  if (isLoading) return <PageSkeleton />;
  if (isError || !sheet) {
    return (
      <Page above={back} title={t("promis.title")}>
        <LoadError onRetry={reload} />
      </Page>
    );
  }

  const { customer, lines, events, next, state } = sheet;
  const main = MAIN[state] && next.includes(MAIN[state]) ? MAIN[state] : null;
  const others = next.filter((s) => s !== main);
  const { steps, current, tone } = timeline(sheet);
  // Under each step: when, who, and why (the latest time the promis reached it).
  const lastOf = (s: PromisState) => [...events].reverse().find((e) => e.to_state === s);
  // One line under each reached step (who: in « Historique »), so every step keeps the same height.
  const note = (e: PromisEvent | undefined) => e && [formatDateTime(e.at), e.reason].filter(Boolean).join(" · ");
  const icon = (s: PromisState) => {
    const Icon = ICON[s];
    return Icon ? <Icon className="size-4" /> : null;
  };
  const phone = customer.phone;

  return (
    <Page
      above={back}
      title={t("promis.titleN", { n: sheet.number })}
      subtitle={
        <span className="flex flex-wrap items-center gap-2">
          {t("promis.createdOn", { date: formatDateTime(sheet.created_at), name: sheet.created_by_name })}
          <Badge tone={STATE_TONE[state]}>{t(`promis.state_${state}`)}</Badge>
        </span>
      }
      actions={
        <>
          {others.map((s) => (
            <Button
              key={s}
              size="lg"
              variant={s === "cancelled" ? "danger-outline" : "outline"}
              onClick={() => setTarget(s)}
            >
              {icon(s)}
              {t(`promis.go_${s}`)}
            </Button>
          ))}
          {main && (
            <Button size="lg" onClick={() => setTarget(main)}>
              {icon(main)}
              {t(`promis.go_${main}`)}
            </Button>
          )}
        </>
      }
    >
      {state === "ready" && sheet.pickup_deadline && (
        <Callout tone="success" title={t("promis.deadline", { date: formatDate(sheet.pickup_deadline) })}>
          {lines[0]?.shelf_place && t("promis.shelfPlace", { place: lines[0].shelf_place })}
        </Callout>
      )}

      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[1fr_320px]">
        <div className="flex min-w-0 flex-col gap-5">
          <SectionCard
            title={t("promis.customer")}
            actions={
              phone && (
                <a href={`tel:${phone}`} className={buttonClass("outline", "sm")}>
                  <Phone className="size-3.5" />
                  {t("promis.call", { name: customer.name })}
                </a>
              )
            }
          >
            <FieldList
              fields={[
                { label: t("promis.customerName"), value: customer.name },
                {
                  label: t("promis.phone"),
                  value: phone ? <span className="font-mono">{phone}</span> : t("promis.noPhone"),
                },
                ...(phone
                  ? [
                      {
                        label: t("promis.whatsapp"),
                        value: t(customer.whatsapp_ok ? "promis.whatsappYes" : "promis.whatsappNoShort"),
                      },
                    ]
                  : []),
                {
                  label: t("promis.noteLabel"),
                  value: <span className="whitespace-pre-line">{sheet.note ?? t("promis.none")}</span>,
                },
              ]}
            />
          </SectionCard>

          <SectionCard title={t("promis.products")}>
            <ul className="flex flex-col divide-y divide-border">
              {lines.map((l) => (
                <li key={l.id} className="flex flex-wrap items-center justify-between gap-3 py-2">
                  <span className="flex min-w-0 flex-col items-start gap-1">
                    {l.medicament_id !== null ? (
                      <Link
                        to={`/${role}/produits/${l.medicament_id}`}
                        className="text-base font-medium text-foreground hover:underline"
                      >
                        {l.name}
                      </Link>
                    ) : (
                      <span className="text-base font-medium text-foreground">{l.name}</span>
                    )}
                    {l.medicament_id === null ? (
                      <Badge>{t("promis.outsideCatalogue")}</Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        {l.free_stock == null
                          ? t("promis.notInStock")
                          : t("promis.freeStockShort", { n: formatNumStr(l.free_stock) })}
                      </span>
                    )}
                  </span>
                  <span className="font-mono text-base font-semibold">
                    {formatQty(l.quantity)} {t("promis.quantity").toLowerCase()}
                  </span>
                </li>
              ))}
            </ul>
          </SectionCard>

          <SectionCard title={t("promis.history")}>
            <ul className="flex flex-col divide-y divide-border">
              {[...events].reverse().map((e, i) => (
                <li key={i} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 py-2 text-sm">
                  <span className="flex min-w-0 flex-col">
                    <span className="font-medium text-foreground">
                      {e.from_state === null ? t("promis.stepFirst") : t(`promis.state_${e.to_state}`)}
                    </span>
                    {e.reason && <span className="text-muted-foreground">{e.reason}</span>}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {formatDateTime(e.at)} · {e.actor_name}
                  </span>
                </li>
              ))}
            </ul>
          </SectionCard>
        </div>

        <SectionCard title={t("promis.steps")}>
          <Stepper
            vertical
            steps={steps.map((s) => t(`promis.state_${s}`))}
            current={current}
            tone={tone}
            notes={steps.map((s, i) => (i <= current ? note(lastOf(s)) : null))}
          />
          <p className="text-sm text-muted-foreground">{t(`promis.stateHint_${state}`)}</p>
        </SectionCard>
      </div>

      <StepDialog target={target} sheet={sheet} onSave={move} isSaving={isMoving} onClose={() => setTarget(null)} />
    </Page>
  );
}

export default function PromisSheetRoute() {
  const { id } = useParams<{ id: string }>();
  return <PromisSheetPage key={id} id={Number(id)} />;
}
