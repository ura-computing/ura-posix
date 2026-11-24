/** Lumière shell — header + footer shared by the 4 pages, with the pharmacy's own name, logo, address and phone.
 *  Renders the CSS var block at the outermost level so every child reads the brand colors and fonts. */

import type { ReactNode } from "react";
import { MessageCircle, Sparkles } from "lucide-react";

import type { StoreHref, StorePage, TemplateProps } from "../_shared/customizationTypes";
import { contactText, whatsappLink } from "../_shared/storefront";
import { lumiereCssVars } from "./tokens";

const NAV: [StorePage, string][] = [
  ["home", "Accueil"],
  ["catalogue", "Nos produits"],
  ["contact", "Contact"],
];

export function LumiereShell({
  props,
  children,
}: {
  props: Pick<TemplateProps, "customization" | "store" | "href" | "pharmacyPhone" | "page">;
  children: ReactNode;
}) {
  const { customization, store, href, pharmacyPhone, page } = props;
  return (
    <div
      className="min-h-screen bg-[var(--lum-cream)] text-[var(--lum-ink)] antialiased"
      style={{ ...lumiereCssVars(customization), fontFamily: "var(--lum-font-body)" }}
    >
      <header className="relative z-10 mx-auto flex max-w-[1200px] items-center justify-between gap-6 px-5 py-6 sm:px-8 sm:py-8">
        <a href={href("home")} className="flex min-w-0 items-center gap-3">
          {customization.logoUrl ? (
            <img src={customization.logoUrl} alt="" className="h-10 w-auto" />
          ) : (
            <span className="grid size-10 place-items-center rounded-2xl bg-[var(--lum-primary)]/12 text-[var(--lum-primary)]">
              <Sparkles className="size-5" strokeWidth={1.75} aria-hidden />
            </span>
          )}
          <span className="truncate font-[family-name:var(--lum-font-display)] text-xl font-semibold tracking-tight">
            {customization.storeName}
          </span>
        </a>
        <nav className="hidden items-center gap-8 md:flex">
          {NAV.map(([p, label]) => (
            <a
              key={p}
              href={href(p)}
              aria-current={page === p ? "page" : undefined}
              className="text-sm font-medium text-[var(--lum-ink-soft)] transition hover:text-[var(--lum-ink)] aria-[current=page]:text-[var(--lum-ink)]"
            >
              {label}
            </a>
          ))}
        </nav>
        <WhatsAppButton phone={pharmacyPhone} />
      </header>

      <main className="relative">{children}</main>

      <Footer
        storeName={customization.storeName}
        pharmacyPhone={pharmacyPhone}
        address={[store.summary?.address, store.summary?.city].filter(Boolean).join(", ")}
        href={href}
      />
    </div>
  );
}

export function WhatsAppButton({ phone, label = "Nous écrire" }: { phone: string; label?: string }) {
  return (
    <a
      href={whatsappLink(phone, contactText)}
      target="_blank"
      rel="noopener noreferrer"
      className="lum-cta text-[13px]"
    >
      <MessageCircle className="size-4" aria-hidden />
      {label}
    </a>
  );
}

function Footer({
  storeName,
  pharmacyPhone,
  address,
  href,
}: {
  storeName: string;
  pharmacyPhone: string;
  address: string;
  href: StoreHref;
}) {
  return (
    <footer className="relative z-10 mt-16 border-t border-black/[.06] bg-white/60 backdrop-blur">
      <div className="mx-auto grid max-w-[1200px] gap-8 px-5 py-10 sm:px-8 md:grid-cols-3">
        <div className="flex flex-col gap-2">
          <span className="font-[family-name:var(--lum-font-display)] text-lg font-semibold text-[var(--lum-ink)]">
            {storeName}
          </span>
          <p className="text-sm text-[var(--lum-ink-soft)]">Une question sur un produit ? Écrivez-nous sur WhatsApp.</p>
        </div>
        <div className="flex flex-col gap-2">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--lum-ink)]/70">La pharmacie</h4>
          <a href={href("catalogue")} className="text-sm text-[var(--lum-ink-soft)] hover:text-[var(--lum-ink)]">
            Nos produits
          </a>
          <a href={href("contact")} className="text-sm text-[var(--lum-ink-soft)] hover:text-[var(--lum-ink)]">
            Contact
          </a>
        </div>
        <div className="flex flex-col gap-2">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--lum-ink)]/70">Nous joindre</h4>
          <a href={`tel:${pharmacyPhone}`} className="text-sm text-[var(--lum-ink-soft)] hover:text-[var(--lum-ink)]">
            {pharmacyPhone}
          </a>
          {address && <span className="text-sm text-[var(--lum-ink-soft)]">{address}</span>}
        </div>
      </div>
      <div className="mx-auto max-w-[1200px] border-t border-black/[.05] px-5 py-4 text-center text-xs text-[var(--lum-ink-soft)] sm:px-8">
        © {new Date().getFullYear()} {storeName} · Boutique propulsée par PharmaGest
      </div>
    </footer>
  );
}
