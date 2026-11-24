/** « Nos produits »: the pharmacy's shelf, in stock first. A search, category chips, pages of 24; every filter is a
 *  link (`href`), so the page works without JavaScript state and the back button works too. */
import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";

import { staggerContainer } from "../templates/_shared/motion";
import type { PageProps } from "./model";
import { ProductCard } from "./ProductCard";
import { PageTitle, Shell } from "./Shell";

const CHIP =
  "shrink-0 rounded-full border border-[var(--sf-line)] bg-[var(--sf-surface)] px-4 py-2 text-sm font-semibold text-[var(--sf-ink-soft)] transition hover:border-[var(--sf-primary)] hover:text-[var(--sf-ink)] aria-[current=true]:border-[var(--sf-primary)] aria-[current=true]:bg-[var(--sf-primary)] aria-[current=true]:text-[var(--sf-on-primary)]";

export function StoreCatalogue(props: PageProps) {
  const { store, href, pharmacyPhone } = props;
  const { category, search, products } = store;
  const categories = store.summary?.categories ?? [];
  const pagination = products?.pagination;
  const page = pagination?.page ?? 1;

  return (
    <Shell props={props}>
      <PageTitle
        eyebrow="Nos produits"
        title={category ?? "Tout notre rayon"}
        sub={pagination && `${pagination.total} produit${pagination.total > 1 ? "s" : ""} · commandez sur WhatsApp`}
      />
      <div className="mx-auto max-w-[1200px] px-5 py-10 sm:px-8 sm:py-14">
        <form action={href("catalogue")} method="get" className="mb-6 flex max-w-xl items-center gap-2">
          {/* The form keeps the page's own params (request id, category) in the URL it opens. */}
          {[...new URL(href("catalogue", { category }), "http://x").searchParams].map(([k, v]) => (
            <input key={k} type="hidden" name={k} value={v} />
          ))}
          <label className="flex flex-1 items-center gap-2 rounded-[var(--sf-button-radius)] border border-[var(--sf-line)] bg-[var(--sf-surface)] px-4 py-3 focus-within:border-[var(--sf-primary)]">
            <Search className="size-4 text-[var(--sf-ink-soft)]" aria-hidden />
            <input
              name="search"
              defaultValue={search}
              placeholder="Rechercher un produit, une marque…"
              className="w-full bg-transparent text-sm outline-none placeholder:text-[var(--sf-ink-soft)]"
            />
          </label>
          <button type="submit" className="sf-cta text-[13px]">
            Rechercher
          </button>
        </form>

        <nav className="mb-10 flex gap-2 overflow-x-auto pb-2 sm:flex-wrap sm:overflow-visible">
          <a href={href("catalogue", { search })} aria-current={!category} className={CHIP}>
            Tout
          </a>
          {categories.map((c) => (
            <a
              key={c.name}
              href={href("catalogue", { category: c.name, search })}
              aria-current={category === c.name}
              className={CHIP}
            >
              {c.name}
            </a>
          ))}
        </nav>

        {products && products.items.length > 0 ? (
          <motion.div
            key={`${category}|${search}|${page}`}
            className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4"
            variants={staggerContainer}
            initial="hidden"
            animate="show"
          >
            {products.items.map((p) => (
              <ProductCard key={p.id} product={p} href={href} pharmacyPhone={pharmacyPhone} />
            ))}
          </motion.div>
        ) : (
          <div className="rounded-[var(--sf-radius)] border border-dashed border-[var(--sf-line)] p-16 text-center text-sm text-[var(--sf-ink-soft)]">
            Aucun produit ne correspond. Écrivez-nous sur WhatsApp : nous vous dirons s'il est disponible.
          </div>
        )}

        {pagination && pagination.total_pages > 1 && (
          <nav className="mt-12 flex items-center justify-center gap-3 text-sm font-semibold">
            {page > 1 && (
              <a href={href("catalogue", { category, search, page: page - 1 })} className="sf-ghost !py-2.5">
                <ChevronLeft className="size-4" aria-hidden />
                Précédent
              </a>
            )}
            <span className="px-3 text-[var(--sf-ink-soft)]">
              {page} / {pagination.total_pages}
            </span>
            {page < pagination.total_pages && (
              <a href={href("catalogue", { category, search, page: page + 1 })} className="sf-ghost !py-2.5">
                Suivant
                <ChevronRight className="size-4" aria-hidden />
              </a>
            )}
          </nav>
        )}
      </div>
    </Shell>
  );
}
