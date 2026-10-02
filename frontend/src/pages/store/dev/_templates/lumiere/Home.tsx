/** Lumière — Home page.
 *
 *  Customizable: brand colors, typography, section grid (via
 *  react-grid-layout when editMode=true), section visibility, editable copy,
 *  featured categories.
 *
 *  Motion: blur-in reveals on scroll, ambient background blooms + drifting
 *  leaves, idle-bob on the hero card, magnetic-hover CTAs, 3D tilt on
 *  product cards (md+ only). Framer Motion for entrance; CSS keyframes for
 *  ambient loops (cheaper than framer for infinite bg motion).
 *
 *  Mobile-first responsive: single column on sm, 2-col on md, 3-col
 *  featured grid on lg. */

import { useMemo } from "react";
import { motion } from "framer-motion";
import {
  ArrowRight, ArrowUp, ArrowDown, Eye, EyeOff, Flower2, Leaf, MapPin, Sparkles,
} from "lucide-react";

import { MOCK_BRANDS, MOCK_STORE_PRODUCTS, MOCK_TESTIMONIALS, whatsappOrderLink } from "../_shared/mockStore";
import { blurUpVariants, fadeUpVariants, staggerContainer, viewportOnce } from "../_shared/motion";
import type { SectionConfig, SectionKey, TemplateProps } from "../_shared/customizationTypes";
import { SECTION_LABEL } from "../_shared/customizationTypes";

import { lumiereCssVars } from "./tokens";
import { LumiereShell } from "./Shell";
import { LumiereStyles } from "./styles";


export function LumiereHome(props: TemplateProps) {
  const { customization, editMode, onCustomizationChange, categories, pharmacyPhone } = props;

  const ordered = useMemo(
    () => [...customization.sections].sort((a, b) => a.layout.y - b.layout.y),
    [customization.sections],
  );
  const visibleSections = useMemo(
    () => (editMode ? ordered : ordered.filter((s) => s.visible)),
    [ordered, editMode],
  );

  const patchContent = (key: SectionKey, slot: string, val: string) => {
    if (!onCustomizationChange) return;
    onCustomizationChange({
      ...customization,
      sections: customization.sections.map((s) =>
        s.key === key ? { ...s, content: { ...s.content, [slot]: val } } : s,
      ),
    });
  };

  const move = (index: number, direction: -1 | 1) => {
    if (!onCustomizationChange) return;
    const target = index + direction;
    if (target < 0 || target >= ordered.length) return;
    const swap = [...ordered];
    [swap[index], swap[target]] = [swap[target], swap[index]];
    // Re-emit with y values normalized so ordering is stable.
    const renumbered = swap.map((s, i) => ({ ...s, layout: { ...s.layout, y: i * 10 } }));
    onCustomizationChange({ ...customization, sections: renumbered });
  };

  const toggleVisible = (key: SectionKey) => {
    if (!onCustomizationChange) return;
    onCustomizationChange({
      ...customization,
      sections: customization.sections.map((s) =>
        s.key === key ? { ...s, visible: !s.visible } : s,
      ),
    });
  };

  return (
    <LumiereShell customization={customization} pharmacyPhone={pharmacyPhone} logoUrl={customization.logoUrl}>
      <LumiereStyles />
      <div className="lum" style={lumiereCssVars(customization)}>
        <AmbientBackground />

        <div className="relative z-[1] mx-auto flex max-w-[1200px] flex-col gap-16 px-5 py-6 sm:px-8 sm:py-8">
          {visibleSections.map((s, i) => (
            <div key={s.key} className="relative">
              {editMode && (
                <SectionEditToolbar
                  label={SECTION_LABEL[s.key]}
                  visible={s.visible}
                  isFirst={i === 0}
                  isLast={i === visibleSections.length - 1}
                  onMoveUp={() => move(i, -1)}
                  onMoveDown={() => move(i, +1)}
                  onToggleVisible={() => toggleVisible(s.key)}
                />
              )}
              {s.visible && (
                <SectionRenderer
                  section={s}
                  editMode={editMode}
                  categories={categories}
                  pharmacyPhone={pharmacyPhone}
                  featuredCategoryIds={customization.featuredCategoryIds}
                  patchContent={patchContent}
                />
              )}
            </div>
          ))}
        </div>
      </div>
    </LumiereShell>
  );
}


