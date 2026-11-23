/** Lumière — one product of the pharmacy: photo, laboratoire, category, « En stock » / « Rupture », price, its
 *  description when known, « Commander sur WhatsApp » + « Appeler », then others of its category. */

import { motion } from "framer-motion";
import { ChevronRight, MessageCircle, Phone } from "lucide-react";

import type { TemplateProps } from "../_shared/customizationTypes";
import { blurUpVariants, staggerContainer, viewportOnce } from "../_shared/motion";
import { orderText, whatsappLink } from "../_shared/storefront";

import { Price, ProductCard, ProductPhoto, StockPill } from "./ProductCard";
import { LumiereShell } from "./Shell";
import { LumiereStyles } from "./styles";

export function LumiereProduit(props: TemplateProps) {
  const { store, href, pharmacyPhone } = props;
  const product = store.product;

  return (
    <LumiereShell props={props}>
      <LumiereStyles />
      <div className="mx-auto max-w-[1200px] px-5 py-10 sm:px-8 sm:py-14">
        {!product ? (
          <div className="rounded-3xl border border-dashed border-black/[.1] bg-white/50 p-16 text-center text-sm text-[var(--lum-ink-soft)]">
            Ce produit n'est plus affiché.{" "}
            <a href={href("catalogue")} className="font-semibold underline">
              Voir nos produits
            </a>
          </div>
        ) : (
          <>
            <nav className="mb-6 flex items-center gap-2 text-sm text-[var(--lum-ink-soft)]">
              <a href={href("catalogue")} className="hover:text-[var(--lum-ink)]">
                Nos produits
              </a>
              {product.category && (
                <>
                  <ChevronRight aria-hidden className="size-3.5" />
                  <a href={href("catalogue", { category: product.category })} className="hover:text-[var(--lum-ink)]">
                    {product.category}
                  </a>
                </>
              )}
            </nav>

            <motion.article
              className="grid gap-10 md:grid-cols-[1fr_1fr]"
              initial="hidden"
              animate="show"
              variants={blurUpVariants}
            >
              <ProductPhoto product={product} className="h-80 rounded-[36px] md:h-[480px]" />
              <div className="flex flex-col gap-5">
                <StockPill inStock={product.in_stock} />
                <h1 className="font-[family-name:var(--lum-font-display)] text-3xl font-semibold text-[var(--lum-ink)] sm:text-4xl">
                  {product.name}
                </h1>
                {product.laboratoire && (
                  <p className="text-sm text-[var(--lum-ink-soft)]">
                    Par <span className="font-medium text-[var(--lum-ink)]">{product.laboratoire}</span>
                  </p>
                )}
                {product.description && (
                  <p className="whitespace-pre-line text-base leading-relaxed text-[var(--lum-ink)]/85">
                    {product.description}
                  </p>
                )}
                <Price ppv={product.ppv} promo={product.promo_price} size="lg" />
                <div className="flex flex-wrap items-center gap-3">
                  <a
                    href={whatsappLink(pharmacyPhone, orderText(product.name))}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="lum-cta"
                  >
                    <MessageCircle className="size-4" aria-hidden />
                    Commander sur WhatsApp
                  </a>
                  <a
                    href={`tel:${pharmacyPhone}`}
                    className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--lum-ink)] underline-offset-4 hover:underline"
                  >
                    <Phone className="size-4" aria-hidden />
                    {pharmacyPhone}
                  </a>
                </div>
              </div>
            </motion.article>

            {product.related.length > 0 && (
              <section className="mt-16 flex flex-col gap-6">
                <h2 className="font-[family-name:var(--lum-font-display)] text-2xl font-semibold text-[var(--lum-ink)]">
                  Dans le même rayon
                </h2>
                <motion.div
                  className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4"
                  variants={staggerContainer}
                  initial="hidden"
                  whileInView="show"
                  viewport={viewportOnce}
                >
                  {product.related.map((p) => (
                    <ProductCard key={p.id} product={p} href={href} pharmacyPhone={pharmacyPhone} />
                  ))}
                </motion.div>
              </section>
            )}
          </>
        )}
      </div>
    </LumiereShell>
  );
}
