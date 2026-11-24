/** Every page's frame: the header (logo, the 3 pages, « Nous écrire »), the page, the footer (the pharmacy's own name,
 *  address and phone). Sets the model's CSS variables on the outer `div`, so every child reads them. */
import type { ReactNode } from "react";
import { MotionConfig, motion } from "framer-motion";
import { MessageCircle, Plus } from "lucide-react";

import type { StorePage } from "../templates/_shared/customizationTypes";
import { blurUpVariants } from "../templates/_shared/motion";
import { contactText, whatsappLink } from "../templates/_shared/storefront";
import { modelVars, type PageProps } from "./model";
import { StoreStyles } from "./Styles";

const NAV: [StorePage, string][] = [
  ["home", "Accueil"],
  ["catalogue", "Nos produits"],
  ["contact", "Contact"],
];

export function Shell({ props, children }: { props: PageProps; children: ReactNode }) {
  const { model, customization, store, href, pharmacyPhone, page } = props;
  const { Decor } = model;
  const address = [store.summary?.address, store.summary?.city].filter(Boolean).join(", ");
  const navLink = (p: StorePage, label: string) => (
    <a
      key={p}
      href={href(p)}
      aria-current={page === p ? "page" : undefined}
      className="relative py-1 text-sm font-semibold text-[var(--sf-ink-soft)] transition hover:text-[var(--sf-ink)] aria-[current=page]:text-[var(--sf-ink)] aria-[current=page]:after:absolute aria-[current=page]:after:inset-x-0 aria-[current=page]:after:-bottom-0.5 aria-[current=page]:after:h-0.5 aria-[current=page]:after:rounded-full aria-[current=page]:after:bg-[var(--sf-primary)]"
    >
      {label}
    </a>
  );

  return (
    <div
      className="relative min-h-screen overflow-x-clip bg-[var(--sf-page)] text-[var(--sf-ink)] antialiased"
      style={{ ...modelVars(model, customization), fontFamily: "var(--sf-font-body)" }}
    >
      {/* « Reduce motion » on the device: no slides, only fades. */}
      <MotionConfig reducedMotion="user">
        <StoreStyles />
        {Decor && <Decor />}

        <header className="sticky top-0 z-30 border-b border-[var(--sf-line)] bg-[color-mix(in_oklab,var(--sf-page),transparent_15%)] backdrop-blur-md">
          <div className="mx-auto flex max-w-[1200px] items-center justify-between gap-6 px-5 py-4 sm:px-8">
            <a href={href("home")} className="flex min-w-0 items-center gap-3">
              {customization.logoUrl ? (
                <img src={customization.logoUrl} alt="" className="h-10 w-auto max-w-[140px] object-contain" />
              ) : (
                <span className="grid size-10 shrink-0 place-items-center rounded-[var(--sf-button-radius)] bg-[var(--sf-primary)] text-[var(--sf-on-primary)]">
                  <Plus className="size-6" strokeWidth={3} aria-hidden />
                </span>
              )}
              <span className="truncate font-[family-name:var(--sf-font-display)] text-xl font-semibold tracking-tight">
                {customization.storeName}
              </span>
            </a>
            <nav className="hidden items-center gap-8 md:flex">{NAV.map(([p, label]) => navLink(p, label))}</nav>
            <a
              href={whatsappLink(pharmacyPhone, contactText)}
              target="_blank"
              rel="noopener noreferrer"
              className="sf-cta shrink-0 !px-4 !py-2.5 text-[13px]"
            >
              <MessageCircle className="size-4" aria-hidden />
              <span className="max-sm:hidden">Nous écrire</span>
            </a>
          </div>
          <nav className="flex justify-center gap-8 pb-3 md:hidden">{NAV.map(([p, label]) => navLink(p, label))}</nav>
        </header>

        <main className="relative z-[1]">{children}</main>

        <footer className="relative z-[1] border-t border-[var(--sf-line)] bg-[var(--sf-surface)]">
          <div className="mx-auto grid max-w-[1200px] gap-8 px-5 py-12 sm:px-8 md:grid-cols-3">
            <div className="flex flex-col gap-2">
              <span className="font-[family-name:var(--sf-font-display)] text-lg font-semibold">
                {customization.storeName}
              </span>
              <p className="text-sm text-[var(--sf-ink-soft)]">
                Une question sur un produit ? Écrivez-nous sur WhatsApp.
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--sf-ink-soft)]">La pharmacie</h4>
              <a href={href("catalogue")} className="text-sm hover:text-[var(--sf-primary)]">
                Nos produits
              </a>
              <a href={href("contact")} className="text-sm hover:text-[var(--sf-primary)]">
                Contact
              </a>
            </div>
            <div className="flex flex-col gap-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--sf-ink-soft)]">Nous joindre</h4>
              <a href={`tel:${pharmacyPhone}`} className="text-sm hover:text-[var(--sf-primary)]">
                {pharmacyPhone}
              </a>
              {address && <span className="text-sm text-[var(--sf-ink-soft)]">{address}</span>}
            </div>
          </div>
          <div className="mx-auto max-w-[1200px] border-t border-[var(--sf-line)] px-5 py-4 text-center text-xs text-[var(--sf-ink-soft)] sm:px-8">
            © {new Date().getFullYear()} {customization.storeName} · Boutique propulsée par PharmaGest
          </div>
        </footer>
      </MotionConfig>
    </div>
  );
}

/** The top of « Nos produits » and « Contact »: a small line in the main color, the title, a sub-title. */
export function PageTitle({ eyebrow, title, sub }: { eyebrow: string; title: string; sub?: string }) {
  return (
    <div className="border-b border-[var(--sf-line)] bg-[var(--sf-tint)]">
      <motion.header
        className="mx-auto flex max-w-[1200px] flex-col gap-3 px-5 py-12 sm:px-8 md:py-16"
        initial="hidden"
        animate="show"
        variants={blurUpVariants}
      >
        <span className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--sf-primary)]">{eyebrow}</span>
        <h1 className="font-[family-name:var(--sf-font-display)] text-4xl font-semibold leading-tight sm:text-5xl">
          {title}
        </h1>
        {sub && <p className="max-w-2xl text-lg text-[var(--sf-ink-soft)]">{sub}</p>}
      </motion.header>
    </div>
  );
}