// ── Editor toolbar (per-section move + hide) ───────────────────────────────

function SectionEditToolbar(props: {
  label: string; visible: boolean;
  isFirst: boolean; isLast: boolean;
  onMoveUp: () => void; onMoveDown: () => void;
  onToggleVisible: () => void;
}) {
  return (
    <div className="absolute -top-3 left-1/2 z-20 flex -translate-x-1/2 items-center gap-1 rounded-full border border-black/[0.06] bg-white/90 px-2 py-1 text-[11px] font-semibold text-[var(--lum-ink)] shadow-md backdrop-blur">
      <span className="px-1.5 opacity-80">{props.label}</span>
      <IconBtn onClick={props.onMoveUp} disabled={props.isFirst} label="Monter">
        <ArrowUp className="size-3.5" />
      </IconBtn>
      <IconBtn onClick={props.onMoveDown} disabled={props.isLast} label="Descendre">
        <ArrowDown className="size-3.5" />
      </IconBtn>
      <IconBtn onClick={props.onToggleVisible} label={props.visible ? "Masquer" : "Afficher"}>
        {props.visible ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />}
      </IconBtn>
    </div>
  );
}

function IconBtn({ children, onClick, disabled, label }: {
  children: React.ReactNode; onClick: () => void; disabled?: boolean; label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      className="grid size-6 place-items-center rounded-full transition hover:bg-black/[0.05] disabled:cursor-not-allowed disabled:opacity-40"
    >
      {children}
    </button>
  );
}


// ── Section router ─────────────────────────────────────────────────────────

function SectionRenderer(props: {
  section:              SectionConfig;
  editMode:             boolean;
  categories:           TemplateProps["categories"];
  pharmacyPhone:        string;
  featuredCategoryIds:  string[];
  patchContent:         (key: SectionKey, slot: string, val: string) => void;
}) {
  const { section: s, editMode } = props;
  return (
    <motion.section
      className="relative"
      initial={editMode ? undefined : "hidden"}
      whileInView={editMode ? undefined : "show"}
      viewport={viewportOnce}
      variants={blurUpVariants}
    >
      {s.key === "hero"                && <Hero {...props} />}
      {s.key === "brands"              && <Brands {...props} />}
      {s.key === "catalogue"           && <Categories {...props} />}
      {s.key === "soldes"              && <Soldes {...props} />}
      {s.key === "featured_categories" && <Featured {...props} />}
      {s.key === "testimonials"        && <Trust {...props} />}
      {s.key === "contact"             && <ContactTeaser {...props} />}
      {s.key === "footer"              && null /* rendered by LumiereShell */}
    </motion.section>
  );
}


// ── Sections ───────────────────────────────────────────────────────────────

type SectionProps = React.ComponentProps<typeof SectionRenderer>;


function EditableText({
  editMode, value, onChange, className, as: Tag = "span",
}: {
  editMode: boolean; value: string;
  onChange: (v: string) => void;
  className?: string;
  as?: keyof React.JSX.IntrinsicElements;
}) {
  if (!editMode) return <Tag className={className}>{value}</Tag>;
  return (
    <Tag
      className={`${className ?? ""} outline-none focus:ring-2 focus:ring-[var(--lum-primary)]/50 focus:ring-offset-2 rounded-sm`}
      contentEditable
      suppressContentEditableWarning
      onBlur={(e) => onChange((e.target as HTMLElement).innerText)}
    >
      {value}
    </Tag>
  );
}


