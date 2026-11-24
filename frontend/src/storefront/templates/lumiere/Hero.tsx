/** Lumière: the top of the home page (see `index.ts`). */
import { ArrowRight, Leaf, MapPin, MessageCircle } from "lucide-react";

import { contactText, whatsappLink } from "../_shared/storefront";
import type { SectionProps } from "@/storefront/ui/model";
import { Price, ProductPhoto, StockPill } from "@/storefront/ui/ProductCard";

export function Hero({ section, store, href, pharmacyPhone }: SectionProps) {
  const pick = store.summary?.featured[0];
  return (
    <section className="mx-auto grid max-w-[1200px] items-center gap-12 px-5 py-14 sm:px-8 md:grid-cols-[1.15fr_.85fr] md:py-24">
      <div className="flex flex-col gap-6">
        {store.summary?.city && (
          <span className="inline-flex w-fit items-center gap-2 rounded-full bg-[var(--sf-secondary)]/50 px-3 py-1 text-xs font-semibold">
            <MapPin className="size-3.5" aria-hidden />
            {store.summary.city}
          </span>
        )}
        <h1 className="font-[family-name:var(--sf-font-display)] text-[42px] font-semibold leading-[1.05] tracking-tight sm:text-[54px] md:text-[64px]">
          {section.content.title}
        </h1>
        <p className="max-w-lg text-lg leading-relaxed text-[var(--sf-ink-soft)]">{section.content.subtitle}</p>
        <div className="mt-2 flex flex-wrap items-center gap-4">
          <a href={href("catalogue")} className="sf-cta">
            {section.content.cta}
            <ArrowRight aria-hidden className="size-4" />
          </a>
          <a
            href={whatsappLink(pharmacyPhone, contactText)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 font-semibold underline-offset-4 hover:underline"
          >
            <MessageCircle className="size-4" aria-hidden />
            Nous écrire
          </a>
        </div>
      </div>

      {pick && (
        <a href={href("produit", { product: pick.id })} className="flex justify-center">
          <div className="sf-bob flex w-full max-w-sm flex-col gap-4 rounded-[28px] bg-white/85 p-6 shadow-[0_30px_70px_-30px_color-mix(in_oklab,var(--sf-primary),transparent_50%)] ring-1 ring-black/[.04] backdrop-blur">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--sf-ink-soft)]">
              Disponible en pharmacie
            </span>
            <ProductPhoto product={pick} className="h-48" />
            <h3 className="font-[family-name:var(--sf-font-display)] text-xl font-semibold">{pick.name}</h3>
            <div className="flex items-center justify-between">
              <Price ppv={pick.ppv} promo={pick.promo_price} size="md" />
              <StockPill inStock={pick.in_stock} />
            </div>
          </div>
        </a>
      )}
    </section>
  );
}

export function Decor() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      <div className="sf-bloom sf-bloomA -left-24 top-1/4 size-96 bg-[var(--sf-secondary)]" />
      <div className="sf-bloom sf-bloomB -right-24 bottom-1/4 size-96 bg-[var(--sf-primary)]" />
      <Leaf className="sf-drift absolute left-[10%] top-[20%] size-8 text-[var(--sf-primary)]" strokeWidth={1.5} />
      <Leaf
        className="sf-drift absolute right-[15%] top-[60%] size-7 text-[var(--sf-primary)] [animation-delay:-6s]"
        strokeWidth={1.5}
      />
    </div>
  );
}
