/** An online-store request's step, as a badge: the Support queue, the request page, the owner's page.
 *  Example: state "en_cours" → « En cours » (primary), */
import { Badge, type BadgeTone } from "@/_components/atoms/Badge";
import { ColorSwatch } from "@/_components/atoms/ColorSwatch";
import { useT } from "@/i18n/I18nProvider";
import { REQUEST_STATE_LABEL, type RequestState } from "@/types/storeWebsite";

const STATE_TONE: Record<RequestState, BadgeTone> = {
  soumise: "warning",
  prise_en_charge: "info",
  en_cours: "primary",
  livree: "success",
  cloturee: "neutral",
};

export function StateBadge({ state }: { state: RequestState }) {
  const t = useT();
  return <Badge tone={STATE_TONE[state]}>{t(REQUEST_STATE_LABEL[state])}</Badge>;
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
