import { Link } from "react-router-dom";
import {
  ShoppingCart, TrendingUp, Boxes, PieChart,
  Layers, LineChart, ShieldCheck,
} from "lucide-react";

import { PharmagestIcon } from "@/components/shared/PharmagestIcon";
import { ThemeToggle } from "@/components/shared/ThemeToggle";
import { useMe } from "@/hooks/useMe";
import { ROLES, ROUTES, type Role } from "@/types";


/** Pick the post-login landing route for a role. Developers don't have
 *  /rapport (it's feature-gated on `rapports` which they never get); while
 *  the developer surfaces are HIDDEN 2026-07-03 we fall them back to /me so
 *  they land somewhere valid. Restore the DEV_DASHBOARD target when the
 *  developer feature ships. */
function landingRouteFor(role: Role): string {
  return role === ROLES.DEVELOPER ? ROUTES.ME : ROUTES.RAPPORT;
}

const cycle = [
  { title: "Achats",  desc: "Importez vos bons et suivez vos entrées de stock.",  Icon: ShoppingCart, bg: "bg-info-subtle",         fg: "text-info-subtle-foreground" },
  { title: "Ventes",  desc: "Visualisez votre activité jour après jour.",         Icon: TrendingUp,   bg: "bg-primary/12",           fg: "text-primary" },
  { title: "Stock",   desc: "Anticipez les ruptures et les péremptions.",         Icon: Boxes,        bg: "bg-success-subtle",       fg: "text-success-subtle-foreground" },
  { title: "Marges",  desc: "Mesurez votre rentabilité en temps réel.",           Icon: PieChart,     bg: "bg-primary/12",           fg: "text-primary" },
];

const features = [
  { title: "Tout au même endroit",     desc: "Achats, ventes, stock et comptabilité réunis dans une interface limpide, sans friction.", Icon: Layers },
  { title: "Marges en temps réel",     desc: "Suivez votre rentabilité par produit et par catégorie, calculée en continu.",              Icon: LineChart },
  { title: "Sécurisé, multi-rôles",    desc: "Admin, propriétaire, employé : chacun son accès, vos données toujours protégées.",        Icon: ShieldCheck },
];

const stats = [
  { value: "200+",   label: "officines équipées" },
  { value: "1,2 M",  label: "ventes traitées / mois" },
  { value: "99,9 %", label: "disponibilité" },
];

const roleLabels = {
  admin:     "Administrateur",
  owner:     "Propriétaire",
  employee:  "Employé",
  developer: "Développeur",
} as const;

function firstName(full: string | null | undefined, fallback: string): string {
  if (!full) return fallback;
  return full.trim().split(/\s+/)[0] ?? fallback;
}

