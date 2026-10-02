/** Lumière — Product detail page. Big left hero, description, price + SOLDE,
 *  WhatsApp CTA, related products carousel. Not customizable. */

import { motion } from "framer-motion";
import { ChevronRight, Flower2, MessageCircle, Sparkles } from "lucide-react";

import { MOCK_STORE_PRODUCTS, whatsappOrderLink } from "../_shared/mockStore";
import { blurUpVariants, viewportOnce } from "../_shared/motion";
import type { TemplateProps } from "../_shared/customizationTypes";

import { LumiereShell } from "./Shell";
import { LumiereStyles } from "./styles";


export function LumiereProduit(props: TemplateProps) {
  const { customization, categories, pharmacyPhone, productId } = props;
  const product = MOCK_STORE_PRODUCTS.find((p) => p.id === productId) ?? MOCK_STORE_PRODUCTS[0];
  const category = categories.find((c) => c.id === product.storeCategoryId);
  const onSale = product.solde != null;
  const price  = product.solde ?? product.ppv;
  const related = MOCK_STORE_PRODUCTS.filter((p) => p.id !== product.id).slice(0, 3);

  const stockLabel = product.stock === 0 ? "Rupture"     : product.stock <= 5 ? "Stock limité" : "En stock";
  const stockTone  = product.stock === 0 ? "text-rose-600 bg-rose-500/10" : product.stock <= 5 ? "text-amber-600 bg-amber-500/10" : "text-emerald-600 bg-emerald-500/10";

  return (
    <LumiereShell customization={customization} pharmacyPhone={pharmacyPhone} logoUrl={customization.logoUrl}>
      <LumiereStyles />
      <div className="mx-auto max-w-[1200px] px-5 py-10 sm:px-8 sm:py-14">
        <nav className="mb-6 flex items-center gap-2 text-sm text-[var(--lum-ink-soft)]">
          <a href="#catalogue" className="hover:text-[var(--lum-ink)]">Catalogue</a>
          <ChevronRight aria-hidden className="size-3.5" />
          <span className="text-[var(--lum-ink)]">{product.name}</span>
        </nav>

        <motion.article
          className="grid gap-10 md:grid-cols-[1.1fr_.9fr]"
          initial="hidden" whileInView="show" viewport={viewportOnce}
          variants={blurUpVariants}
        >
          <div className="relative grid h-96 place-items-center overflow-hidden rounded-[36px] bg-gradient-to-br from-[var(--lum-secondary)]/50 to-[var(--lum-primary)]/10 md:h-[560px]">
            <Flower2 className="size-40 text-[var(--lum-ink)]/60" strokeWidth={1.2} />
            {onSale && (
              <span className="absolute right-6 top-6 rounded-full bg-[var(--lum-accent)] px-3 py-1 text-sm font-bold text-[var(--lum-ink)]">
                −{Math.round((1 - product.solde! / product.ppv) * 100)} %
              </span>
            )}
          </div>

          <div className="flex flex-col gap-5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-[var(--lum-primary)]/12 px-2.5 py-0.5 text-[11px] font-semibold text-[var(--lum-primary)]">
                {product.sobrusCategory}
              </span>
              {category && (
                <span className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold" style={{ background: `${category.color}22`, color: category.color }}>
                  {category.name}
                </span>
              )}
              <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${stockTone}`}>
                {stockLabel}
              </span>
            </div>
            <h1 className="font-[family-name:var(--lum-font-display)] text-4xl font-semibold text-[var(--lum-ink)] sm:text-5xl">
              {product.name}
            </h1>
            <p className="text-sm text-[var(--lum-ink-soft)]">
              Par <span className="font-medium text-[var(--lum-ink)]">{product.laboratoire}</span>
            </p>
            <p className="text-lg leading-relaxed text-[var(--lum-ink)]/85">
              {product.description}
            </p>

            <div className="mt-2 flex items-baseline gap-3">
              <span className="font-[family-name:var(--lum-font-mono)] text-4xl font-semibold text-[var(--lum-primary)]">
                {price} MAD
              </span>
              {onSale && (
                <span className="font-[family-name:var(--lum-font-mono)] text-lg text-[var(--lum-ink-soft)] line-through">
                  {product.ppv} MAD
                </span>
              )}
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-3">
              <a
                href={whatsappOrderLink(pharmacyPhone, product.name)}
                target="_blank" rel="noopener"
                className="lum-cta"
              >
                <MessageCircle className="size-4" />
                Commander sur WhatsApp
              </a>
              <a href={`tel:${pharmacyPhone}`} className="text-sm font-semibold text-[var(--lum-ink)] underline-offset-4 hover:underline">
                Nous appeler au {pharmacyPhone}
              </a>
            </div>
          </div>
        </motion.article>

        {/* Related */}
        <section className="mt-16 flex flex-col gap-6">
          <h2 className="font-[family-name:var(--lum-font-display)] text-2xl font-semibold text-[var(--lum-ink)]">
            Produits de la même catégorie
          </h2>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {related.map((p) => (
              <a
                key={p.id}
                href={`#produit-${p.id}`}
                className="flex flex-col gap-2 rounded-3xl bg-white/85 p-5 shadow-[0_20px_50px_-30px_rgba(0,0,0,.15)] ring-1 ring-black/[.04] backdrop-blur transition-transform hover:-translate-y-1"
              >
                <div className="grid h-24 place-items-center rounded-2xl bg-gradient-to-br from-[var(--lum-primary)]/10 to-[var(--lum-secondary)]/25">
                  <Sparkles className="size-8 text-[var(--lum-ink)]/60" strokeWidth={1.5} />
                </div>
                <span className="font-semibold text-[var(--lum-ink)]">{p.name}</span>
                <span className="font-[family-name:var(--lum-font-mono)] text-sm text-[var(--lum-primary)]">
                  {p.solde ?? p.ppv} MAD
                </span>
              </a>
            ))}
          </div>
        </section>
      </div>
    </LumiereShell>
  );
}
