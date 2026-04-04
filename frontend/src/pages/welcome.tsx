import { useAuthenticate } from "@/hooks/useAuthenticate";
import { useMe } from "@/hooks/useMe";
import { useStatusPoller } from "@/hooks/useStatusPoller";
import { Link } from "react-router";
import {
  BarChart3,
  BookOpen,
  Building2,
  ClipboardCheck,
  Clock,
  PackageX,
  LayoutDashboard,
  LogOut,
  Settings,
  ShoppingBasket,
  ShoppingCart,
  UploadCloud,
  Users,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { User } from "@/types";
import { eUserRole, eUserStatus } from "@/types";

// ── Background decoration ─────────────────────────────────────────────────────

function FloatingPills() {
  const pills = [
    { w: 56, h: 24, top: "12%", left: "8%", delay: "0s", rotate: "rotate-12" },
    { w: 40, h: 18, top: "20%", right: "10%", delay: "0.4s", rotate: "-rotate-6" },
    { w: 72, h: 28, bottom: "30%", left: "5%", delay: "0.8s", rotate: "rotate-45" },
    { w: 32, h: 14, top: "60%", right: "6%", delay: "0.2s", rotate: "rotate-12" },
    { w: 48, h: 20, bottom: "15%", right: "15%", delay: "1s", rotate: "-rotate-12" },
    { w: 24, h: 12, top: "40%", left: "3%", delay: "0.6s", rotate: "rotate-6" },
  ];
  return (
    <>
      {pills.map((p, i) => (
        <div
          key={i}
          className={`absolute pointer-events-none rounded-full bg-teal-300/25 dark:bg-teal-700/20 animate-bounce ${p.rotate}`}
          style={{
            width: p.w, height: p.h,
            top: p.top, left: (p as { left?: string }).left,
            right: (p as { right?: string }).right, bottom: (p as { bottom?: string }).bottom,
            animationDuration: "3s", animationDelay: p.delay,
          }}
        />
      ))}
    </>
  );
}

function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-teal-50 via-white to-teal-100/60 dark:from-teal-950/80 dark:via-background dark:to-teal-900/30">
      <FloatingPills />
      <div className="relative z-10 flex flex-col items-center justify-center min-h-screen px-4 py-12">
        {children}
        <p className="mt-12 text-xs text-muted-foreground">© 2025 PharmaGest — Tous droits réservés</p>
      </div>
    </div>
  );
}

// ── Logo ──────────────────────────────────────────────────────────────────────

function Logo() {
  return (
    <div className="animate-in fade-in-0 zoom-in-95 duration-700 flex justify-center" style={{ animationFillMode: "both" }}>
      <div className="relative flex h-20 w-20 items-center justify-center rounded-3xl bg-primary shadow-2xl shadow-primary/30">
        <svg viewBox="0 0 24 24" className="h-10 w-10 text-primary-foreground" fill="currentColor">
          <path d="M10.5 3.75a.75.75 0 0 0-1.5 0v.75H6.75A2.25 2.25 0 0 0 4.5 6.75v10.5A2.25 2.25 0 0 0 6.75 19.5h10.5a2.25 2.25 0 0 0 2.25-2.25V6.75A2.25 2.25 0 0 0 17.25 4.5H15v-.75a.75.75 0 0 0-1.5 0v.75h-3V3.75ZM9 7.5A.75.75 0 0 1 9.75 6.75h4.5a.75.75 0 0 1 0 1.5h-4.5A.75.75 0 0 1 9 7.5Zm-.75 3a.75.75 0 0 0 0 1.5h3v3a.75.75 0 0 0 1.5 0v-3h3a.75.75 0 0 0 0-1.5h-3v-3a.75.75 0 0 0-1.5 0v3h-3Z" />
        </svg>
        <span className="absolute inset-0 rounded-3xl ring-4 ring-primary/30 animate-ping" style={{ animationDuration: "2s" }} />
      </div>
    </div>
  );
}

// ── Unauthenticated view ──────────────────────────────────────────────────────

