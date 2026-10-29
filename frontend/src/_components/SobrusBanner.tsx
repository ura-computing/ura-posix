/** On every page, for owners with the « Connexion Sobrus » access: « Connexion Sobrus » stopped working (password changed on
 *  Sobrus, or Sobrus asks a check) — the nightly imports are paused until it is fixed. One button
 *  to the page that fixes it. Hidden on that page (it shows the form itself). */
import { CircleAlert } from "lucide-react";
import { Link, useLocation } from "react-router-dom";

import { useSobrusConnection } from "@/hooks/sharedQueries";
import { useT } from "@/i18n/I18nProvider";
import { ROUTES } from "@/types";

export function SobrusBanner() {
  const t = useT();
  const { pathname } = useLocation();
  const { connection } = useSobrusConnection();
  if (!connection?.connected || connection.status === "active" || pathname === ROUTES.SOBRUS) return null;
  return (
    <div
      role="alert"
      className="mb-5 flex flex-wrap items-center gap-3 rounded-xl border border-error/30 bg-error-subtle px-4 py-3 text-sm text-error-subtle-foreground"
    >
      <CircleAlert className="size-5 shrink-0 text-error" aria-hidden />
      <span className="min-w-0 flex-1 font-medium">
        {connection.status === "invalid" ? t("sobrus.bannerPassword") : t("sobrus.bannerCheck")}
      </span>
      <Link
        to={ROUTES.SOBRUS}
        className="rounded-md bg-card px-3 py-1.5 font-semibold text-foreground shadow-sm hover:bg-muted"
      >
        {connection.status === "invalid" ? t("sobrus.updatePassword") : t("sobrus.open")}
      </Link>
    </div>
  );
}
