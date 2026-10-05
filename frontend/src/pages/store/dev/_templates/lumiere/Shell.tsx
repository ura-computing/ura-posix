/** Lumière shell — header + footer wrapper shared across the 4 pages.
 *  Renders the CSS var block at the outermost level so every child (grid,
 *  cards, background) reads brand colors and fonts uniformly. */

import type { ReactNode } from "react";
import { Sparkles } from "lucide-react";

import type { TemplateCustomization } from "../_shared/customizationTypes";
import { lumiereCssVars } from "./tokens";

export interface LumiereShellProps {
  customization: TemplateCustomization;
  pharmacyPhone: string;
  logoUrl: string | null;
  children: ReactNode;
}

export function LumiereShell({ customization, pharmacyPhone, logoUrl, children }: LumiereShellProps) {
  return (
    <div
      className="min-h-screen bg-[var(--lum-cream)] text-[var(--lum-ink)] antialiased"
      style={{
        ...lumiereCssVars(customization),
        fontFamily: "var(--lum-font-body)",
      }}
    >
      <Header logoUrl={logoUrl} />
      <main className="relative">{children}</main>
      <Footer pharmacyPhone={pharmacyPhone} />
    </div>
  );
}

function Header({ logoUrl }: { logoUrl: string | null }) {
  return (
    <header className="relative z-10 mx-auto flex max-w-[1200px] items-center justify-between gap-6 px-5 py-6 sm:px-8 sm:py-8">
      <a href="/" className="flex items-center gap-3">
        {logoUrl ? (
          <img src={logoUrl} alt="Logo" className="h-9 w-auto" />
        ) : (
          <span className="grid size-10 place-items-center rounded-2xl bg-[var(--lum-primary)]/12 text-[var(--lum-primary)]">
            <Sparkles className="size-5" strokeWidth={1.75} />
          </span>
        )}
        <span className="font-[family-name:var(--lum-font-display)] text-xl font-semibold tracking-tight">
          Pharmacie Lumière
        </span>
      </a>
      <nav className="hidden items-center gap-8 md:flex">
        <a
          href="#accueil"
          className="text-sm font-medium text-[var(--lum-ink-soft)] transition hover:text-[var(--lum-ink)]"
        >
          Accueil
        </a>
        <a
          href="#catalogue"
          className="text-sm font-medium text-[var(--lum-ink-soft)] transition hover:text-[var(--lum-ink)]"
        >
          Catalogue
        </a>
        <a
          href="#contact"
          className="text-sm font-medium text-[var(--lum-ink-soft)] transition hover:text-[var(--lum-ink)]"
        >
          Contact
        </a>
      </nav>
      <a href="#soldes" className="lum-cta text-[13px]">
        SOLDES
      </a>
    </header>
  );
}

function Footer({ pharmacyPhone }: { pharmacyPhone: string }) {
  return (
    <footer className="relative z-10 mt-16 border-t border-black/[.06] bg-white/60 backdrop-blur">
      <div className="mx-auto grid max-w-[1200px] gap-8 px-5 py-10 sm:px-8 md:grid-cols-4">
        <div className="flex flex-col gap-2">
          <span className="font-[family-name:var(--lum-font-display)] text-lg font-semibold text-[var(--lum-ink)]">
            Pharmacie Lumière
          </span>
          <p className="text-sm text-[var(--lum-ink-soft)]">Votre pharmacie de proximité, animée par la confiance.</p>
        </div>
        <div className="flex flex-col gap-2">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--lum-ink)]/70">Boutique</h4>
          <a href="#catalogue" className="text-sm text-[var(--lum-ink-soft)] hover:text-[var(--lum-ink)]">
            Catalogue
          </a>
          <a href="#soldes" className="text-sm text-[var(--lum-ink-soft)] hover:text-[var(--lum-ink)]">
            SOLDES
          </a>
          <a href="#featured" className="text-sm text-[var(--lum-ink-soft)] hover:text-[var(--lum-ink)]">
            Produits en vedette
          </a>
        </div>
        <div className="flex flex-col gap-2">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--lum-ink)]/70">Nous joindre</h4>
          <a href={`tel:${pharmacyPhone}`} className="text-sm text-[var(--lum-ink-soft)] hover:text-[var(--lum-ink)]">
            {pharmacyPhone}
          </a>
          <span className="text-sm text-[var(--lum-ink-soft)]">Lun–Sam · 8h—20h</span>
        </div>
        <div className="flex flex-col gap-2">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--lum-ink)]/70">Adresse</h4>
          <span className="text-sm text-[var(--lum-ink-soft)]">12 rue des Fleurs</span>
          <span className="text-sm text-[var(--lum-ink-soft)]">Bouskoura, Maroc</span>
        </div>
      </div>
      <div className="mx-auto max-w-[1200px] border-t border-black/[.05] px-5 py-4 text-center text-xs text-[var(--lum-ink-soft)] sm:px-8">
        © 2026 Pharmacie Lumière · Boutique propulsée par PharmaGest
      </div>
    </footer>
  );
}