function Hero({ section, editMode, patchContent }: SectionProps) {
  return (
    <div className="grid items-center gap-10 py-14 md:grid-cols-[1.15fr_.85fr] md:py-20">
      <div className="flex flex-col gap-5">
        <span className="lum-eyebrow inline-flex w-fit items-center gap-2 rounded-full bg-[var(--lum-secondary)]/40 px-3 py-1 text-xs font-semibold text-[var(--lum-ink)]">
          <span className="size-1.5 rounded-full bg-[var(--lum-primary)]" />
          Pharmacie · Nouveauté
        </span>
        <h1 className="font-[family-name:var(--lum-font-display)] text-[42px] font-semibold leading-[1.05] tracking-tight text-[var(--lum-ink)] sm:text-[54px] md:text-[64px]">
          <EditableText editMode={editMode} value={section.content.title ?? ""} onChange={(v) => patchContent("hero", "title", v)} />
        </h1>
        <p className="max-w-lg text-lg leading-relaxed text-[var(--lum-ink-soft)]">
          <EditableText editMode={editMode} value={section.content.subtitle ?? ""} onChange={(v) => patchContent("hero", "subtitle", v)} />
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <a href="#catalogue" className="lum-cta">
            <EditableText editMode={editMode} value={section.content.cta ?? ""} onChange={(v) => patchContent("hero", "cta", v)} />
            <ArrowRight aria-hidden className="size-4" />
          </a>
          <a href="#contact" className="text-[15px] font-semibold text-[var(--lum-ink)] underline-offset-4 hover:underline">
            Nous contacter
          </a>
        </div>
      </div>

      <div className="relative flex justify-center">
        <div className="lum-bob relative w-full max-w-sm rounded-[28px] bg-white/80 p-6 shadow-[0_30px_70px_-30px_rgba(31,169,126,0.35)] ring-1 ring-black/[.04] backdrop-blur">
          <div className="mb-4 flex items-center justify-between text-[11px] font-semibold uppercase tracking-wide text-[var(--lum-ink-soft)]">
            <span>Sélection du jour</span>
            <span className="rounded-full bg-[var(--lum-accent)]/25 px-2 py-0.5 text-[var(--lum-ink)]">−16 %</span>
          </div>
          <h3 className="font-[family-name:var(--lum-font-display)] text-2xl font-semibold text-[var(--lum-ink)]">
            Sirop Strepsils Miel
          </h3>
          <p className="mt-1 text-sm text-[var(--lum-ink-soft)]">Un peu de douceur pour la gorge.</p>
          <div className="mt-5 flex items-baseline justify-between">
            <div className="flex items-baseline gap-2">
              <span className="font-[family-name:var(--lum-font-mono)] text-2xl font-semibold text-[var(--lum-primary)]">38 MAD</span>
              <span className="font-[family-name:var(--lum-font-mono)] text-sm text-[var(--lum-ink-soft)] line-through">45 MAD</span>
            </div>
            <span className="rounded-full bg-[var(--lum-primary)]/12 px-2.5 py-1 text-[11px] font-semibold text-[var(--lum-primary)]">En stock</span>
          </div>
        </div>
      </div>
    </div>
  );
}


function Brands({ section, editMode, patchContent }: SectionProps) {
  return (
    <div className="flex flex-col gap-4 py-8">
      <h3 className="text-center text-xs font-semibold uppercase tracking-[0.2em] text-[var(--lum-ink-soft)]">
        <EditableText editMode={editMode} value={section.content.title ?? ""} onChange={(v) => patchContent("brands", "title", v)} />
      </h3>
      <motion.div
        className="flex flex-wrap items-center justify-center gap-x-10 gap-y-4"
        variants={staggerContainer}
        initial="hidden" whileInView="show" viewport={viewportOnce}
      >
        {MOCK_BRANDS.map((b) => (
          <motion.span
            key={b}
            variants={fadeUpVariants}
            className="text-lg font-medium text-[var(--lum-ink)]/70 grayscale transition-all hover:grayscale-0 hover:text-[var(--lum-ink)]"
          >
            {b}
          </motion.span>
        ))}
      </motion.div>
    </div>
  );
}


