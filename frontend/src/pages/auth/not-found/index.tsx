import { Link } from "react-router-dom";

import { PharmagestIcon } from "@/_components/atoms/PharmagestIcon";
import { ROUTES } from "@/types";
import { useT } from "@/i18n/I18nProvider";

/** `embedded` = rendered inside AppLayout (sidebar + header stay visible, so a
 *  user without access can still navigate or log out). `pending` = an account not
 *  accepted yet: one more line says why every page is empty. */
export default function NotFoundPage({ embedded = false, pending = false }: { embedded?: boolean; pending?: boolean }) {
  const t = useT();
  return (
    <div
      data-page="not-found" // one page at any address (the E2E UI gate)
      className={
        embedded ? "flex h-full flex-col text-foreground" : "flex min-h-screen flex-col bg-background text-foreground"
      }
    >
      <style>{`
        @keyframes pg-rotate { to { transform: rotate(360deg) } }
        @keyframes pg-fade-up { from { transform: translateY(18px) } to { transform: none } }
        @keyframes pg-float { 0%, 100% { transform: translateY(0) } 50% { transform: translateY(-9px) } }
        @keyframes pg-pulse { 0%, 100% { transform: scale(1) } 50% { transform: scale(1.13) } }
        .pg-anim { animation: pg-fade-up .65s cubic-bezier(0,0,.2,1) both }
        .pg-spin { animation: pg-rotate 14s linear infinite }
        .pg-float { animation: pg-float 5.5s ease-in-out infinite }
        .pg-pulse { transform-origin: center; animation: pg-pulse 2.8s ease-in-out infinite }
        @media (prefers-reduced-motion: reduce) {
          .pg-spin, .pg-float { animation: none }
          .pg-anim { animation: none }
        }
      `}</style>

      {!embedded && (
        <header className="flex items-center justify-between px-7 py-6">
          <Link
            to={ROUTES.HOME}
            aria-label={t("home.logoAlt")}
            className="flex items-center gap-3 text-base font-extrabold tracking-tight rounded-md focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2"
          >
            <PharmagestIcon className="h-[30px] w-[30px] text-primary" ariaHidden />
            <span>
              Pharma<span className="text-primary">Gest</span>
            </span>
          </Link>
        </header>
      )}

      <main className="flex flex-1 items-center justify-center px-6">
        <div className="flex w-full max-w-[540px] flex-col items-center gap-7 text-center">
          <div className="pg-anim">
            <div className="pg-float flex items-center justify-center gap-1.5">
              <span className="font-mono text-[128px] font-bold leading-none tracking-tighter">4</span>
              <span className="relative flex h-[120px] w-[120px] items-center justify-center text-primary">
                <PharmagestIcon className="pg-spin absolute inset-0 h-full w-full [&_line]:hidden" ariaHidden />
                <PharmagestIcon className="absolute inset-0 h-full w-full [&_path]:hidden" ariaHidden />
              </span>
              <span className="font-mono text-[128px] font-bold leading-none tracking-tighter">4</span>
            </div>
          </div>

          <div className="pg-anim flex flex-col items-center gap-3" style={{ animationDelay: ".12s" }}>
            <h1 className="text-[26px] font-semibold tracking-tight">{t("misc.notFoundTitle")}</h1>
            <p className="max-w-[40ch] text-[15px] leading-relaxed text-muted-foreground">{t("misc.notFoundDesc")}</p>
            {pending && (
              <p className="max-w-[44ch] text-[15px] font-medium leading-relaxed text-foreground">
                {t("misc.pendingAccount")}
              </p>
            )}
          </div>

          <div className="pg-anim flex flex-wrap justify-center gap-3" style={{ animationDelay: ".22s" }}>
            <Link
              to={ROUTES.HOME}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-colors duration-fast ease-standard hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <path d="M3 11l9-8 9 8" />
                <path d="M5 10v10h14V10" />
              </svg>
              {t("misc.backHome")}
            </Link>
          </div>

          <div
            className="pg-anim inline-flex items-center gap-2 rounded-full border border-border bg-surface-subtle px-3.5 py-1.5 font-mono text-xs text-muted-foreground"
            style={{ animationDelay: ".3s" }}
          >
            <span className="h-[7px] w-[7px] rounded-full bg-primary" />
            {t("misc.errorBadge")}
          </div>
        </div>
      </main>

      {!embedded && <footer className="px-7 py-5 text-center text-xs text-muted-foreground">{t("misc.footer")}</footer>}
    </div>
  );
}
