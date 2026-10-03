/** Lumière — Catalogue page. Sidebar categories + product grid with
 *  Framer-Motion layout animations on filter change. Not customizable
 *  (only colors/typography respond to customization).
 *
 *  Mobile: sidebar becomes a horizontal chip row + a bottom sheet. */

import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Flower2 } from "lucide-react";

import { MOCK_STORE_PRODUCTS, whatsappOrderLink } from "../_shared/mockStore";
import type { TemplateProps } from "../_shared/customizationTypes";

import { LumiereShell } from "./Shell";
import { LumiereStyles } from "./styles";

export function LumiereCatalogue(props: TemplateProps) {
  const { customization, categories, pharmacyPhone } = props;
  const [activeCat, setActiveCat] = useState<string | null>(null);

  const products = useMemo(() => {
    if (!activeCat) return MOCK_STORE_PRODUCTS;
    return MOCK_STORE_PRODUCTS.filter((p) => (p.storeCategoryId ?? "cat-default") === activeCat);
  }, [activeCat]);

  const chips = [{ id: null, name: "Tout" }, ...categories.map((c) => ({ id: c.id, name: c.name }))];

  return (
    <LumiereShell customization={customization} pharmacyPhone={pharmacyPhone} logoUrl={customization.logoUrl}>
      <LumiereStyles />
      <div className="mx-auto max-w-[1200px] px-5 py-10 sm:px-8 sm:py-14">
        <header className="mb-8 flex flex-col gap-3">
          <span className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--lum-primary)]">Catalogue</span>
          <h1 className="font-[family-name:var(--lum-font-display)] text-4xl font-semibold text-[var(--lum-ink)] sm:text-5xl">
            Chaque produit, choisi avec soin
          </h1>
          <p className="max-w-2xl text-lg text-[var(--lum-ink-soft)]">
            Notre sélection couvre l'essentiel du quotidien, du bien-être aux soins bébé.
          </p>
        </header>

        {/* Category chips — desktop sidebar, mobile scroll row */}
        <div className="mb-8 flex gap-2 overflow-x-auto pb-2 sm:flex-wrap sm:overflow-visible">
          {chips.map((c) => {
            const on = activeCat === c.id;
            return (
              <button
                key={String(c.id)}
                onClick={() => setActiveCat(c.id)}
                data-on={on}
                className="shrink-0 rounded-full border border-black/[.08] bg-white/70 px-4 py-1.5 text-sm font-medium text-[var(--lum-ink-soft)] backdrop-blur transition data-[on=true]:border-[var(--lum-primary)] data-[on=true]:bg-[var(--lum-primary)] data-[on=true]:text-white"
              >
                {c.name}
              </button>
            );
          })}
        </div>

        <motion.div layout className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          <AnimatePresence mode="popLayout">
            {products.map((p) => {
              const stockLabel = p.stock === 0 ? "Rupture" : p.stock <= 5 ? "Stock limité" : "En stock";
              const stockTone =
                p.stock === 0
                  ? "text-rose-600 bg-rose-500/10"
                  : p.stock <= 5
                    ? "text-amber-600 bg-amber-500/10"
                    : "text-emerald-600 bg-emerald-500/10";
              const onSale = p.solde != null;
              const price = p.solde ?? p.ppv;
              return (
                <motion.article
                  key={p.id}
                  layout
                  initial={{ opacity: 0, y: 24, filter: "blur(8px)" }}
                  animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                  exit={{ opacity: 0, y: -12, filter: "blur(4px)" }}
                  transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                  className="flex flex-col gap-3 rounded-3xl bg-white/85 p-5 shadow-[0_20px_50px_-30px_rgba(0,0,0,.2)] ring-1 ring-black/[.04] backdrop-blur"
                >
                  <div className="relative grid h-36 place-items-center overflow-hidden rounded-2xl bg-gradient-to-br from-[var(--lum-secondary)]/40 to-[var(--lum-primary)]/10">
                    <Flower2 className="size-14 text-[var(--lum-ink)]/60" strokeWidth={1.5} />
                    {onSale && (
                      <span className="absolute right-3 top-3 rounded-full bg-[var(--lum-accent)] px-2.5 py-0.5 text-[11px] font-bold text-[var(--lum-ink)]">
                        −{Math.round((1 - p.solde! / p.ppv) * 100)} %
                      </span>
                    )}
                  </div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex flex-col">
                      <span className="font-semibold text-[var(--lum-ink)]">{p.name}</span>
                      <span className="text-[11px] text-[var(--lum-ink-soft)]">{p.laboratoire}</span>
                    </div>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${stockTone}`}>
                      {stockLabel}
                    </span>
                  </div>
                  <p className="text-sm text-[var(--lum-ink-soft)] line-clamp-2">{p.description}</p>
                  <div className="mt-auto flex items-baseline justify-between">
                    <div className="flex items-baseline gap-2">
                      <span className="font-[family-name:var(--lum-font-mono)] text-lg font-semibold text-[var(--lum-primary)]">
                        {price} MAD
                      </span>
                      {onSale && (
                        <span className="font-[family-name:var(--lum-font-mono)] text-xs text-[var(--lum-ink-soft)] line-through">
                          {p.ppv} MAD
                        </span>
                      )}
                    </div>
                    <a
                      href={whatsappOrderLink(pharmacyPhone, p.name)}
                      target="_blank"
                      rel="noopener"
                      className="rounded-full bg-[var(--lum-primary)] px-3 py-1.5 text-[11px] font-semibold text-white transition hover:scale-105"
                    >
                      Commander
                    </a>
                  </div>
                </motion.article>
              );
            })}
          </AnimatePresence>
        </motion.div>

        {products.length === 0 && (
          <div className="rounded-3xl border border-dashed border-black/[.1] bg-white/50 p-16 text-center text-sm text-[var(--lum-ink-soft)] backdrop-blur">
            Aucun produit dans cette catégorie pour l'instant.
          </div>
        )}
      </div>
    </LumiereShell>
  );
}
