/** Classique: the top of the home page (see `index.ts`). */
import { motion } from "framer-motion";
import { ArrowRight, HeartPulse, MessageCircle, PackageCheck } from "lucide-react";

import { fadeUpVariants, staggerContainer } from "../_shared/motion";
import { contactText, whatsappLink } from "../_shared/storefront";
import type { SectionProps } from "@/storefront/ui/model";

const PROMISES = [
  { icon: HeartPulse, title: "Conseil du pharmacien", text: "Une question sur un produit ? Nous vous guidons." },
  { icon: MessageCircle, title: "Réponse sur WhatsApp", text: "Écrivez-nous : nous vous répondons vite." },
  { icon: PackageCheck, title: "Disponible en pharmacie", text: "Le stock affiché est celui de la pharmacie." },
];

export function Hero({ section, store, href, pharmacyPhone, customization, model }: SectionProps) {
  return (
    <section>
      <div className="relative isolate overflow-hidden">
        <img src={model.photo} alt="" className="sf-zoom absolute inset-0 -z-20 size-full object-cover" />
        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-black/75 via-black/55 to-black/20" />
        <motion.div
          className="mx-auto flex max-w-[1200px] flex-col gap-5 px-5 pb-36 pt-24 text-white sm:px-8 md:pb-44 md:pt-32"
          variants={staggerContainer}
          initial="hidden"
          animate="show"
        >
          <motion.span variants={fadeUpVariants} className="text-lg font-extrabold text-[var(--sf-primary)]">
            {customization.storeName}
            {store.summary?.city && <span className="font-semibold text-white/80"> · {store.summary.city}</span>}
          </motion.span>
          <motion.h1
            variants={fadeUpVariants}
            className="max-w-2xl font-[family-name:var(--sf-font-display)] text-4xl font-extrabold leading-tight sm:text-5xl md:text-6xl"
          >
            {section.content.title}
          </motion.h1>
          <motion.p variants={fadeUpVariants} className="max-w-xl text-lg text-white/85">
            {section.content.subtitle}
          </motion.p>
          <motion.div variants={fadeUpVariants} className="mt-3 flex flex-wrap gap-3">
            <a href={href("catalogue")} className="sf-cta">
              {section.content.cta}
              <ArrowRight className="size-4" aria-hidden />
            </a>
            <a
              href={whatsappLink(pharmacyPhone, contactText)}
              target="_blank"
              rel="noopener noreferrer"
              className="sf-ghost"
            >
              <MessageCircle className="size-4" aria-hidden />
              Nous écrire
            </a>
          </motion.div>
        </motion.div>
      </div>

      <motion.ul
        className="relative z-[1] mx-auto -mt-20 grid max-w-[1200px] gap-5 px-5 sm:px-8 md:grid-cols-3"
        variants={staggerContainer}
        initial="hidden"
        animate="show"
      >
        {PROMISES.map(({ icon: Icon, title, text }) => (
          <motion.li
            key={title}
            variants={fadeUpVariants}
            className="sf-card flex items-start gap-4 rounded-[var(--sf-radius)] border-b-4 border-[var(--sf-primary)] bg-[var(--sf-surface)] p-6 shadow-[0_18px_40px_-20px_rgba(0,0,0,.3)]"
          >
            <span className="grid size-14 shrink-0 place-items-center rounded-full bg-[var(--sf-primary)]/12 text-[var(--sf-primary)]">
              <Icon className="size-7" strokeWidth={1.75} aria-hidden />
            </span>
            <span className="flex flex-col gap-1">
              <span className="font-extrabold">{title}</span>
              <span className="text-sm text-[var(--sf-ink-soft)]">{text}</span>
            </span>
          </motion.li>
        ))}
      </motion.ul>
    </section>
  );
}
