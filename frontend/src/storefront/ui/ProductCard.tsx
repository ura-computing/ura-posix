/** A product of the pharmacy: photo (or a pill icon), name, laboratoire, « En stock » / « Rupture », price, and
 *  « Commander » (WhatsApp). The card opens the product page. */
import { useState } from "react";
import { motion } from "framer-motion";
import { MessageCircle, Pill } from "lucide-react";

import type { StoreProduct } from "@/types/storeWebsite";

import type { StoreHref } from "../templates/_shared/customizationTypes";
import { fadeUpVariants } from "../templates/_shared/motion";
import { orderText, price, whatsappLink } from "../templates/_shared/storefront";

/** The whole picture always shows (`object-contain` on white, like a shop photo): never cut. A photo that no longer
 *  loads: the pill icon instead. */
export function ProductPhoto({ product, className }: { product: StoreProduct; className: string }) {
  const [broken, setBroken] = useState(false);
  return (
    <div className={`relative overflow-hidden rounded-[var(--sf-radius)] bg-white ${className}`}>
      {product.photo && !broken ? (
        <img
          src={product.photo}
          alt={product.name}
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setBroken(true)}
          className="absolute inset-0 size-full object-contain p-4"
        />
      ) : (
        <span className="absolute inset-0 grid place-items-center bg-[color-mix(in_oklab,var(--sf-primary),white_90%)]">
          <Pill className="size-12 text-[var(--sf-primary)]/60" strokeWidth={1.5} aria-hidden />
        </span>
      )}
    </div>
  );
}

const PRICE_SIZE = { sm: "text-lg", md: "text-2xl", lg: "text-4xl" } as const;

/** The owner's promo with the normal price struck out, else the PPV. */
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
    <span className="flex flex-wrap items-baseline gap-2">
      <span className={`${PRICE_SIZE[size]} font-bold text-[var(--sf-primary)]`}>{price(promo ?? ppv)}</span>
      {promo != null && ppv != null && promo < ppv && (
        <span className="text-sm text-[var(--sf-ink-soft)] line-through">{price(ppv)}</span>
      )}
    </span>
  );
}

export function StockPill({ inStock }: { inStock: boolean }) {
  return (
    <span
      className={`w-fit shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
        inStock ? "bg-emerald-500/15 text-emerald-600" : "bg-rose-500/15 text-rose-600"
      }`}
    >
      {inStock ? "En stock" : "Rupture"}
    </span>
  );
}

/** « −20 % » on a promo photo. */
function PromoBadge({ ppv, promo }: { ppv: number | null; promo: number | null }) {
  if (promo == null || ppv == null || promo >= ppv) return null;
  return (
    <span className="absolute left-3 top-3 z-[1] rounded-full bg-[var(--sf-primary)] px-2.5 py-1 text-[11px] font-bold text-[var(--sf-on-primary)]">
      −{Math.round((1 - promo / ppv) * 100)} %
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
      className="sf-card flex flex-col gap-3 rounded-[var(--sf-radius)] border border-[var(--sf-line)] bg-[var(--sf-surface)] p-3 shadow-[var(--sf-shadow)]"
    >
      <a href={href("produit", { product: product.id })} className="relative flex flex-col gap-3">
        <PromoBadge ppv={product.ppv} promo={product.promo_price} />
        <ProductPhoto product={product} className="h-48" />
        <div className="flex flex-col gap-1 px-1">
          {product.laboratoire && (
            <span className="truncate text-[11px] font-semibold uppercase tracking-wide text-[var(--sf-ink-soft)]">
              {product.laboratoire}
            </span>
          )}
          <span className="line-clamp-2 font-semibold leading-snug">{product.name}</span>
        </div>
      </a>
      <div className="mt-auto flex flex-col gap-3 px-1 pb-1">
        <div className="flex items-center justify-between gap-2">
          <Price ppv={product.ppv} promo={product.promo_price} />
          <StockPill inStock={product.in_stock} />
        </div>
        <a
          href={whatsappLink(pharmacyPhone, orderText(product.name))}
          target="_blank"
          rel="noopener noreferrer"
          className="sf-cta !py-2.5 text-[13px]"
        >
          <MessageCircle className="size-4" aria-hidden />
          Commander
        </a>
      </div>
    </motion.article>
  );
}