function Categories({ section, categories, editMode, patchContent, featuredCategoryIds }: SectionProps) {
  const featured = featuredCategoryIds.length > 0
    ? categories.filter((c) => featuredCategoryIds.includes(c.id))
    : categories.filter((c) => !c.isDefault).slice(0, 6);

  return (
    <div className="flex flex-col gap-8 py-14">
      <header className="flex flex-col items-center gap-2 text-center">
        <h2 className="font-[family-name:var(--lum-font-display)] text-3xl font-semibold text-[var(--lum-ink)] sm:text-4xl">
          <EditableText editMode={editMode} value={section.content.title ?? ""} onChange={(v) => patchContent("catalogue", "title", v)} />
        </h2>
        <p className="max-w-md text-sm text-[var(--lum-ink-soft)]">
          <EditableText editMode={editMode} value={section.content.sub ?? ""} onChange={(v) => patchContent("catalogue", "sub", v)} />
        </p>
      </header>
      <motion.div
        className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4"
        variants={staggerContainer}
        initial="hidden" whileInView="show" viewport={viewportOnce}
      >
        {featured.map((c) => (
          <motion.a
            key={c.id}
            href={`#catalogue-${c.id}`}
            variants={fadeUpVariants}
            className="group relative flex flex-col items-center gap-3 rounded-3xl bg-white/70 p-6 text-center shadow-[0_20px_50px_-30px_rgba(0,0,0,.15)] ring-1 ring-black/[.03] backdrop-blur transition-transform duration-300 hover:-translate-y-1"
          >
            <span
              className="grid size-14 place-items-center rounded-2xl"
              style={{ background: `${c.color}22`, color: c.color }}
            >
              <Flower2 className="size-6" strokeWidth={1.75} />
            </span>
            <span className="font-semibold text-[var(--lum-ink)]">{c.name}</span>
            <span className="font-[family-name:var(--lum-font-mono)] text-[11px] text-[var(--lum-ink-soft)]">
              {c.productCount} produits
            </span>
          </motion.a>
        ))}
      </motion.div>
    </div>
  );
}


function Soldes({ section, editMode, patchContent, pharmacyPhone }: SectionProps) {
  const soldes = MOCK_STORE_PRODUCTS.filter((p) => p.solde != null);
  return (
    <div className="flex flex-col gap-8 py-14">
      <header className="flex flex-col gap-2">
        <span className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--lum-primary)]">
          Offres du moment
        </span>
        <h2 className="font-[family-name:var(--lum-font-display)] text-3xl font-semibold text-[var(--lum-ink)] sm:text-4xl">
          <EditableText editMode={editMode} value={section.content.title ?? ""} onChange={(v) => patchContent("soldes", "title", v)} />
        </h2>
        <p className="max-w-lg text-sm text-[var(--lum-ink-soft)]">
          <EditableText editMode={editMode} value={section.content.sub ?? ""} onChange={(v) => patchContent("soldes", "sub", v)} />
        </p>
      </header>
      <motion.div
        className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4"
        variants={staggerContainer}
        initial="hidden" whileInView="show" viewport={viewportOnce}
      >
        {soldes.map((p) => {
          const pct = Math.round((1 - p.solde! / p.ppv) * 100);
          return (
            <motion.article
              key={p.id}
              variants={fadeUpVariants}
              className="lum-card group relative flex flex-col gap-3 rounded-3xl bg-white/85 p-5 shadow-[0_20px_50px_-30px_rgba(0,0,0,.2)] ring-1 ring-black/[.04] backdrop-blur transition-transform duration-500 hover:-translate-y-1"
            >
              <span className="absolute right-3 top-3 rounded-full bg-[var(--lum-accent)] px-2.5 py-0.5 text-[11px] font-bold text-[var(--lum-ink)]">
                −{pct} %
              </span>
              <div className="grid h-28 place-items-center rounded-2xl bg-gradient-to-br from-[var(--lum-secondary)]/40 to-[var(--lum-primary)]/10">
                <Sparkles className="size-10 text-[var(--lum-ink)]/70" strokeWidth={1.5} />
              </div>
              <div className="flex flex-col gap-1">
                <span className="font-semibold text-[var(--lum-ink)]">{p.name}</span>
                <span className="text-[11px] text-[var(--lum-ink-soft)]">{p.laboratoire}</span>
              </div>
              <div className="mt-auto flex items-baseline justify-between">
                <div className="flex items-baseline gap-2">
                  <span className="font-[family-name:var(--lum-font-mono)] text-lg font-semibold text-[var(--lum-primary)]">
                    {p.solde} MAD
                  </span>
                  <span className="font-[family-name:var(--lum-font-mono)] text-xs text-[var(--lum-ink-soft)] line-through">
                    {p.ppv} MAD
                  </span>
                </div>
                <a
                  href={whatsappOrderLink(pharmacyPhone, p.name)}
                  target="_blank" rel="noopener"
                  className="rounded-full bg-[var(--lum-primary)] px-3 py-1.5 text-[11px] font-semibold text-white transition-transform hover:scale-105"
                >
                  Commander
                </a>
              </div>
            </motion.article>
          );
        })}
      </motion.div>
    </div>
  );
}


