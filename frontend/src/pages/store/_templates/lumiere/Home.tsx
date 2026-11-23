/** Lumière — Home page. Sections in the editor's order (`layout.y`), each hidden by its switch, filled ONLY with the
 *  pharmacy's own data (`store.summary`): its featured products, its categories, its laboratoires. A section with no
 *  data shows nothing (« Nos promotions » waits for the owner's prices, step C). */

import { useMemo } from "react";
import { motion } from "framer-motion";
import { ArrowRight, Flower2, Leaf, MapPin, MessageCircle, Phone } from "lucide-react";

import type { SectionConfig, TemplateProps } from "../_shared/customizationTypes";
import { blurUpVariants, fadeUpVariants, staggerContainer, viewportOnce } from "../_shared/motion";
import { contactText, orderText, whatsappLink } from "../_shared/storefront";

import { Price, ProductCard, ProductPhoto, StockPill } from "./ProductCard";
import { LumiereShell } from "./Shell";
import { LumiereStyles } from "./styles";

export function LumiereHome(props: TemplateProps) {
  const { customization } = props;
  const sections = useMemo(
    () => [...customization.sections].sort((a, b) => a.layout.y - b.layout.y).filter((s) => s.visible),
    [customization.sections],
  );

  return (
    <LumiereShell props={props}>
      <LumiereStyles />
      <AmbientBackground />
      <div className="relative z-[1] mx-auto flex max-w-[1200px] flex-col gap-16 px-5 py-6 sm:px-8 sm:py-8">
        {sections.map((s) => (
          <motion.section
            key={s.key}
            initial="hidden"
            whileInView="show"
            viewport={viewportOnce}
            variants={blurUpVariants}
          >
            {s.key === "hero" && <Hero section={s} {...props} />}
            {s.key === "brands" && <Brands section={s} {...props} />}
            {s.key === "catalogue" && <Categories section={s} {...props} />}
            {s.key === "soldes" && <Promos section={s} {...props} />}
            {s.key === "packs" && <Packs section={s} {...props} />}
            {s.key === "featured_categories" && <Featured section={s} {...props} />}
            {s.key === "contact" && <ContactTeaser section={s} {...props} />}
          </motion.section>
        ))}
      </div>
    </LumiereShell>
  );
}

type SectionProps = TemplateProps & { section: SectionConfig };

function SectionHeader({ section, center }: { section: SectionConfig; center?: boolean }) {
  return (
    <header className={`flex flex-col gap-2 ${center ? "items-center text-center" : ""}`}>
      <h2 className="font-[family-name:var(--lum-font-display)] text-3xl font-semibold text-[var(--lum-ink)] sm:text-4xl">
        {section.content.title}
      </h2>
      {section.content.sub && <p className="max-w-lg text-sm text-[var(--lum-ink-soft)]">{section.content.sub}</p>}
    </header>
  );
}

function Hero({ section, store, href, pharmacyPhone }: SectionProps) {
  const pick = store.summary?.featured[0];
  return (
    <div className="grid items-center gap-10 py-10 md:grid-cols-[1.15fr_.85fr] md:py-16">
      <div className="flex flex-col gap-5">
        {store.summary?.city && (
          <span className="inline-flex w-fit items-center gap-2 rounded-full bg-[var(--lum-secondary)]/40 px-3 py-1 text-xs font-semibold text-[var(--lum-ink)]">
            <MapPin className="size-3.5" aria-hidden />
            {store.summary.city}
          </span>
        )}
        <h1 className="font-[family-name:var(--lum-font-display)] text-[42px] font-semibold leading-[1.05] tracking-tight text-[var(--lum-ink)] sm:text-[54px] md:text-[64px]">
          {section.content.title}
        </h1>
        <p className="max-w-lg text-lg leading-relaxed text-[var(--lum-ink-soft)]">{section.content.subtitle}</p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <a href={href("catalogue")} className="lum-cta">
            {section.content.cta}
            <ArrowRight aria-hidden className="size-4" />
          </a>
          <a
            href={whatsappLink(pharmacyPhone, contactText)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-[15px] font-semibold text-[var(--lum-ink)] underline-offset-4 hover:underline"
          >
            <MessageCircle className="size-4" aria-hidden />
            Nous écrire
          </a>
        </div>
      </div>

      {pick && (
        <a href={href("produit", { product: pick.id })} className="relative flex justify-center">
          <div className="lum-bob relative flex w-full max-w-sm flex-col gap-4 rounded-[28px] bg-white/85 p-6 shadow-[0_30px_70px_-30px_rgba(31,169,126,0.35)] ring-1 ring-black/[.04] backdrop-blur">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--lum-ink-soft)]">
              Disponible en pharmacie
            </span>
            <ProductPhoto product={pick} className="h-48" />
            <h3 className="font-[family-name:var(--lum-font-display)] text-xl font-semibold text-[var(--lum-ink)]">
              {pick.name}
            </h3>
            <div className="flex items-center justify-between">
              <Price ppv={pick.ppv} promo={pick.promo_price} size="md" />
              <StockPill inStock={pick.in_stock} />
            </div>
          </div>
        </a>
      )}
    </div>
  );
}