export default function HomePage() {
  const { me } = useMe();
  const isAuthed   = !!me;
  const myLanding  = isAuthed ? landingRouteFor(me!.role as Role) : ROUTES.LOGIN;
  return (
    <div className="bg-background text-foreground">
      <style>{`
        @keyframes pg-drift { 0% { transform: translate3d(-4%,-3%,0) rotate(0) scale(1) } 50% { transform: translate3d(3%,2%,0) rotate(8deg) scale(1.14) } 100% { transform: translate3d(5%,4%,0) rotate(-6deg) scale(1.06) } }
        @keyframes pg-waveX { from { transform: translateX(0) } to { transform: translateX(-1440px) } }
        @keyframes pg-float { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-14px) } }
        @keyframes pg-flow { from { background-position: 200% 0 } to { background-position: -200% 0 } }
        .home-hero { background: linear-gradient(180deg, var(--teal-50) 0%, var(--teal-100) 55%, var(--teal-200) 100%); }
        .home-wave { position: absolute; bottom: 0; left: 0; width: 200%; height: 100%; }
        .home-wave-1 { opacity: .45; animation: pg-waveX 27s linear infinite; }
        .home-wave-2 { opacity: .55; animation: pg-waveX 19s linear infinite reverse; }
        .home-wave-3 { animation: pg-waveX 13s linear infinite; }
        .home-float { animation: pg-float 7s ease-in-out infinite; }
        .home-flow {
          background: linear-gradient(90deg, transparent, var(--teal-500), var(--brand-blue), var(--brand-green), transparent);
          background-size: 200% 100%;
          animation: pg-flow 6s linear infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .home-wave-1, .home-wave-2, .home-wave-3, .home-float, .home-flow { animation: none }
        }
      `}</style>

      {/* NAV */}
      <header className="sticky top-0 z-50 border-b border-border" style={{ backdropFilter: "blur(10px)", background: "color-mix(in srgb, var(--background) 72%, transparent)" }}>
        <div className="mx-auto flex h-16 max-w-[1140px] items-center justify-between px-6">
          <Link to={ROUTES.HOME} className="flex items-center gap-[11px] focus-visible:outline-2 focus-visible:outline-ring rounded-md" aria-label="Accueil PharmaGest">
            <PharmagestIcon className="text-primary" size={30} ariaHidden />
            <span className="text-[18px] font-extrabold tracking-tight">Pharma<span className="text-primary">Gest</span></span>
          </Link>
          <nav className="hidden md:flex items-center gap-7">
            <a href="#cycle"    className="text-sm font-medium text-muted-foreground transition-colors duration-fast hover:text-foreground">Le cycle</a>
            <a href="#features" className="text-sm font-medium text-muted-foreground transition-colors duration-fast hover:text-foreground">Fonctionnalités</a>
          </nav>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            {isAuthed ? (
              <Link to={myLanding} className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground cursor-pointer transition-colors duration-fast hover:bg-primary-hover">
                Mon espace
              </Link>
            ) : (
              <Link to={ROUTES.LOGIN} className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground cursor-pointer transition-colors duration-fast hover:bg-primary-hover">
                Se connecter
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* HERO */}
      <section className="home-hero relative overflow-hidden">
        <div className="relative z-10 mx-auto max-w-[1140px] px-6 pt-[84px] pb-[200px]">
          <div className="grid items-center gap-12 md:grid-cols-[1.05fr_.95fr]">
            <div className="flex flex-col gap-6">
              <span className="inline-flex items-center gap-2 self-start rounded-full border border-border px-3.5 py-1.5 text-xs font-semibold text-primary" style={{ background: "color-mix(in srgb, var(--card) 70%, transparent)" }}>
                <span className="h-[7px] w-[7px] rounded-full bg-primary" />
                {isAuthed
                  ? `${roleLabels[me!.role]}${me!.pharmacy ? ` · ${me!.pharmacy.code ?? me!.pharmacy.name}` : ""}`
                  : "Conçu pour les pharmacies marocaines"}
              </span>
              <h1 className="m-0 max-w-[14ch] text-[52px] font-extrabold leading-[1.05] tracking-[-0.035em] text-[#121A18]">
                {isAuthed
                  ? <>Bon retour, {firstName(me!.name, "vous")}.</>
                  : "Votre officine, gérée en toute fluidité."}
              </h1>
              <p className="m-0 max-w-[44ch] text-[18px] leading-[1.6] text-muted-foreground">
                {isAuthed
                  ? "Votre espace est prêt. Reprenez votre activité là où vous l'avez laissée, en toute sérénité."
                  : "Achats, ventes, stock et marges, réunis dans un espace clair, calme et sécurisé. Laissez vos données suivre leur cours, naturellement."}
              </p>
              <div className="mt-1.5 flex flex-wrap gap-3">
                {isAuthed ? (
                  <Link to={myLanding} className="rounded-lg bg-primary px-6 py-[13px] text-[15px] font-semibold text-primary-foreground cursor-pointer transition-colors duration-fast hover:bg-primary-hover">
                    Aller à mon espace
                  </Link>
                ) : (
                  <Link to={ROUTES.LOGIN} className="rounded-lg bg-primary px-6 py-[13px] text-[15px] font-semibold text-primary-foreground cursor-pointer transition-colors duration-fast hover:bg-primary-hover">
                    Se connecter
                  </Link>
                )}
                <a href="#cycle" className="inline-flex items-center gap-2 rounded-lg border border-border px-5 py-[13px] text-[15px] font-semibold text-foreground cursor-pointer" style={{ background: "color-mix(in srgb, var(--card) 75%, transparent)" }}>
                  Découvrir le flux
                </a>
              </div>
            </div>

            {/* floating product card */}
            <div className="home-float mx-auto flex max-w-[420px] flex-col gap-4 rounded-[18px] border border-border bg-card p-[22px] shadow-lg md:mx-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-[9px]">
                  <PharmagestIcon className="text-primary" size={22} ariaHidden />
                  <span className="text-[13px] font-bold">Rapport</span>
                </div>
                <span className="rounded-full border border-border px-[9px] py-[3px] font-mono text-[11px] text-muted-foreground">BOU0001</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Chiffre d&apos;affaires · aujourd&apos;hui
                </span>
                <div className="flex items-baseline gap-2.5">
                  <span className="whitespace-nowrap font-mono text-[30px] font-bold tabular-nums tracking-[-0.02em]">12 480 MAD</span>
                  <span className="font-mono text-[12px] font-semibold text-success">+8,2 %</span>
                </div>
              </div>
              <svg viewBox="0 0 320 90" width="100%" height="80" preserveAspectRatio="none" aria-hidden>
                <defs>
                  <linearGradient id="home-hero-fill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stopColor="var(--teal-500)" stopOpacity=".28" />
                    <stop offset="1" stopColor="var(--teal-500)" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <path d="M0 70 L40 64 L80 68 L120 50 L160 56 L200 38 L240 44 L280 24 L320 18 L320 90 L0 90 Z" fill="url(#home-hero-fill)" />
                <path d="M0 70 L40 64 L80 68 L120 50 L160 56 L200 38 L240 44 L280 24 L320 18" fill="none" stroke="var(--teal-500)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <div className="flex flex-col gap-[9px]">
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-[7px] text-[12px] font-semibold">
                    <span className="h-2 w-2 rounded-full" style={{ background: "var(--color-pharmacie)" }} />
                    Pharmacie
                  </span>
                  <span className="font-mono text-[12px] text-muted-foreground">66%</span>
                </div>
                <div className="h-[7px] overflow-hidden rounded-full bg-surface-subtle">
                  <span className="block h-full rounded-full" style={{ width: "66%", background: "var(--color-pharmacie)" }} />
                </div>
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-[7px] text-[12px] font-semibold">
                    <span className="h-2 w-2 rounded-full" style={{ background: "var(--color-parapharmacie)" }} />
                    Parapharmacie
                  </span>
                  <span className="font-mono text-[12px] text-muted-foreground">34%</span>
                </div>
                <div className="h-[7px] overflow-hidden rounded-full bg-surface-subtle">
                  <span className="block h-full rounded-full" style={{ width: "34%", background: "var(--color-parapharmacie)" }} />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ocean waves */}
        <div className="pointer-events-none absolute inset-x-0 -bottom-px h-[180px] overflow-hidden">
          <svg className="home-wave home-wave-1" viewBox="0 0 2880 160" preserveAspectRatio="none" aria-hidden>
            <path d="M0 80 c 180 -40 540 40 720 0 c 180 -40 540 40 720 0 c 180 -40 540 40 720 0 c 180 -40 540 40 720 0 V160 H0 Z" fill="var(--teal-300)" />
          </svg>
          <svg className="home-wave home-wave-2" viewBox="0 0 2880 160" preserveAspectRatio="none" aria-hidden>
            <path d="M0 96 c 180 -36 540 36 720 0 c 180 -36 540 36 720 0 c 180 -36 540 36 720 0 c 180 -36 540 36 720 0 V160 H0 Z" fill="var(--teal-200)" />
          </svg>
          <svg className="home-wave home-wave-3" viewBox="0 0 2880 160" preserveAspectRatio="none" aria-hidden>
            <path d="M0 110 c 180 -30 540 30 720 0 c 180 -30 540 30 720 0 c 180 -30 540 30 720 0 c 180 -30 540 30 720 0 V160 H0 Z" fill="var(--background)" />
          </svg>
        </div>
      </section>

      {/* CYCLE */}
      <section id="cycle" className="mx-auto max-w-[1140px] px-6 py-[72px]">
        <div className="mb-9 flex flex-col items-center gap-3 text-center">
          <span className="text-[12px] font-bold uppercase tracking-[0.14em] text-primary">Le cycle</span>
          <h2 className="m-0 max-w-[18ch] text-[34px] font-extrabold leading-[1.15] tracking-[-0.025em]">Un flux continu, de l&apos;achat à la marge</h2>
          <p className="m-0 max-w-[52ch] text-base text-muted-foreground">
            Comme le G de PharmaGest, vos données forment une boucle fermée : chaque étape alimente la suivante, sans rupture.
          </p>
        </div>
        <div className="flex flex-col items-stretch gap-3.5 md:flex-row">
          {cycle.map(({ title, desc, Icon, bg, fg }) => (
            <div key={title} className="flex flex-1 flex-col gap-3 rounded-[14px] border border-border bg-card p-[22px] cursor-pointer transition-all duration-normal hover:-translate-y-1 hover:shadow-lg">
              <span className={`flex h-[42px] w-[42px] items-center justify-center rounded-[11px] ${bg} ${fg}`}>
                <Icon className="h-5 w-5" />
              </span>
              <span className="text-[15px] font-bold">{title}</span>
              <span className="text-[13px] leading-[1.55] text-muted-foreground">{desc}</span>
            </div>
          ))}
        </div>
        <div className="home-flow mt-[22px] h-[3px] rounded-full opacity-80" />
      </section>

      {/* FEATURES */}
      <section id="features" className="border-y border-border bg-surface-subtle">
        <div className="mx-auto max-w-[1140px] px-6 py-[72px]">
          <div className="mb-9 flex max-w-[46ch] flex-col gap-2.5">
            <span className="text-[12px] font-bold uppercase tracking-[0.14em] text-primary">Fonctionnalités</span>
            <h2 className="m-0 text-[34px] font-extrabold leading-[1.15] tracking-[-0.025em]">Clair, calme, sous contrôle</h2>
          </div>
          <div className="grid gap-5 md:grid-cols-3">
            {features.map(({ title, desc, Icon }) => (
              <div key={title} className="flex flex-col gap-3.5 rounded-[16px] border border-border bg-card p-7 cursor-pointer transition-all duration-normal hover:-translate-y-1 hover:shadow-lg">
                <span className="flex h-12 w-12 items-center justify-center rounded-[12px] bg-primary/12 text-primary">
                  <Icon className="h-6 w-6" />
                </span>
                <h3 className="m-0 text-[18px] font-bold tracking-[-0.01em]">{title}</h3>
                <p className="m-0 text-sm leading-[1.6] text-muted-foreground">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* AURORA CTA + STATS */}
      <section className="brand-aurora relative">
        <div className="relative z-10 mx-auto flex max-w-[1140px] flex-col items-center gap-[30px] px-6 py-20 text-center text-white">
          <div className="flex flex-col items-center gap-3.5">
            <h2 className="m-0 max-w-[18ch] text-[40px] font-extrabold leading-[1.1] tracking-[-0.03em]">
              {isAuthed
                ? "Votre activité, à portée de main."
                : "Laissez vos données suivre leur cours."}
            </h2>
            <p className="m-0 max-w-[46ch] text-[17px] leading-[1.6] opacity-80">
              {isAuthed
                ? "Tout est prêt. Consultez vos ventes, vos marges et votre stock en un clic."
                : "Rejoignez les officines qui pilotent leur activité en toute sérénité."}
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-3">
            {isAuthed ? (
              <Link to={myLanding} className="rounded-lg bg-white px-6 py-[13px] text-[15px] font-bold text-[#0C1A17] cursor-pointer">
                Aller à mon espace
              </Link>
            ) : (
              <Link to={ROUTES.LOGIN} className="rounded-lg bg-white px-6 py-[13px] text-[15px] font-bold text-[#0C1A17] cursor-pointer">
                Se connecter
              </Link>
            )}
          </div>
          {!isAuthed && (
            <div className="mt-3.5 flex flex-wrap justify-center gap-10">
              {stats.map(({ value, label }) => (
                <div key={label} className="flex flex-col items-center gap-[3px]">
                  <span className="whitespace-nowrap font-mono text-[30px] font-bold tracking-[-0.02em] text-white">{value}</span>
                  <span className="text-[13px] text-white/70">{label}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* FOOTER */}
      <footer className="mx-auto flex max-w-[1140px] flex-wrap items-center justify-between gap-4 px-6 py-10">
        <div className="flex items-center gap-2.5">
          <PharmagestIcon className="text-primary" size={24} ariaHidden />
          <span className="text-[15px] font-extrabold tracking-tight">Pharma<span className="text-primary">Gest</span></span>
        </div>
        <span className="text-[13px] text-muted-foreground">© 2026 PharmaGest · Gestion d&apos;officine</span>
      </footer>
    </div>
  );
}