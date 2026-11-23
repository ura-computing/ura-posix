/** On every page, for owners with the « Connexion Sobrus » access: « Connexion Sobrus » stopped working (password changed on
 *  Sobrus, or Sobrus asks a check) — the nightly imports are paused until it is fixed. One button
 *  to the page that fixes it. Hidden on that page (it shows the form itself). */
import { useLocation } from "react-router-dom";

import { ButtonLink } from "@/_components/atoms/Button";
import { Callout } from "@/_components/molecules/Callout";
import { useSobrusConnection } from "@/hooks/useSharedQueries";
import { useT } from "@/i18n/I18nProvider";
import { ROUTES } from "@/types";

export function SobrusBanner() {
  const t = useT();
  const { pathname } = useLocation();
  const { connection } = useSobrusConnection();
  if (!connection?.connected || connection.status === "active" || pathname === ROUTES.SOBRUS) return null;
  return (
    <Callout
      tone="error"
      className="mb-5"
      action={
        <ButtonLink to={ROUTES.SOBRUS} variant="secondary">
          {connection.status === "invalid" ? t("sobrus.updatePassword") : t("sobrus.open")}
        </ButtonLink>
      }
    >
      {connection.status === "invalid" ? t("sobrus.bannerPassword") : t("sobrus.bannerCheck")}
    </Callout>
  );
}
