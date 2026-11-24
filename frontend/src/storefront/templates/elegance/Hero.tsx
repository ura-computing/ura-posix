/** Élégance: the top of the home page (see `index.ts`). */
import { motion } from "framer-motion";
import { ArrowRight, MessageCircle } from "lucide-react";

import { fadeUpVariants, staggerContainer } from "../_shared/motion";
import { contactText, whatsappLink } from "../_shared/storefront";
import type { SectionProps } from "@/storefront/ui/model";

const SEAL = "Conseil · Soin · Pharmacie · Conseil · Soin · Pharmacie · ";

export function Hero({ section, store, href, pharmacyPhone, model }: SectionProps) {
  const summary = store.summary;
  const facts = [
    { value: summary?.categories.length ?? 0, label: "rayons" },
    { value: summary?.brands.length ?? 0, label: "marques" },
  ].filter((f) => f.value > 0);

  return (
    <section className="mx-auto grid max-w-[1200px] items-center gap-14 px-5 py-16 sm:px-8 md:grid-cols-[1.1fr_.9fr] md:py-24">
      <motion.div className="flex flex-col gap-7" variants={staggerContainer} initial="hidden" animate="show">
        {summary?.city && (
          <motion.span
            variants={fadeUpVariants}
            className="flex items-center gap-3 text-sm font-medium text-[var(--sf-primary)]"
          >
            <span className="h-px w-10 bg-[var(--sf-primary)]" />
            {summary.city}
          </motion.span>
        )}
        <motion.h1
          variants={fadeUpVariants}
          className="font-[family-name:var(--sf-font-display)] text-[44px] font-medium leading-[1.05] sm:text-[58px] md:text-[68px]"
        >
          {section.content.title}
        </motion.h1>
        <motion.p variants={fadeUpVariants} className="max-w-lg text-lg leading-relaxed text-[var(--sf-ink-soft)]">
          {section.content.subtitle}
        </motion.p>
        <motion.div variants={fadeUpVariants} className="flex flex-wrap items-center gap-6">
          <a href={href("catalogue")} className="sf-cta">
            {section.content.cta}
            <ArrowRight className="size-4" aria-hidden />
          </a>
          <a
            href={whatsappLink(pharmacyPhone, contactText)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 border-b border-current pb-0.5 font-semibold"
          >
            <MessageCircle className="size-4" aria-hidden />
            Nous écrire
          </a>
        </motion.div>
        {facts.length > 0 && (
          <motion.dl variants={fadeUpVariants} className="mt-4 flex gap-12 border-t border-[var(--sf-line)] pt-6">
            {facts.map((f) => (
              <div key={f.label} className="flex items-baseline gap-2">
                <dd className="font-[family-name:var(--sf-font-display)] text-4xl">{f.value}</dd>
                <dt className="text-sm text-[var(--sf-ink-soft)]">{f.label}</dt>
              </div>
            ))}
          </motion.dl>
        )}
      </motion.div>

      <div className="relative mx-auto w-full max-w-sm">
        <motion.div
          className="aspect-[3/4] overflow-hidden rounded-t-full rounded-b-[var(--sf-radius)]"
          initial={{ clipPath: "inset(100% 0 0 0)" }}
          animate={{ clipPath: "inset(0% 0 0 0)" }}
          transition={{ duration: 1.4, ease: [0.2, 0.7, 0.2, 1] }}
        >
          <img src={model.photo} alt="" className="sf-zoom size-full object-cover" />
        </motion.div>
        <svg
          viewBox="0 0 120 120"
          aria-hidden
          className="absolute -bottom-8 -left-3 size-28 sm:-left-10 sm:size-32 animate-[spin_28s_linear_infinite] rounded-full bg-[var(--sf-page)] p-2 text-[var(--sf-primary)] shadow-[var(--sf-shadow)] motion-reduce:animate-none"
        >
          <defs>
            <path id="sf-seal" d="M60,60 m-46,0 a46,46 0 1,1 92,0 a46,46 0 1,1 -92,0" />
          </defs>
          <text className="fill-current text-[10.5px] font-semibold uppercase tracking-[0.18em]">
            <textPath href="#sf-seal">{SEAL}</textPath>
          </text>
          <circle cx="60" cy="60" r="6" className="fill-current" />
        </svg>
      </div>
    </section>
  );
}