function Brands({ section, store }: SectionProps) {
  const brands = store.summary?.brands ?? [];
  if (brands.length === 0) return null;
  return (
    <div className="flex flex-col gap-4 py-6">
      <h3 className="text-center text-xs font-semibold uppercase tracking-[0.2em] text-[var(--lum-ink-soft)]">
        {section.content.title}
      </h3>
      <motion.div
        className="flex flex-wrap items-center justify-center gap-x-10 gap-y-3"
        variants={staggerContainer}
        initial="hidden"
        whileInView="show"
        viewport={viewportOnce}
      >
        {brands.map((b) => (
          <motion.span key={b} variants={fadeUpVariants} className="text-lg font-medium text-[var(--lum-ink)]/70">
            {b}
          </motion.span>
        ))}
      </motion.div>
    </div>
  );
}

function Categories({ section, store, href }: SectionProps) {
  const categories = (store.summary?.categories ?? []).slice(0, 8);
  if (categories.length === 0) return null;
  return (
    <div className="flex flex-col gap-8 py-10">
      <SectionHeader section={section} center />
      <motion.div
        className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4"
        variants={staggerContainer}
        initial="hidden"
        whileInView="show"
        viewport={viewportOnce}
      >
        {categories.map((c) => (
          <motion.a
            key={c.name}
            href={href("catalogue", { category: c.name })}
            variants={fadeUpVariants}
            className="flex flex-col items-center gap-3 rounded-3xl bg-white/70 p-6 text-center shadow-[0_20px_50px_-30px_rgba(0,0,0,.15)] ring-1 ring-black/[.03] backdrop-blur transition-transform duration-300 hover:-translate-y-1"
          >
            <span className="grid size-14 place-items-center rounded-2xl bg-[var(--lum-primary)]/12 text-[var(--lum-primary)]">
              <Flower2 className="size-6" strokeWidth={1.75} aria-hidden />
            </span>
            <span className="font-semibold text-[var(--lum-ink)]">{c.name}</span>
            <span className="font-[family-name:var(--lum-font-mono)] text-[11px] text-[var(--lum-ink-soft)]">
              {c.count} produits
            </span>
          </motion.a>
        ))}
      </motion.div>
    </div>
  );
}

function Featured({ section, store, href, pharmacyPhone }: SectionProps) {
  const products = store.summary?.featured ?? [];
  if (products.length === 0) return null;
  return (
    <div className="flex flex-col gap-8 py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <SectionHeader section={section} />
        <a
          href={href("catalogue")}
          className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--lum-primary)]"
        >
          Tous nos produits
          <ArrowRight className="size-4" aria-hidden />
        </a>
      </div>
      <motion.div
        className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4"
        variants={staggerContainer}
        initial="hidden"
        whileInView="show"
        viewport={viewportOnce}
      >
        {products.slice(0, 8).map((p) => (
          <ProductCard key={p.id} product={p} href={href} pharmacyPhone={pharmacyPhone} />
        ))}
      </motion.div>
    </div>
  );
}

function Promos({ section, store, href, pharmacyPhone }: SectionProps) {
  const products = store.summary?.promos ?? [];
  if (products.length === 0) return null;
  return (
    <div className="flex flex-col gap-8 py-10">
      <SectionHeader section={section} />
      <motion.div
        className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4"
        variants={staggerContainer}
        initial="hidden"
        whileInView="show"
        viewport={viewportOnce}
      >
        {products.map((p) => (
          <ProductCard key={p.id} product={p} href={href} pharmacyPhone={pharmacyPhone} />
        ))}
      </motion.div>
    </div>
  );
}

