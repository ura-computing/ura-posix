/** Home page of every model: the sections in the editor's order (`layout.y`), each hidden by its switch, filled ONLY
 *  with the pharmacy's own data (`store.summary`). The top is the model's own `Hero`; the rest is shared. A section
 *  with no data is left out. Every other section sits on the model's tint (`--sf-tint`). */
import { useMemo, type ReactNode } from "react";
import { motion } from "framer-motion";
import { ArrowRight, MapPin, MessageCircle, Phone } from "lucide-react";

import type { StoreProduct } from "@/types/storeWebsite";

import type { SectionConfig } from "../templates/_shared/customizationTypes";
import { blurUpVariants, fadeUpVariants, staggerContainer, viewportOnce } from "../templates/_shared/motion";
import { contactText, orderText, whatsappLink } from "../templates/_shared/storefront";
import type { PageProps, SectionProps } from "./model";
import { Price, ProductCard, ProductPhoto } from "./ProductCard";
import { Shell } from "./Shell";

export function StoreHome(props: PageProps) {
  const { customization, model, store } = props;
  const { Hero } = model;
  const { summary } = store;
  const sections = useMemo(() => {
    // A section without the pharmacy's data is left out (no empty band).
    const empty: Partial<Record<SectionConfig["key"], boolean>> = {
      brands: !summary?.brands.length,
      catalogue: !summary?.categories.length,
      soldes: !summary?.promos.length,
      packs: !summary?.packs.length,
      featured_categories: !summary?.featured.length,
      footer: true,
    };
    return [...customization.sections]
      .sort((a, b) => a.layout.y - b.layout.y)
      .filter((s) => s.visible && !empty[s.key]);
  }, [customization.sections, summary]);

  return (
    <Shell props={props}>
      {sections.map((s, i) =>
        s.key === "hero" ? (
          <Hero key={s.key} section={s} {...props} />
        ) : (
          <section key={s.key} className={i % 2 === 1 ? "bg-[var(--sf-tint)]" : ""}>
            <motion.div
              className="mx-auto max-w-[1200px] px-5 py-16 sm:px-8 md:py-20"
              initial="hidden"
              whileInView="show"
              viewport={viewportOnce}
              variants={blurUpVariants}
            >
              {s.key === "brands" && <Brands section={s} {...props} />}
              {s.key === "catalogue" && <Categories section={s} {...props} />}
              {s.key === "soldes" && <Products section={s} {...props} products={summary?.promos ?? []} />}
              {s.key === "packs" && <Packs section={s} {...props} />}
              {s.key === "featured_categories" && (
                <Products section={s} {...props} products={summary?.featured.slice(0, 8) ?? []} all />
              )}
              {s.key === "contact" && <ContactBand section={s} {...props} />}
            </motion.div>
          </section>
        ),
      )}
    </Shell>
  );
}

/** A section's title: a small line in the main color, the title, its sub-title. */
export function SectionHeader({
  section,
  eyebrow,
  center,
  children,
}: {
  section: SectionConfig;
  eyebrow?: string;
  center?: boolean;
  children?: ReactNode;
}) {
  return (
    <header className={`mb-10 flex flex-wrap items-end justify-between gap-4 ${center ? "justify-center" : ""}`}>
      <div className={`flex flex-col gap-3 ${center ? "items-center text-center" : ""}`}>
        {eyebrow && (
          <span className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--sf-primary)]">{eyebrow}</span>
        )}
        <h2 className="font-[family-name:var(--sf-font-display)] text-3xl font-semibold leading-tight sm:text-4xl">
          {section.content.title}
        </h2>
        {section.content.sub && <p className="max-w-xl text-[var(--sf-ink-soft)]">{section.content.sub}</p>}
      </div>
      {children}
    </header>
  );
}

const STAGGER = { variants: staggerContainer, initial: "hidden", whileInView: "show", viewport: viewportOnce } as const;

