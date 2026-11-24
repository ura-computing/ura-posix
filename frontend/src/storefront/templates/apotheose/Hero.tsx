/** Apothéose: the top of the home page (see `index.ts`). */
import { motion } from "framer-motion";
import { ArrowRight, MessageCircle } from "lucide-react";

import { fadeUpVariants, staggerContainer } from "../_shared/motion";
import { contactText, whatsappLink } from "../_shared/storefront";
import type { SectionProps } from "@/storefront/ui/model";
import { Price, ProductPhoto } from "@/storefront/ui/ProductCard";

export function Hero({ section, store, href, pharmacyPhone, model }: SectionProps) {
  const picks = store.summary?.featured.slice(0, 3) ?? [];
  return (
    <section className="relative isolate overflow-hidden">
      <img src={model.photo} alt="" className="sf-zoom absolute inset-0 -z-20 size-full object-cover opacity-35" />
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_center,transparent_0%,var(--sf-page)_75%)]" />
      <motion.div
        className="mx-auto flex min-h-[80vh] max-w-[1000px] flex-col items-center justify-center gap-7 px-5 py-24 text-center sm:px-8"
        variants={staggerContainer}
        initial="hidden"
        animate="show"
      >
        {store.summary?.city && (
          <motion.span
            variants={fadeUpVariants}
            className="text-xs font-semibold uppercase tracking-[0.4em] text-[var(--sf-primary)]"
          >
            {store.summary.city}
          </motion.span>
        )}
        <motion.h1
          variants={fadeUpVariants}
          className="font-[family-name:var(--sf-font-display)] text-5xl font-semibold leading-[1.02] sm:text-6xl md:text-7xl"
        >
          {section.content.title}
        </motion.h1>
        <motion.span variants={fadeUpVariants} className="sf-shine h-px w-40" />
        <motion.p variants={fadeUpVariants} className="max-w-xl text-lg text-[var(--sf-ink-soft)]">
          {section.content.subtitle}
        </motion.p>
        <motion.div variants={fadeUpVariants} className="flex flex-wrap justify-center gap-3">
          <a href={href("catalogue")} className="sf-cta uppercase tracking-[0.15em] !text-xs">
            {section.content.cta}
            <ArrowRight className="size-4" aria-hidden />
          </a>
          <a
            href={whatsappLink(pharmacyPhone, contactText)}
            target="_blank"
            rel="noopener noreferrer"
            className="sf-ghost uppercase tracking-[0.15em] !text-xs text-[var(--sf-primary)]"
          >
            <MessageCircle className="size-4" aria-hidden />
            Nous écrire
          </a>
        </motion.div>

        {picks.length > 0 && (
          <motion.ul variants={staggerContainer} className="mt-10 grid w-full gap-5 sm:grid-cols-3">
            {picks.map((p) => (
              <motion.li key={p.id} variants={fadeUpVariants}>
                <a
                  href={href("produit", { product: p.id })}
                  className="sf-card flex flex-col items-center gap-3 border border-[var(--sf-line)] bg-[var(--sf-surface)]/80 p-4 backdrop-blur"
                >
                  <ProductPhoto product={p} className="h-36 w-full" />
                  <span className="line-clamp-1 font-[family-name:var(--sf-font-display)] text-lg">{p.name}</span>
                  <Price ppv={p.ppv} promo={p.promo_price} />
                </a>
              </motion.li>
            ))}
          </motion.ul>
        )}
      </motion.div>
    </section>
  );
}