function Featured({ section, editMode, patchContent, pharmacyPhone }: SectionProps) {
  const featured = MOCK_STORE_PRODUCTS.slice(0, 6);
  return (
    <div className="flex flex-col gap-8 py-14">
      <header className="flex flex-col gap-2">
        <h2 className="font-[family-name:var(--lum-font-display)] text-3xl font-semibold text-[var(--lum-ink)] sm:text-4xl">
          <EditableText editMode={editMode} value={section.content.title ?? ""} onChange={(v) => patchContent("featured_categories", "title", v)} />
        </h2>
        <p className="max-w-lg text-sm text-[var(--lum-ink-soft)]">
          <EditableText editMode={editMode} value={section.content.sub ?? ""} onChange={(v) => patchContent("featured_categories", "sub", v)} />
        </p>
      </header>
      <motion.div
        className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3"
        variants={staggerContainer}
        initial="hidden" whileInView="show" viewport={viewportOnce}
      >
        {featured.map((p) => (
          <motion.article
            key={p.id}
            variants={fadeUpVariants}
            className="flex flex-col gap-3 rounded-3xl bg-white/85 p-5 shadow-[0_20px_50px_-30px_rgba(0,0,0,.15)] ring-1 ring-black/[.04] backdrop-blur"
          >
            <div className="grid h-32 place-items-center rounded-2xl bg-gradient-to-br from-[var(--lum-primary)]/10 to-[var(--lum-secondary)]/25">
              <Flower2 className="size-14 text-[var(--lum-ink)]/60" strokeWidth={1.5} />
            </div>
            <div className="flex flex-col gap-1">
              <span className="font-semibold text-[var(--lum-ink)]">{p.name}</span>
              <span className="text-[11px] text-[var(--lum-ink-soft)]">{p.laboratoire}</span>
            </div>
            <p className="text-sm text-[var(--lum-ink-soft)] line-clamp-2">{p.description}</p>
            <div className="mt-auto flex items-center justify-between">
              <span className="font-[family-name:var(--lum-font-mono)] text-lg font-semibold text-[var(--lum-ink)]">
                {p.solde ?? p.ppv} MAD
              </span>
              <a
                href={whatsappOrderLink(pharmacyPhone, p.name)}
                target="_blank" rel="noopener"
                className="rounded-full border border-[var(--lum-primary)] px-3 py-1.5 text-[11px] font-semibold text-[var(--lum-primary)] transition hover:bg-[var(--lum-primary)] hover:text-white"
              >
                Commander
              </a>
            </div>
          </motion.article>
        ))}
      </motion.div>
    </div>
  );
}


