/** An online-store request's step and urgency, as badges: the Support queue, the request page, the owner's page.
 *  Example: state "en_cours" → « En cours » (primary), urgency "asap" → « Dès que possible » (error). */
import { Badge, type BadgeTone } from "@/_components/atoms/Badge";
import { ColorSwatch } from "@/_components/atoms/ColorSwatch";
import { useT } from "@/i18n/I18nProvider";
import { REQUEST_STATE_LABEL, URGENCY_LABEL, type RequestState, type Urgency } from "@/types/storeWebsite";

const STATE_TONE: Record<RequestState, BadgeTone> = {
  soumise: "warning",
  prise_en_charge: "info",
  en_cours: "primary",
  livree: "success",
  cloturee: "neutral",
};

const URGENCY_TONE: Record<Urgency, BadgeTone> = { asap: "error", ce_mois: "warning", flexible: "neutral" };

export function StateBadge({ state }: { state: RequestState }) {
  const t = useT();
  return <Badge tone={STATE_TONE[state]}>{t(REQUEST_STATE_LABEL[state])}</Badge>;
}

export function UrgencyBadge({ urgency }: { urgency: Urgency }) {
  const t = useT();
  return <Badge tone={URGENCY_TONE[urgency]}>{t(URGENCY_LABEL[urgency])}</Badge>;
}

/** The 2–3 colors the owner picked. */
export function PaletteSwatches({ colors }: { colors: string[] }) {
  return (
    <span className="inline-flex items-center gap-1">
      {colors.map((c) => (
        <ColorSwatch key={c} color={c} />
      ))}
    </span>
  );
}
