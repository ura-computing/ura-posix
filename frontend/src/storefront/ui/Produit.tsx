/** One product of the pharmacy: photo, laboratoire, category, « En stock » / « Rupture », price, its description when
 *  known, « Commander sur WhatsApp » + « Appeler », then others of its category. */
import { motion } from "framer-motion";
import { ChevronRight, MessageCircle, Phone } from "lucide-react";

import { blurUpVariants, staggerContainer, viewportOnce } from "../templates/_shared/motion";
import { orderText, whatsappLink } from "../templates/_shared/storefront";
import type { PageProps } from "./model";
import { Price, ProductCard, ProductPhoto, StockPill } from "./ProductCard";
import { Shell } from "./Shell";

export function StoreProduit(props: PageProps) {
  const { store, href, pharmacyPhone } = props;
  const { product } = store;

  return (
    <Shell props={props}>
      <div className="mx-auto max-w-[1200px] px-5 py-10 sm:px-8 sm:py-14">
        {!product ? (
          <div className="rounded-[var(--sf-radius)] border border-dashed border-[var(--sf-line)] p-16 text-center text-sm text-[var(--sf-ink-soft)]">
            Ce produit n'est plus affiché.{" "}
            <a href={href("catalogue")} className="font-semibold underline">
              Voir nos produits
            </a>
          </div>
        ) : (
          <>
            <nav className="mb-8 flex items-center gap-2 text-sm text-[var(--sf-ink-soft)]">
              <a href={href("catalogue")} className="hover:text-[var(--sf-primary)]">
                Nos produits
              </a>
              {product.category && (
                <>
                  <ChevronRight aria-hidden className="size-3.5" />
                  <a
                    href={href("catalogue", { category: product.category })}
                    className="hover:text-[var(--sf-primary)]"
                  >
                    {product.category}
                  </a>
                </>
              )}
            </nav>

            <motion.article
              className="grid gap-10 md:grid-cols-2"
              initial="hidden"
              animate="show"
              variants={blurUpVariants}
            >
              <ProductPhoto product={product} className="h-80 border border-[var(--sf-line)] md:h-[480px]" />
              <div className="flex flex-col gap-5">
                <StockPill inStock={product.in_stock} />
                <h1 className="font-[family-name:var(--sf-font-display)] text-3xl font-semibold leading-tight sm:text-4xl">
                  {product.name}
                </h1>
                {product.laboratoire && (
                  <p className="text-sm text-[var(--sf-ink-soft)]">
                    Par <span className="font-semibold text-[var(--sf-ink)]">{product.laboratoire}</span>
                  </p>
                )}
                {product.description && (
                  <p className="whitespace-pre-line leading-relaxed text-[var(--sf-ink)]/85">{product.description}</p>
                )}
                <div className="border-y border-[var(--sf-line)] py-5">
                  <Price ppv={product.ppv} promo={product.promo_price} size="lg" />
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <a
                    href={whatsappLink(pharmacyPhone, orderText(product.name))}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="sf-cta"
                  >
                    <MessageCircle className="size-4" aria-hidden />
                    Commander sur WhatsApp
                  </a>
                  <a href={`tel:${pharmacyPhone}`} className="sf-ghost">
                    <Phone className="size-4" aria-hidden />
                    {pharmacyPhone}
                  </a>
                </div>
              </div>
            </motion.article>

            {product.related.length > 0 && (
              <section className="mt-20 flex flex-col gap-8">
                <h2 className="font-[family-name:var(--sf-font-display)] text-2xl font-semibold sm:text-3xl">
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
    </Shell>
  );
}