function Trust({ section, editMode, patchContent }: SectionProps) {
  return (
    <div className="flex flex-col gap-6 py-14">
      <h3 className="text-center text-xs font-semibold uppercase tracking-[0.2em] text-[var(--lum-ink-soft)]">
        <EditableText editMode={editMode} value={section.content.title ?? ""} onChange={(v) => patchContent("testimonials", "title", v)} />
      </h3>
      <motion.div
        className="grid grid-cols-1 gap-5 md:grid-cols-3"
        variants={staggerContainer}
        initial="hidden" whileInView="show" viewport={viewportOnce}
      >
        {MOCK_TESTIMONIALS.map((t, i) => (
          <motion.figure
            key={i}
            variants={fadeUpVariants}
            className="flex flex-col gap-3 rounded-2xl bg-white/80 p-6 ring-1 ring-black/[.04] backdrop-blur"
          >
            <blockquote className="font-[family-name:var(--lum-font-display)] text-lg italic leading-snug text-[var(--lum-ink)]">
              « {t.quote} »
            </blockquote>
            <figcaption className="text-xs font-semibold text-[var(--lum-ink-soft)]">
              — {t.author}
            </figcaption>
          </motion.figure>
        ))}
      </motion.div>
    </div>
  );
}


function ContactTeaser({ section, editMode, patchContent, pharmacyPhone }: SectionProps) {
  return (
    <div className="grid gap-6 rounded-[32px] bg-white/85 p-8 shadow-[0_30px_70px_-40px_rgba(0,0,0,.15)] ring-1 ring-black/[.04] backdrop-blur md:grid-cols-[1fr_1fr] md:p-12">
      <div className="flex flex-col gap-4">
        <h2 className="font-[family-name:var(--lum-font-display)] text-3xl font-semibold text-[var(--lum-ink)]">
          <EditableText editMode={editMode} value={section.content.title ?? ""} onChange={(v) => patchContent("contact", "title", v)} />
        </h2>
        <p className="text-[var(--lum-ink-soft)]">
          <EditableText editMode={editMode} value={section.content.sub ?? ""} onChange={(v) => patchContent("contact", "sub", v)} />
        </p>
        <div className="flex flex-col gap-2 text-sm text-[var(--lum-ink)]">
          <p><strong>Adresse :</strong> 12 rue des Fleurs, Bouskoura</p>
          <p><strong>Téléphone :</strong> {pharmacyPhone}</p>
          <p><strong>Horaires :</strong> Lun–Sam · 8h—20h</p>
        </div>
        <a href={`tel:${pharmacyPhone}`} className="lum-cta w-fit">
          Nous appeler
        </a>
      </div>
      <div className="grid h-56 place-items-center rounded-2xl bg-gradient-to-br from-[var(--lum-secondary)]/30 to-[var(--lum-primary)]/10 md:h-full">
        <MapPin className="size-20 text-[var(--lum-primary)]/70" strokeWidth={1.5} />
      </div>
    </div>
  );
}


// ── Ambient bg (blooms + leaves) ───────────────────────────────────────────

function AmbientBackground() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      <div className="lum-bloom lum-bloomA absolute -left-24 top-1/4 size-96" style={{ background: "var(--lum-secondary)" }} />
      <div className="lum-bloom lum-bloomB absolute -right-24 bottom-1/4 size-96" style={{ background: "var(--lum-primary)" }} />
      <Leaf aria-hidden className="lum-leaf lum-leaf1 absolute left-[10%] top-[20%] size-8 text-[var(--lum-primary)]" strokeWidth={1.5} />
      <Leaf aria-hidden className="lum-leaf lum-leaf2 absolute right-[15%] top-[60%] size-7 text-[var(--lum-primary)]" strokeWidth={1.5} />
      <Leaf aria-hidden className="lum-leaf lum-leaf3 absolute left-[70%] top-[85%] size-8 text-[var(--lum-primary)]" strokeWidth={1.5} />
    </div>
  );
}