/** The laboratoires, scrolling slowly (twice in a row, so the loop has no gap). */
function Brands({ section, store }: SectionProps) {
  const brands = store.summary?.brands ?? [];
  return (
    <div className="flex flex-col gap-6">
      <h2 className="text-center text-xs font-bold uppercase tracking-[0.25em] text-[var(--sf-ink-soft)]">
        {section.content.title}
      </h2>
      <div className="overflow-hidden [mask-image:linear-gradient(90deg,transparent,#000_12%,#000_88%,transparent)]">
        <div className="sf-marquee flex w-max gap-14">
          {[...brands, ...brands].map((b, i) => (
            <span
              key={i}
              aria-hidden={i >= brands.length}
              className="whitespace-nowrap font-[family-name:var(--sf-font-display)] text-2xl font-semibold text-[var(--sf-ink)]/60"
            >
              {b}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function Categories({ section, store, href }: SectionProps) {
  const categories = (store.summary?.categories ?? []).slice(0, 8);
  return (
    <>
      <SectionHeader section={section} eyebrow="Nos rayons" center />
      <motion.div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4" {...STAGGER}>
        {categories.map((c) => (
          <motion.a
            key={c.name}
            href={href("catalogue", { category: c.name })}
            variants={fadeUpVariants}
            className="sf-card group flex flex-col items-center gap-3 rounded-[var(--sf-radius)] border border-[var(--sf-line)] bg-[var(--sf-surface)] p-6 text-center shadow-[var(--sf-shadow)]"
          >
            <span className="grid size-16 place-items-center rounded-full bg-[var(--sf-primary)]/12 font-[family-name:var(--sf-font-display)] text-2xl font-bold text-[var(--sf-primary)] transition group-hover:bg-[var(--sf-primary)] group-hover:text-[var(--sf-on-primary)]">
              {c.name.charAt(0).toUpperCase()}
            </span>
            <span className="font-semibold">{c.name}</span>
            <span className="text-xs text-[var(--sf-ink-soft)]">{c.count} produits</span>
          </motion.a>
        ))}
      </motion.div>
    </>
  );
}

/** « Nos promotions » and « Disponibles en pharmacie »: a grid of product cards. */
function Products({
  section,
  href,
  pharmacyPhone,
  products,
  all,
}: SectionProps & { products: StoreProduct[]; all?: boolean }) {
  return (
    <>
      <SectionHeader section={section}>
        {all && (
          <a
            href={href("catalogue")}
            className="inline-flex items-center gap-2 text-sm font-bold text-[var(--sf-primary)] hover:gap-3"
            style={{ transition: "gap .25s" }}
          >
            Tous nos produits
            <ArrowRight className="size-4" aria-hidden />
          </a>
        )}
      </SectionHeader>
      <motion.div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4" {...STAGGER}>
        {products.map((p) => (
          <ProductCard key={p.id} product={p} href={href} pharmacyPhone={pharmacyPhone} />
        ))}
      </motion.div>
    </>
  );
}

function Packs({ section, store, pharmacyPhone }: SectionProps) {
  const packs = store.summary?.packs ?? [];
  return (
    <>
      <SectionHeader section={section} />
      <motion.div className="grid grid-cols-1 gap-5 md:grid-cols-2" {...STAGGER}>
        {packs.map((pack) => (
          <motion.article
            key={pack.id}
            variants={fadeUpVariants}
            className="sf-card flex flex-col gap-5 rounded-[var(--sf-radius)] border border-[var(--sf-line)] bg-[var(--sf-surface)] p-6 shadow-[var(--sf-shadow)]"
          >
            <div className="flex items-start justify-between gap-3">
              <h3 className="font-[family-name:var(--sf-font-display)] text-2xl font-semibold">{pack.name}</h3>
              <Price ppv={pack.ppv_total} promo={pack.price} size="md" />
            </div>
            <ul className="grid grid-cols-3 gap-3">
              {pack.items.map((i) => (
                <li key={i.product.id} className="flex flex-col gap-1.5">
                  <ProductPhoto product={i.product} className="h-24 border border-[var(--sf-line)]" />
                  <span className="line-clamp-2 text-xs leading-snug text-[var(--sf-ink-soft)]">
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
              className="sf-cta w-fit"
            >
              <MessageCircle className="size-4" aria-hidden />
              Commander le pack
            </a>
          </motion.article>
        ))}
      </motion.div>
    </>
  );
}

/** « Nous trouver »: the model's photo under the main color, the address, WhatsApp and « Appeler ». */
function ContactBand({ section, store, pharmacyPhone, model }: SectionProps) {
  const address = [store.summary?.address, store.summary?.city].filter(Boolean).join(", ");
  return (
    <div className="relative isolate overflow-hidden rounded-[var(--sf-radius)] px-8 py-14 text-white md:px-14">
      <img src={model.photo} alt="" loading="lazy" className="sf-zoom absolute inset-0 -z-20 size-full object-cover" />
      <div className="absolute inset-0 -z-10 bg-[color-mix(in_oklab,var(--sf-primary),black_45%)]/85" />
      <div className="grid gap-8 md:grid-cols-[1fr_auto] md:items-center">
        <div className="flex flex-col gap-3">
          <h2 className="font-[family-name:var(--sf-font-display)] text-3xl font-semibold sm:text-4xl">
            {section.content.title}
          </h2>
          <p className="max-w-xl text-white/85">{section.content.sub}</p>
          <div className="mt-2 flex flex-col gap-2 text-sm">
            {address && (
              <span className="inline-flex items-center gap-2">
                <MapPin className="size-4" aria-hidden />
                {address}
              </span>
            )}
            <span className="inline-flex items-center gap-2">
              <Phone className="size-4" aria-hidden />
              {pharmacyPhone}
            </span>
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          <a
            href={whatsappLink(pharmacyPhone, contactText)}
            target="_blank"
            rel="noopener noreferrer"
            className="sf-cta !bg-white !text-neutral-900"
          >
            <MessageCircle className="size-4" aria-hidden />
            WhatsApp
          </a>
          <a href={`tel:${pharmacyPhone}`} className="sf-ghost">
            <Phone className="size-4" aria-hidden />
            Appeler
          </a>
        </div>
      </div>
    </div>
  );
}