function Packs({ section, store, pharmacyPhone }: SectionProps) {
  const packs = store.summary?.packs ?? [];
  if (packs.length === 0) return null;
  return (
    <div className="flex flex-col gap-8 py-10">
      <SectionHeader section={section} />
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        {packs.map((pack) => (
          <article
            key={pack.id}
            className="flex flex-col gap-4 rounded-[28px] bg-white/85 p-6 shadow-[0_30px_70px_-40px_rgba(0,0,0,.18)] ring-1 ring-black/[.04] backdrop-blur"
          >
            <div className="flex items-start justify-between gap-3">
              <h3 className="font-[family-name:var(--lum-font-display)] text-2xl font-semibold text-[var(--lum-ink)]">
                {pack.name}
              </h3>
              <Price ppv={pack.ppv_total} promo={pack.price} size="md" />
            </div>
            <ul className="grid grid-cols-3 gap-3">
              {pack.items.map((i) => (
                <li key={i.product.id} className="flex flex-col gap-1.5">
                  <ProductPhoto product={i.product} className="h-24" />
                  <span className="line-clamp-2 text-[11px] leading-snug text-[var(--lum-ink-soft)]">
                    {i.quantity > 1 ? `${i.quantity} × ` : ""}
                    {i.product.name}
                  </span>
                </li>
              ))}
            </ul>
            <a
              href={whatsappLink(pharmacyPhone, orderText(`le ${pack.name}`))}
              target="_blank"
              rel="noopener noreferrer"
              className="lum-cta w-fit"
            >
              <MessageCircle className="size-4" aria-hidden />
              Commander le pack
            </a>
          </article>
        ))}
      </div>
    </div>
  );
}

function ContactTeaser({ section, store, pharmacyPhone }: SectionProps) {
  const address = [store.summary?.address, store.summary?.city].filter(Boolean).join(", ");
  return (
    <div className="grid gap-6 rounded-[32px] bg-white/85 p-8 shadow-[0_30px_70px_-40px_rgba(0,0,0,.15)] ring-1 ring-black/[.04] backdrop-blur md:grid-cols-[1fr_auto] md:items-center md:p-12">
      <div className="flex flex-col gap-3">
        <h2 className="font-[family-name:var(--lum-font-display)] text-3xl font-semibold text-[var(--lum-ink)]">
          {section.content.title}
        </h2>
        <p className="text-[var(--lum-ink-soft)]">{section.content.sub}</p>
        <div className="flex flex-col gap-1.5 text-sm text-[var(--lum-ink)]">
          {address && (
            <span className="inline-flex items-center gap-2">
              <MapPin className="size-4 text-[var(--lum-primary)]" aria-hidden />
              {address}
            </span>
          )}
          <span className="inline-flex items-center gap-2">
            <Phone className="size-4 text-[var(--lum-primary)]" aria-hidden />
            {pharmacyPhone}
          </span>
        </div>
      </div>
      <div className="flex flex-wrap gap-3">
        <a
          href={whatsappLink(pharmacyPhone, orderText("un produit"))}
          target="_blank"
          rel="noopener noreferrer"
          className="lum-cta"
        >
          <MessageCircle className="size-4" aria-hidden />
          WhatsApp
        </a>
        <a
          href={`tel:${pharmacyPhone}`}
          className="inline-flex items-center gap-2 rounded-full border border-[var(--lum-primary)] px-5 py-3 text-sm font-semibold text-[var(--lum-primary)]"
        >
          <Phone className="size-4" aria-hidden />
          Appeler
        </a>
      </div>
    </div>
  );
}

function AmbientBackground() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      <div
        className="lum-bloom lum-bloomA absolute -left-24 top-1/4 size-96"
        style={{ background: "var(--lum-secondary)" }}
      />
      <div
        className="lum-bloom lum-bloomB absolute -right-24 bottom-1/4 size-96"
        style={{ background: "var(--lum-primary)" }}
      />
      <Leaf
        className="lum-leaf lum-leaf1 absolute left-[10%] top-[20%] size-8 text-[var(--lum-primary)]"
        strokeWidth={1.5}
      />
      <Leaf
        className="lum-leaf lum-leaf2 absolute right-[15%] top-[60%] size-7 text-[var(--lum-primary)]"
        strokeWidth={1.5}
      />
    </div>
  );
}
