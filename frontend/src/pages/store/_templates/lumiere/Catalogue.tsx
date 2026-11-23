/** Lumière — « Nos produits »: the pharmacy's shelf, in stock first. Category chips, a search, pages of 24; every
 *  filter is a link (`href`), so the page works without JavaScript state and the back button works too. */

import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";

import type { TemplateProps } from "../_shared/customizationTypes";
import { staggerContainer } from "../_shared/motion";

import { ProductCard } from "./ProductCard";
import { LumiereShell } from "./Shell";
import { LumiereStyles } from "./styles";

const CHIP =
  "shrink-0 rounded-full border px-4 py-1.5 text-sm font-medium backdrop-blur transition border-black/[.08] bg-white/70 text-[var(--lum-ink-soft)] aria-[current=true]:border-[var(--lum-primary)] aria-[current=true]:bg-[var(--lum-primary)] aria-[current=true]:text-white";

export function LumiereCatalogue(props: TemplateProps) {
  const { store, href, pharmacyPhone } = props;
  const { category, search, products } = store;
  const categories = store.summary?.categories ?? [];
  const pagination = products?.pagination;
  const page = pagination?.page ?? 1;

  return (
    <LumiereShell props={props}>
      <LumiereStyles />
      <div className="mx-auto max-w-[1200px] px-5 py-10 sm:px-8 sm:py-14">
        <header className="mb-8 flex flex-col gap-3">
          <span className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--lum-primary)]">
            Nos produits
          </span>
          <h1 className="font-[family-name:var(--lum-font-display)] text-4xl font-semibold text-[var(--lum-ink)] sm:text-5xl">
            {category ?? "Tout notre rayon"}
          </h1>
          {pagination && (
            <p className="text-[var(--lum-ink-soft)]">
              {pagination.total} produit{pagination.total > 1 ? "s" : ""} · commandez sur WhatsApp
            </p>
          )}
        </header>

        <form action={href("catalogue")} method="get" className="mb-5 flex max-w-xl items-center gap-2">
          {/* The form keeps the page's own params (request id, category) in the URL it opens. */}
          {[...new URL(href("catalogue", { category }), "http://x").searchParams].map(([k, v]) => (
            <input key={k} type="hidden" name={k} value={v} />
          ))}
          <label className="flex flex-1 items-center gap-2 rounded-full border border-black/[.08] bg-white/80 px-4 py-2.5 backdrop-blur">
            <Search className="size-4 text-[var(--lum-ink-soft)]" aria-hidden />
            <input
              name="search"
              defaultValue={search}
              placeholder="Rechercher un produit, une marque…"
              className="w-full bg-transparent text-sm text-[var(--lum-ink)] outline-none"
            />
          </label>
          <button type="submit" className="lum-cta text-[13px]">
            Rechercher
          </button>
        </form>

        <nav className="mb-8 flex gap-2 overflow-x-auto pb-2 sm:flex-wrap sm:overflow-visible">
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
            className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4"
            variants={staggerContainer}
            initial="hidden"
            animate="show"
          >
            {products.items.map((p) => (
              <ProductCard key={p.id} product={p} href={href} pharmacyPhone={pharmacyPhone} />
            ))}
          </motion.div>
        ) : (
          <div className="rounded-3xl border border-dashed border-black/[.1] bg-white/50 p-16 text-center text-sm text-[var(--lum-ink-soft)] backdrop-blur">
            Aucun produit ne correspond. Écrivez-nous sur WhatsApp : nous vous dirons s'il est disponible.
          </div>
        )}

        {pagination && pagination.total_pages > 1 && (
          <nav className="mt-10 flex items-center justify-center gap-4 text-sm font-semibold text-[var(--lum-ink)]">
            {page > 1 && (
              <a
                href={href("catalogue", { category, search, page: page - 1 })}
                className="inline-flex items-center gap-1"
              >
                <ChevronLeft className="size-4" aria-hidden />
                Précédent
              </a>
            )}
            <span className="font-[family-name:var(--lum-font-mono)] text-[var(--lum-ink-soft)]">
              {page} / {pagination.total_pages}
            </span>
            {page < pagination.total_pages && (
              <a
                href={href("catalogue", { category, search, page: page + 1 })}
                className="inline-flex items-center gap-1"
              >
                Suivant
                <ChevronRight className="size-4" aria-hidden />
              </a>
            )}
          </nav>
        )}
      </div>
    </LumiereShell>
  );
}
