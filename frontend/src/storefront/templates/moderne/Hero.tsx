/** Moderne: the top of the home page (see `index.ts`). */
import { motion } from "framer-motion";
import { ArrowRight, MapPin, MessageCircle, Phone } from "lucide-react";

import { blurUpVariants, fadeUpVariants, staggerContainer } from "../_shared/motion";
import { contactText, whatsappLink } from "../_shared/storefront";
import type { SectionProps } from "@/storefront/ui/model";
import { Price, ProductPhoto } from "@/storefront/ui/ProductCard";

export function Hero({ section, store, href, pharmacyPhone, model }: SectionProps) {
  const summary = store.summary;
  const pick = summary?.featured[0];
  const total = summary?.categories.reduce((n, c) => n + c.count, 0) ?? 0;
  const address = [summary?.address, summary?.city].filter(Boolean).join(", ");
  const strip = [
    { icon: MapPin, label: "Adresse", value: address, to: undefined },
    { icon: Phone, label: "Téléphone", value: pharmacyPhone, to: `tel:${pharmacyPhone}` },
    {
      icon: MessageCircle,
      label: "WhatsApp",
      value: "Écrire maintenant",
      to: whatsappLink(pharmacyPhone, contactText),
    },
  ].filter((s) => s.value);

  return (
    <section>
      <div className="mx-auto grid max-w-[1200px] items-center gap-14 px-5 py-16 sm:px-8 md:grid-cols-2 md:py-24">
        <motion.div className="flex flex-col gap-6" variants={staggerContainer} initial="hidden" animate="show">
          {summary?.city && (
            <motion.span
              variants={fadeUpVariants}
              className="inline-flex w-fit items-center gap-2 rounded-full border border-[var(--sf-line)] bg-[var(--sf-surface)] px-3.5 py-1.5 text-xs font-bold text-[var(--sf-primary)]"
            >
              <span className="size-2 animate-pulse rounded-full bg-[var(--sf-accent)]" />
              Votre pharmacie à {summary.city}
            </motion.span>
          )}
          <motion.h1
            variants={fadeUpVariants}
            className="font-[family-name:var(--sf-font-display)] text-[40px] font-extrabold leading-[1.05] tracking-tight sm:text-[52px] md:text-[60px]"
          >
            {section.content.title}
          </motion.h1>
          <motion.p variants={fadeUpVariants} className="max-w-lg text-lg leading-relaxed text-[var(--sf-ink-soft)]">
            {section.content.subtitle}
          </motion.p>
          <motion.div variants={fadeUpVariants} className="flex flex-wrap gap-3">
            <a href={href("catalogue")} className="sf-cta">
              {section.content.cta}
              <ArrowRight className="size-4" aria-hidden />
            </a>
            <a
              href={whatsappLink(pharmacyPhone, contactText)}
              target="_blank"
              rel="noopener noreferrer"
              className="sf-ghost text-[var(--sf-primary)]"
            >
              <MessageCircle className="size-4" aria-hidden />
              Nous écrire
            </a>
          </motion.div>
          {total > 0 && (
            <motion.dl variants={fadeUpVariants} className="mt-4 flex gap-10">
              <div>
                <dt className="text-xs font-semibold text-[var(--sf-ink-soft)]">Produits</dt>
                <dd className="font-[family-name:var(--sf-font-display)] text-3xl font-extrabold">{total}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold text-[var(--sf-ink-soft)]">Rayons</dt>
                <dd className="font-[family-name:var(--sf-font-display)] text-3xl font-extrabold">
                  {summary?.categories.length}
                </dd>
              </div>
            </motion.dl>
          )}
        </motion.div>

        <motion.div
          className="relative mx-auto w-full max-w-md"
          initial="hidden"
          animate="show"
          variants={blurUpVariants}
        >
          <div className="sf-morph absolute -inset-6 -z-10 bg-[var(--sf-accent)]/25 [animation-delay:-7s]" />
          <div className="sf-morph aspect-square overflow-hidden">
            <img src={model.photo} alt="" className="sf-zoom size-full object-cover" />
          </div>
          {pick && (
            <a
              href={href("produit", { product: pick.id })}
              className="sf-bob absolute -bottom-6 -left-4 flex w-60 items-center gap-3 rounded-[var(--sf-radius)] bg-[var(--sf-surface)] p-3 shadow-[var(--sf-shadow)] sm:-left-10"
            >
              <ProductPhoto product={pick} className="size-16 shrink-0 !rounded-xl" />
              <span className="flex min-w-0 flex-col">
                <span className="truncate text-sm font-bold">{pick.name}</span>
                <Price ppv={pick.ppv} promo={pick.promo_price} />
              </span>
            </a>
          )}
        </motion.div>
      </div>

      <div className="bg-[var(--sf-ink)] text-[var(--sf-page)]">
        <ul className="mx-auto grid max-w-[1200px] gap-6 px-5 py-8 sm:px-8 md:grid-cols-3">
          {strip.map(({ icon: Icon, label, value, to }) => (
            <li key={label} className="flex items-center gap-4">
              <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-[var(--sf-primary)] text-[var(--sf-on-primary)]">
                <Icon className="size-5" aria-hidden />
              </span>
              <span className="flex min-w-0 flex-col">
                <span className="text-xs font-semibold uppercase tracking-wider opacity-60">{label}</span>
                {to ? (
                  <a
                    href={to}
                    target={to.startsWith("http") ? "_blank" : undefined}
                    rel="noopener noreferrer"
                    className="truncate font-bold hover:underline"
                  >
                    {value}
                  </a>
                ) : (
                  <span className="truncate font-bold">{value}</span>
                )}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
