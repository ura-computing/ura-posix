/** Lumière's product card: photo (or a flower), name, laboratoire, « En stock » / « Rupture », price, and
 *  « Commander » (WhatsApp). The card opens the product page. */
import { Flower2, MessageCircle } from "lucide-react";
import { useState } from "react";
import { motion } from "framer-motion";

import type { StoreProduct } from "@/types/storeWebsite";

import type { StoreHref } from "../_shared/customizationTypes";
import { fadeUpVariants } from "../_shared/motion";
import { orderText, price, whatsappLink } from "../_shared/storefront";

/** The whole picture always shows (`object-contain` in a fixed frame, white like a shop photo): never cut. A photo
 *  that no longer loads: the flower instead. */
export function ProductPhoto({ product, className }: { product: StoreProduct; className: string }) {
  const [broken, setBroken] = useState(false);
  return (
    <div className={`relative overflow-hidden rounded-2xl bg-white ring-1 ring-black/[.04] ${className}`}>
      {product.photo && !broken ? (
        <img
          src={product.photo}
          alt={product.name}
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setBroken(true)}
          className="absolute inset-0 size-full object-contain p-3"
        />
      ) : (
        <span className="absolute inset-0 grid place-items-center">
          <Flower2 className="size-12 text-[var(--lum-primary)]/50" strokeWidth={1.5} aria-hidden />
        </span>
      )}
    </div>
  );
}

const PRICE_SIZE = { sm: "text-lg", md: "text-2xl", lg: "text-4xl" } as const;

/** The price: the owner's promo with the normal price struck out, else the PPV. */
export function Price({
  ppv,
  promo,
  size = "sm",
}: {
  ppv: number | null;
  promo: number | null;
  size?: keyof typeof PRICE_SIZE;
}) {
  return (
    <span className="flex flex-wrap items-baseline gap-2 font-[family-name:var(--lum-font-mono)]">
      <span className={`${PRICE_SIZE[size]} font-semibold text-[var(--lum-primary)]`}>{price(promo ?? ppv)}</span>
      {promo != null && ppv != null && promo < ppv && (
        <span className="text-sm text-[var(--lum-ink-soft)] line-through">{price(ppv)}</span>
      )}
    </span>
  );
}

export function StockPill({ inStock }: { inStock: boolean }) {
  return (
    <span
      className={`w-fit shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
        inStock ? "bg-emerald-500/10 text-emerald-700" : "bg-rose-500/10 text-rose-700"
      }`}
    >
      {inStock ? "En stock" : "Rupture"}
    </span>
  );
}

export function ProductCard({
  product,
  href,
  pharmacyPhone,
}: {
  product: StoreProduct;
  href: StoreHref;
  pharmacyPhone: string;
}) {
  return (
    <motion.article
      variants={fadeUpVariants}
      className="group flex flex-col gap-3 rounded-3xl bg-white/85 p-4 shadow-[0_20px_50px_-30px_rgba(0,0,0,.2)] ring-1 ring-black/[.04] backdrop-blur transition-transform duration-300 hover:-translate-y-1"
    >
      <a href={href("produit", { product: product.id })} className="flex flex-col gap-3">
        <ProductPhoto product={product} className="h-44" />
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 flex-col">
            <span className="line-clamp-2 font-semibold leading-snug text-[var(--lum-ink)]">{product.name}</span>
            {product.laboratoire && (
              <span className="truncate text-[11px] text-[var(--lum-ink-soft)]">{product.laboratoire}</span>
            )}
          </div>
          <StockPill inStock={product.in_stock} />
        </div>
      </a>
      <div className="mt-auto flex items-center justify-between gap-2">
        <Price ppv={product.ppv} promo={product.promo_price} />
        <a
          href={whatsappLink(pharmacyPhone, orderText(product.name))}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-full bg-[var(--lum-primary)] px-3 py-1.5 text-[11px] font-semibold text-white transition hover:scale-105"
        >
          <MessageCircle className="size-3.5" aria-hidden />
          Commander
        </a>
      </div>
    </motion.article>
  );
}