const FEATURES = [
  { icon: ShoppingCart, title: "Suivi des achats & ventes", desc: "Importez et analysez vos données Sobrus en quelques secondes. Historique complet, filtres avancés." },
  { icon: BarChart3, title: "Analyses & Rapports", desc: "Tableaux de bord en temps réel. Évolution mensuelle, top catégories, indicateurs clés de performance." },
  { icon: BookOpen, title: "Catalogue médicaments", desc: "Catalogue centralisé avec gestion des prix PPH/PPV, codes-barres et laboratoires." },
];

function UnauthenticatedView() {
  return (
    <div className="max-w-2xl mx-auto w-full space-y-8 text-center">
      <Logo />

      <div className="animate-in fade-in-0 slide-in-from-bottom-6 duration-700 space-y-3" style={{ animationDelay: "100ms", animationFillMode: "both" }}>
        <h1 className="text-5xl font-bold tracking-tight text-foreground">
          Pharma<span className="text-primary">Gest</span>
        </h1>
        <p className="text-lg text-muted-foreground max-w-md mx-auto leading-relaxed">
          La gestion pharmaceutique simplifiée pour les pharmacies marocaines
        </p>
      </div>

      <div className="animate-in fade-in-0 slide-in-from-bottom-4 duration-700 flex flex-col sm:flex-row gap-3 justify-center" style={{ animationDelay: "250ms", animationFillMode: "both" }}>
        <Button asChild size="lg" className="rounded-xl px-8 shadow-lg shadow-primary/25 hover:shadow-primary/40 transition-shadow">
          <Link to="/login">Se connecter</Link>
        </Button>
        <Button asChild variant="outline" size="lg" className="rounded-xl px-8 border-primary/30 hover:bg-primary/5">
          <Link to="/signup">Créer un compte</Link>
        </Button>
      </div>

      <div className="animate-in fade-in-0 slide-in-from-bottom-4 duration-700 grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4" style={{ animationDelay: "450ms", animationFillMode: "both" }}>
        {FEATURES.map((f) => {
          const Icon = f.icon;
          return (
            <Card key={f.title} className="border border-primary/10 bg-white/70 dark:bg-card/70 backdrop-blur-sm text-left hover:border-primary/30 transition-colors">
              <CardContent className="p-5 space-y-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10">
                  <Icon className="h-5 w-5 text-primary" />
                </div>
                <p className="text-sm font-semibold text-foreground">{f.title}</p>
                <p className="text-xs text-muted-foreground leading-relaxed">{f.desc}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

// ── Pending / Rejected notice ─────────────────────────────────────────────────

function PendingNotice({ role, status }: { role: eUserRole.OWNER | eUserRole.EMPLOYEE; status: eUserStatus.PENDING | eUserStatus.REJECTED }) {
  const { logout } = useAuthenticate();
  const isRejected = status === eUserStatus.REJECTED;
  return (
    <div className={`flex items-start justify-between gap-4 rounded-xl border px-5 py-4 ${
      isRejected
        ? "border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950"
        : "border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950"
    }`}>
      <div className="flex items-start gap-3">
        {isRejected
          ? <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600 dark:text-red-400" />
          : <Clock className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />}
        <div>
          <p className={`text-sm font-semibold ${isRejected ? "text-red-800 dark:text-red-300" : "text-amber-800 dark:text-amber-300"}`}>
            {isRejected ? "Compte refusé" : "Compte en attente d'approbation"}
          </p>
          <p className={`mt-0.5 text-sm ${isRejected ? "text-red-700 dark:text-red-400" : "text-amber-700 dark:text-amber-400"}`}>
            {isRejected
              ? (role === eUserRole.EMPLOYEE ? "Votre demande a été refusée. Contactez le propriétaire de votre pharmacie." : "Votre demande a été refusée. Contactez l'administrateur.")
              : (role === eUserRole.EMPLOYEE ? "Contactez le propriétaire de votre pharmacie pour valider votre compte." : "Contactez l'administrateur pour valider votre compte.")}
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={() => logout()}
        className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
          isRejected
            ? "text-red-700 hover:bg-red-100 dark:text-red-300 dark:hover:bg-red-900"
            : "text-amber-700 hover:bg-amber-100 dark:text-amber-300 dark:hover:bg-amber-900"
        }`}
      >
        <LogOut className="h-3.5 w-3.5" />
        Se déconnecter
      </button>
    </div>
  );
}

// ── Quick link card ───────────────────────────────────────────────────────────

function QuickLink({ to, icon: Icon, label, desc }: { to: string; icon: React.ElementType; label: string; desc?: string }) {
  return (
    <Link to={to}>
      <Card className="border border-primary/10 bg-white/70 dark:bg-card/70 backdrop-blur-sm text-left hover:border-primary/40 hover:shadow-md transition-all">
        <CardContent className="p-5 space-y-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10">
            <Icon className="h-5 w-5 text-primary" />
          </div>
          <p className="text-sm font-semibold text-foreground">{label}</p>
          {desc && <p className="text-xs text-muted-foreground leading-relaxed">{desc}</p>}
        </CardContent>
      </Card>
    </Link>
  );
}

// ── Admin view ────────────────────────────────────────────────────────────────

function AdminView({ name }: { name: string }) {
  return (
    <div className="max-w-2xl mx-auto w-full space-y-8 text-center">
      <Logo />
      <div className="animate-in fade-in-0 slide-in-from-bottom-6 duration-700 space-y-2" style={{ animationDelay: "100ms", animationFillMode: "both" }}>
        <h1 className="text-4xl font-bold tracking-tight text-foreground">
          Bonjour, <span className="text-primary">{name}</span>
        </h1>
        <p className="text-base text-muted-foreground">Accès rapide à votre espace administrateur</p>
      </div>
      <div className="animate-in fade-in-0 slide-in-from-bottom-4 duration-700 grid grid-cols-1 sm:grid-cols-2 gap-4 text-left" style={{ animationDelay: "200ms", animationFillMode: "both" }}>
        <QuickLink to="/dashboard" icon={LayoutDashboard} label="Tableau de bord" desc="Vue système et statistiques globales" />
        <QuickLink to="/admin/pharmacies" icon={Building2} label="Pharmacies" desc="Gérer les comptes et les pharmacies" />
        <QuickLink to="/admin/catalog-requests" icon={ClipboardCheck} label="Demandes d'exclusion" desc="Traiter les demandes en attente" />
        <QuickLink to="/admin/catalog" icon={BookOpen} label="Catalogue" desc="Gérer le catalogue médicaments" />
        <QuickLink to="/rapports" icon={BarChart3} label="Rapports" desc="Statistiques et indicateurs clés" />
      </div>
    </div>
  );
}

// ── Owner view ────────────────────────────────────────────────────────────────

function OwnerView({ identity }: { identity: User }) {
  const name = identity.name || "Propriétaire";
  const isPending = identity.status !== eUserStatus.ACTIVE;

  return (
    <div className="max-w-2xl mx-auto w-full space-y-8 text-center">
      <Logo />
      <div className="animate-in fade-in-0 slide-in-from-bottom-6 duration-700 space-y-2" style={{ animationDelay: "100ms", animationFillMode: "both" }}>
        <h1 className="text-4xl font-bold tracking-tight text-foreground">
          Bonjour, <span className="text-primary">{name}</span>
        </h1>
        {identity.pharmacy_name && (
          <p className="text-base text-muted-foreground">{identity.pharmacy_name}</p>
        )}
      </div>

      {isPending ? (
        <div className="animate-in fade-in-0 slide-in-from-bottom-4 duration-700 text-left" style={{ animationDelay: "200ms", animationFillMode: "both" }}>
          <PendingNotice role={eUserRole.OWNER} status={identity.status as eUserStatus.PENDING | eUserStatus.REJECTED} />
        </div>
      ) : (
        <div className="animate-in fade-in-0 slide-in-from-bottom-4 duration-700 grid grid-cols-1 sm:grid-cols-2 gap-4 text-left" style={{ animationDelay: "200ms", animationFillMode: "both" }}>
          <QuickLink to="/dashboard" icon={LayoutDashboard} label="Tableau de bord" desc="Aperçu rapide de votre pharmacie" />
          {identity.permissions?.import !== false && <QuickLink to="/dashboard/upload-file" icon={UploadCloud} label="Importer des données" desc="Achats ou ventes — format CSV Sobrus" />}
          <QuickLink to="/achat" icon={ShoppingCart} label="Achats" desc="Historique de vos bons de livraison" />
          <QuickLink to="/ventes" icon={ShoppingBasket} label="Ventes" desc="Historique de vos transactions ventes" />
          <QuickLink to="/rapports" icon={BarChart3} label="Rapports" desc="Analyses et indicateurs clés" />
          <QuickLink to="/owner/employees" icon={Users} label="Mes employés" desc="Gérer les accès de votre équipe" />
          <QuickLink to="/catalog-requests" icon={PackageX} label="Produits spéciaux" desc="Exclure des produits de vos rapports" />
          <QuickLink to="/parametres" icon={Settings} label="Paramètres" desc="Configuration de la pharmacie" />
        </div>
      )}
    </div>
  );
}

// ── Employee view ─────────────────────────────────────────────────────────────

function EmployeeView({ identity }: { identity: User }) {
  const name = identity.name || "Employé";
  const isPending = identity.status !== eUserStatus.ACTIVE;

  return (
    <div className="max-w-2xl mx-auto w-full space-y-8 text-center">
      <Logo />
      <div className="animate-in fade-in-0 slide-in-from-bottom-6 duration-700 space-y-2" style={{ animationDelay: "100ms", animationFillMode: "both" }}>
        <h1 className="text-4xl font-bold tracking-tight text-foreground">
          Bonjour, <span className="text-primary">{name}</span>
        </h1>
        {identity.pharmacy_name && (
          <p className="text-base text-muted-foreground">{identity.pharmacy_name}</p>
        )}
      </div>

      {isPending ? (
        <div className="animate-in fade-in-0 slide-in-from-bottom-4 duration-700 text-left" style={{ animationDelay: "200ms", animationFillMode: "both" }}>
          <PendingNotice role={eUserRole.EMPLOYEE} status={identity.status as eUserStatus.PENDING | eUserStatus.REJECTED} />
        </div>
      ) : (
        <div className="animate-in fade-in-0 slide-in-from-bottom-4 duration-700 grid grid-cols-1 sm:grid-cols-2 gap-4 text-left" style={{ animationDelay: "200ms", animationFillMode: "both" }}>
          <QuickLink to="/dashboard" icon={LayoutDashboard} label="Tableau de bord" desc="Aperçu rapide de votre pharmacie" />
          {identity.permissions?.import !== false && <QuickLink to="/dashboard/upload-file" icon={UploadCloud} label="Importer des données" desc="Achats ou ventes — format CSV Sobrus" />}
          {identity.permissions?.achat !== false && <QuickLink to="/achat" icon={ShoppingCart} label="Achats" desc="Historique des bons de livraison" />}
          {identity.permissions?.ventes !== false && <QuickLink to="/ventes" icon={ShoppingBasket} label="Ventes" desc="Historique des transactions ventes" />}
          {identity.permissions?.rapports !== false && <QuickLink to="/rapports" icon={BarChart3} label="Rapports" desc="Analyses et indicateurs clés" />}
        </div>
      )}
    </div>
  );
}

// ── Root ──────────────────────────────────────────────────────────────────────

export default function WelcomePage() {
  const { me: identity } = useMe();
  useStatusPoller(identity);

  return (
    <PageShell>
      {!identity && <UnauthenticatedView />}
      {identity?.role === eUserRole.ADMIN && <AdminView name={identity.name || "Administrateur"} />}
      {identity?.role === eUserRole.OWNER && <OwnerView identity={identity} />}
      {identity?.role === eUserRole.EMPLOYEE && <EmployeeView identity={identity} />}
    </PageShell>
  );
}
