import { Suspense, useState } from "react";
import { Navigate, Outlet, useLocation, NavLink, Link, useNavigate } from "react-router-dom";

import { useMe } from "@/hooks/useMe";
import { ROLES, ROUTES, STATUSES } from "@/types";
import {
  LayoutDashboard,
  ShoppingCart,
  TrendingUp,
  Boxes,
  Package,
  BarChart3,
  Bell,
  Coins,
  Star,
  UsersRound,
  History,
  Building2,
  BookOpen,
  Tags,
  CircleUser,
  Settings,
  RefreshCw,
  Menu,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Ban,
  CheckCircle2,
  Clock,
  FileSpreadsheet,
  Loader2,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { Feature, Role, DocType } from "@/types";
import { useI18n, useT } from "@/i18n/I18nProvider";
import { LANGS, LANG_LABELS } from "@/i18n/config";
import { cn } from "@/utils/cn";
import { PharmagestIcon } from "./PharmagestIcon";
import { ThemeToggle } from "./ThemeToggle";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/api/client";
import { API } from "@/api/api";
import { Skeleton } from "./Skeleton";
import { SobrusBanner } from "./SobrusBanner";
import { SobrusRunCard } from "./SobrusRunCard";
import { Tooltip } from "./Tooltip";
import { useLogout } from "@/hooks/useLogout";
import { useUploadCtx, type UploadJob } from "@/hooks/UploadContext";
import { formatQty } from "@/utils/format";

interface NavItem {
  label: string;
  to: string;
  icon: LucideIcon;
  roles: Role[];
  /** Render disabled (cursor-not-allowed, opacity-45) until the page exists. */
  ready?: boolean;
  /** Hide for non-admin users who don't have this feature in their effective
   *  permission set (3-layer intersection from /me). Admins bypass. Omit on
   *  role-only items like /rapports or admin entries. */
  feature?: Feature;
}
interface NavGroup {
  title?: string;
  items: NavItem[];
}

const ALL: Role[] = [ROLES.ADMIN, ROLES.OWNER, ROLES.EMPLOYEE];
const ALL_HUMAN: Role[] = [ROLES.ADMIN, ROLES.OWNER, ROLES.EMPLOYEE, ROLES.DEVELOPER];
const DATA: Role[] = [ROLES.OWNER, ROLES.EMPLOYEE];

const NAV_GROUPS: NavGroup[] = [
  {
    items: [
      {
        label: "nav.dashboard",
        to: ROUTES.RAPPORT,
        icon: LayoutDashboard,
        roles: ALL,
        ready: true,
        feature: "rapports",
      },
    ],
  },
  {
    title: "nav.groupExploitation",
    items: [
      { label: "nav.achats", to: ROUTES.ACHATS, icon: ShoppingCart, roles: DATA, ready: true, feature: "achats" },
      { label: "nav.ventes", to: ROUTES.VENTES, icon: TrendingUp, roles: DATA, ready: true, feature: "ventes" },
      { label: "nav.stock", to: ROUTES.STOCK, icon: Boxes, roles: DATA, ready: true, feature: "stock" },
      { label: "nav.produits", to: ROUTES.PRODUITS, icon: Package, roles: DATA, ready: true, feature: "produits" },
      { label: "nav.analyses", to: ROUTES.ANALYSES, icon: BarChart3, roles: DATA, ready: true, feature: "analyse" },
      { label: "nav.alertes", to: ROUTES.ALERTES, icon: Bell, roles: DATA, ready: true, feature: "alertes" },
      {
        label: "nav.comptabilite",
        to: ROUTES.COMPTABILITE,
        icon: Coins,
        roles: DATA,
        ready: true,
        feature: "accounting",
      },
      {
        label: "nav.produitsSpeciaux",
        to: ROUTES.PRODUITS_SPECIAUX,
        icon: Star,
        roles: DATA,
        ready: true,
        feature: "special_products",
      },
    ],
  },
  {
    title: "nav.groupGestion",
    items: [
      { label: "nav.equipe", to: ROUTES.OWNER_EMPLOYEES, icon: UsersRound, roles: [ROLES.OWNER], ready: true },
      { label: "nav.historique", to: ROUTES.HISTORY, icon: History, roles: [ROLES.OWNER], ready: true },
      {
        label: "nav.sobrus",
        to: ROUTES.SOBRUS,
        icon: RefreshCw,
        roles: [ROLES.OWNER],
        ready: true,
        feature: "sobrus",
      },
      // HIDDEN 2026-07-03 — restore when the store-website feature ships.
      // { label: "Ma boutique en ligne", to: ROUTES.STORE_WEBSITE, icon: Globe, roles: [ROLES.OWNER], ready: true },
    ],
  },
  // HIDDEN 2026-07-03 — the whole "Espace développeur" group. Restore when the
  // developer editor + exports pipeline are ready to ship.
  // {
  //   title: "Espace développeur",
  //   items: [
  //     { label: "Demandes",   to: ROUTES.DEV_DASHBOARD, icon: Code2,      roles: [ROLES.DEVELOPER], ready: true },
  //     { label: "Mes exports", to: ROUTES.DEV_EXPORTS,  icon: FolderDown, roles: [ROLES.DEVELOPER], ready: true },
  //   ],
  // },
  {
    title: "nav.groupAdministration",
    items: [
      { label: "nav.pharmacies", to: ROUTES.ADMIN_PHARMACIES, icon: Building2, roles: [ROLES.ADMIN], ready: true },
      { label: "nav.catalogue", to: ROUTES.ADMIN_CATALOGUE, icon: BookOpen, roles: [ROLES.ADMIN], ready: true },
      { label: "nav.categories", to: ROUTES.ADMIN_CATEGORIES, icon: Tags, roles: [ROLES.ADMIN], ready: true },
      // HIDDEN 2026-07-03 — admin/developers panel.
      // { label: "Développeurs", to: ROUTES.ADMIN_DEVELOPERS, icon: Code2, roles: [ROLES.ADMIN], ready: true },
    ],
  },
];

const SETTINGS_ITEM: NavItem = {
  label: "nav.imports",
  to: ROUTES.IMPORTS,
  icon: Settings,
  roles: ALL,
  ready: true,
  feature: "import",
};

const ACCOUNT_ITEM: NavItem = {
  label: "nav.compte",
  to: ROUTES.ME,
  icon: CircleUser,
  roles: ALL_HUMAN,
  ready: true,
};

/** Filter the nav for a given user. Admin sees every entry their role allows
 *  (feature flags don't gate admin). Non-admin: drops any entry whose `feature`
 *  isn't in their effective permission set (from /me — already the 3-layer
 *  intersection). Role-only entries (no `feature`) stay visible. */
function visibleGroups(role: Role, permissions: readonly string[] = []): NavGroup[] {
  const perms = new Set(permissions);
  const isAdmin = role === ROLES.ADMIN;
  return NAV_GROUPS.map((g) => ({
    ...g,
    items: g.items.filter((i) => {
      if (!i.roles.includes(role)) return false;
      if (isAdmin) return true;
      if (!i.feature) return true;
      return perms.has(i.feature);
    }),
  })).filter((g) => g.items.length > 0);
}

function navTitle(pathname: string): string {
  const all = [...NAV_GROUPS.flatMap((g) => g.items), SETTINGS_ITEM, ACCOUNT_ITEM];
  const match = all.find((i) => pathname === i.to || pathname.startsWith(`${i.to}/`));
  return match?.label ?? "nav.dashboard";
}

/** FR / ES segmented switch — mirrors ThemeToggle, sits next to it in the Header. */
function LanguageToggle() {
  const { lang, setLang, t } = useI18n();
  return (
    <div
      className="flex items-center gap-0.5 rounded-[9px] border border-border bg-surface-subtle p-0.5"
      aria-label={t("lang.label")}
    >
      {LANGS.map((l) => {
        const active = lang === l;
        return (
          <button
            key={l}
            type="button"
            onClick={() => setLang(l)}
            aria-label={t(`lang.${l}`)}
            aria-pressed={active}
            className={cn(
              "flex h-7 w-[30px] cursor-pointer items-center justify-center rounded-md text-[11px] font-bold transition-colors",
              active ? "bg-card text-primary shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {LANG_LABELS[l]}
          </button>
        );
      })}
    </div>
  );
}

interface Props {
  className?: string;
  /** Icon pixel size. The text scales with the parent font-size class. */
  iconSize?: number;
}

/**
 * Brand wordmark: icon + "Pharma" + "Gest".
 * "Pharma" inherits the foreground color; "Gest" is brand teal via text-primary.
 * Themes automatically in light + dark via tokens.
 */
function PharmagestWordmark({ className, iconSize = 28 }: Props) {
  return (
    <span className={cn("inline-flex items-center gap-2 font-extrabold tracking-tight", className)}>
      <PharmagestIcon className="text-primary shrink-0" size={iconSize} />
      <span>
        <span className="text-foreground">Pharma</span>
        <span className="text-primary">Gest</span>
      </span>
    </span>
  );
}

interface HeaderProps {
  onOpenMobile: () => void;
}

const ROLE_KEYS: Record<Role, string> = {
  [ROLES.ADMIN]: "roles.admin",
  [ROLES.OWNER]: "roles.owner",
  [ROLES.EMPLOYEE]: "roles.employee",
  [ROLES.DEVELOPER]: "roles.developer",
};

function Header({ onOpenMobile }: HeaderProps) {
  const { pathname } = useLocation();
  const { me } = useMe();
  const t = useT();
  const title = t(navTitle(pathname));
  const code = me?.pharmacy?.code;
  const roleLabel = me ? t(ROLE_KEYS[me.role]) : "";

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-card px-5">
      <div className="flex min-w-0 items-center gap-3">
        <button
          type="button"
          onClick={onOpenMobile}
          aria-label={t("nav.expand")}
          className="flex cursor-pointer p-1 text-foreground md:hidden"
        >
          <Menu className="size-[22px]" />
        </button>
        <div className="hidden min-w-0 flex-col md:flex">
          <span className="truncate text-sm font-semibold leading-tight tracking-tight">{title}</span>
          <span className="text-[11px] text-muted-foreground">
            {t("header.home")} · {title}
          </span>
        </div>
        <PharmagestWordmark className="md:hidden" iconSize={22} />
      </div>

      <div className="flex items-center gap-3">
        {me && (
          <div className="hidden items-center gap-2 md:flex">
            <span className="truncate text-xs font-medium text-foreground max-w-[160px]" title={me.name}>
              {me.name}
            </span>
            <span
              className="rounded-full border px-[11px] py-1 text-xs font-semibold"
              style={{
                background: `color-mix(in srgb, var(--role-${me.role}) 14%, transparent)`,
                color: `var(--role-${me.role})`,
                borderColor: `color-mix(in srgb, var(--role-${me.role}) 38%, transparent)`,
              }}
              aria-label={roleLabel}
            >
              {roleLabel}
            </span>
          </div>
        )}
        {code && (
          <span className="hidden rounded-full border border-border px-[11px] py-1 font-mono text-xs font-semibold text-muted-foreground md:inline">
            {code}
          </span>
        )}
        <LanguageToggle />
        <ThemeToggle />
      </div>
    </header>
  );
}

/** Admin catalog hooks — used cross-page (Sidebar badge + admin/catalogue page).
 *  Page-local catalog state stays in pages/admin/catalogue/_hooks/. */

/** Admin-only count of unclassified medicaments. Drives the "Catalogue"
 *  sidebar badge. Refetches every 60s; cheap query. */
function useUnclassifiedCount(role: Role): number {
  const { data } = useQuery({
    queryKey: API.admin.catalog.unclassifiedCount.key,
    queryFn: () => api.get<{ count: number }>(API.admin.catalog.unclassifiedCount.url),
    enabled: role === ROLES.ADMIN,
    staleTime: 60_000,
    refetchInterval: 60_000,
  });
  return data?.count ?? 0;
}

interface SidebarProps {
  role: Role;
  /** User's effective permissions (3-layer intersection from /me). Drives the
   *  feature-flag filter on nav items. Admin's bypass is handled inside
   *  visibleGroups; this prop is still required (pass [] for admin). */
  permissions: readonly string[];
  /** Signed up, not accepted yet: no menu entry (only « Mon compte » + « Déconnexion »). */
  pending: boolean;
  collapsed: boolean;
  onToggleCollapse: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

function itemClasses(isActive: boolean, collapsed: boolean) {
  return cn(
    "flex items-center gap-[11px] rounded-lg px-3 py-2.5 text-[13px] font-medium transition-colors max-md:py-3 max-md:text-sm",
    collapsed && "md:justify-center md:px-0",
    isActive ? "bg-accent text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground",
  );
}

function CountBadge({ n, collapsed }: { n: number; collapsed: boolean }) {
  const t = useT();
  if (n <= 0) return null;
  return (
    <span
      className={cn(
        "inline-flex min-w-[18px] items-center justify-center rounded-full bg-warning px-1.5 text-[10px] font-bold tabular-nums text-warning-foreground",
        // When collapsed, dot floats top-right of the icon instead of inline.
        collapsed ? "absolute right-0 top-0 size-[14px] min-w-0 px-0 text-[9px]" : "ml-auto",
      )}
      title={t("nav.pendingTitle", { n })}
      aria-label={t("nav.unclassifiedAria", { n })}
    >
      {n > 99 ? "99+" : n}
    </span>
  );
}

function NavRow({ item, collapsed, badge }: { item: NavItem; collapsed: boolean; badge?: number }) {
  const t = useT();
  const label = t(item.label);
  // Tooltip only fires when collapsed — labels are visible inline when expanded.
  // Mobile keeps native title since hover doesn't apply there.
  const tooltipLabel = collapsed ? (item.ready === false ? `${label} · ${t("nav.soon")}` : label) : "";

  const inner =
    item.ready === false ? (
      <div aria-disabled className={cn(itemClasses(false, collapsed), "cursor-not-allowed opacity-45")}>
        <item.icon className="size-[18px] shrink-0" aria-hidden />
        <span className={collapsed ? "md:hidden" : ""}>{label}</span>
      </div>
    ) : (
      <NavLink
        to={item.to}
        end={item.to === ROUTES.RAPPORT}
        className={({ isActive }) => cn(itemClasses(isActive, collapsed), "relative")}
      >
        <item.icon className="size-[18px] shrink-0" aria-hidden />
        <span className={collapsed ? "md:hidden" : ""}>{label}</span>
        {badge != null && <CountBadge n={badge} collapsed={collapsed} />}
      </NavLink>
    );

  return (
    <Tooltip label={tooltipLabel} placement="right" className="relative block">
      {inner}
    </Tooltip>
  );
}

function Sidebar({ role, permissions, pending, collapsed, onToggleCollapse, mobileOpen, onCloseMobile }: SidebarProps) {
  const t = useT();
  const { handleLogout } = useLogout();
  const groups = pending ? [] : visibleGroups(role, permissions);
  const unclassifiedCount = useUnclassifiedCount(role);

  /** Lookup: route path → badge number. Currently only the admin Catalogue row
   *  has one (unclassified product count). Extend the map when more dynamic
   *  badges land. */
  const badges: Record<string, number> = {
    [ROUTES.ADMIN_CATALOGUE]: unclassifiedCount,
  };

  return (
    <>
      {/* Backdrop: opacity transition (not display:none/block) so it fades in/out
          with the drawer. pointer-events disabled when closed so the page below
          stays clickable. */}
      <div
        className={cn(
          "fixed inset-0 z-30 bg-black/40 transition-opacity duration-300 ease-out md:hidden",
          mobileOpen ? "opacity-100" : "pointer-events-none opacity-0",
        )}
        onClick={onCloseMobile}
        aria-hidden
      />
      <aside
        style={{ willChange: "transform" }}
        className={cn(
          "fixed left-0 top-0 z-40 flex h-screen flex-col border-r border-border bg-card",
          // Mobile: only transform animates (slide). Desktop: width animates on collapse.
          "transition-transform duration-300 ease-out md:transition-[width] md:duration-200",
          "w-[264px] md:static md:h-auto md:min-h-screen md:translate-x-0",
          collapsed ? "md:w-14" : "md:w-60",
          mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0",
        )}
      >
        <button
          type="button"
          onClick={onToggleCollapse}
          title={collapsed ? t("nav.expand") : t("nav.collapse")}
          aria-label={collapsed ? t("nav.expand") : t("nav.collapse")}
          className="absolute -right-[13px] top-[50px] z-10 hidden size-[26px] cursor-pointer items-center justify-center rounded-full border border-border bg-card text-muted-foreground shadow-sm transition-colors hover:border-primary hover:bg-primary hover:text-primary-foreground md:flex"
        >
          {collapsed ? <ChevronRight className="size-4" /> : <ChevronLeft className="size-4" />}
        </button>

        <Link to={ROUTES.HOME} className="flex h-16 shrink-0 items-center gap-[11px] border-b border-border px-4">
          {collapsed ? (
            <PharmagestIcon className="size-[26px] text-primary md:mx-auto" />
          ) : (
            <PharmagestWordmark iconSize={26} />
          )}
        </Link>

        <nav className="flex flex-1 flex-col gap-3.5 overflow-auto p-2.5">
          {groups.map((group, gi) => (
            <div key={group.title ?? gi} className="flex flex-col gap-0.5">
              {group.title && (
                <span
                  className={`px-3 pb-0.5 pt-1 text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground ${collapsed ? "md:hidden" : ""}`}
                >
                  {t(group.title)}
                </span>
              )}
              {group.items.map((item) => (
                <NavRow key={item.to} item={item} collapsed={collapsed} badge={badges[item.to]} />
              ))}
            </div>
          ))}
        </nav>

        <div className="flex shrink-0 flex-col gap-0.5 border-t border-border p-2.5">
          {(role === ROLES.ADMIN || !SETTINGS_ITEM.feature || permissions.includes(SETTINGS_ITEM.feature)) && (
            <NavRow item={SETTINGS_ITEM} collapsed={collapsed} />
          )}
          <NavRow item={ACCOUNT_ITEM} collapsed={collapsed} />
          <Tooltip label={collapsed ? t("header.logout") : ""} placement="right" className="relative block">
            <button
              type="button"
              onClick={() => handleLogout()}
              className={cn(itemClasses(false, collapsed), "w-full cursor-pointer")}
            >
              <LogOut className="size-[18px] shrink-0" aria-hidden />
              <span className={collapsed ? "md:hidden" : ""}>{t("header.logout")}</span>
            </button>
          </Tooltip>
        </div>
      </aside>
    </>
  );
}

/**
 * Bottom-right widget (in the corner stack of `AppLayout`, under the Sobrus card) — renders one
 * card per non-dismissed job on EVERY route, including /upload-file. With concurrency=1 we typically see: 1
 * running + N queued + recent successes fading out. Auto-dismiss for
 * "success" is owned by UploadContext (per-job timer); cancelled/error stay
 * until the user closes them.
 *
 * The wizard at /upload-file shows ONE doc-type's job inline as a bigger
 * card — that's the same data as one of the widget cards, intentional
 * duplication for full visibility per the user's request.
 *
 * Click a card body → /upload-file?type=<docType> so the wizard rehydrates
 * onto the matching job.
 */

const TYPE_LABEL: Record<DocType, string> = {
  achat: "upload.typeAchat",
  vente: "upload.typeVente",
  stock: "upload.typeStock",
};

/** Cap visible cards — older finished ones drop off the bottom of the stack.
 *  Auto-dismiss already trims successful ones; this is the floor for everything
 *  else (queue length, cancelled, errored). */
const MAX_VISIBLE = 3;

function UploadProgressWidget() {
  const t = useT();
  const { jobs: all, cancelUpload, dismissJob } = useUploadCtx();
  const nav = useNavigate();
  // Files imported together leave the corner 4 s after their success (their wizard list keeps them).
  const jobs = all.filter((j) => !j.hidden);

  if (jobs.length === 0) return null;

  // Queued jobs sorted FIFO so we can label them "1ᵉʳ en file / 2e / …".
  const queuedOrdered = jobs.filter((j) => j.phase === "queued").sort((a, b) => a.createdAt - b.createdAt);

  // Newest first in the visual stack so the running job stays at the top while
  // pending ones pile up below.
  const visible = [...jobs].sort((a, b) => b.createdAt - a.createdAt).slice(0, MAX_VISIBLE);

  return (
    <div role="status" aria-live="polite" className="flex flex-col gap-2">
      {visible.map((job) => (
        <JobCard
          key={job.id}
          job={job}
          queuePosition={job.phase === "queued" ? queuedOrdered.indexOf(job) + 1 : null}
          onOpenWizard={() => nav(`${ROUTES.UPLOAD_FILE}?type=${job.docType}`)}
          onCancel={() => cancelUpload(job.id)}
          onDismiss={() => dismissJob(job.id)}
        />
      ))}
      {jobs.length > MAX_VISIBLE && (
        <button
          type="button"
          onClick={() => nav(`${ROUTES.UPLOAD_FILE}?type=${visible[visible.length - 1].docType}`)}
          className="cursor-pointer self-end rounded-full border border-border bg-card px-3 py-1 text-xs font-semibold text-muted-foreground shadow-md hover:text-foreground"
        >
          {t("upload.moreJobs", { n: jobs.length - MAX_VISIBLE })}
        </button>
      )}
    </div>
  );
}

function JobCard({
  job,
  queuePosition,
  onOpenWizard,
  onCancel,
  onDismiss,
}: {
  job: UploadJob;
  queuePosition: number | null;
  onOpenWizard: () => void;
  onCancel: () => void;
  onDismiss: () => void;
}) {
  const t = useT();
  const tint = `var(--color-doc-${job.docType})`;
  const tintBg = `var(--color-doc-${job.docType}-bg)`;
  const border = `var(--color-doc-${job.docType}-border)`;
  const pct = job.progress.total ? Math.round((job.progress.current / job.progress.total) * 100) : 0;

  return (
    <div className="rounded-2xl border bg-card shadow-lg" style={{ borderColor: border }}>
      <button
        type="button"
        onClick={onOpenWizard}
        className="flex w-full cursor-pointer items-center gap-3 px-4 pt-3 text-left"
      >
        <div className="flex size-9 items-center justify-center rounded-xl" style={{ background: tintBg, color: tint }}>
          {job.phase === "uploading" ? (
            <Loader2 className="size-4 animate-spin" />
          ) : job.phase === "success" ? (
            <CheckCircle2 className="size-4" />
          ) : job.phase === "queued" ? (
            <Clock className="size-4" />
          ) : (
            <FileSpreadsheet className="size-4" />
          )}
        </div>
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t(TYPE_LABEL[job.docType])}
            </span>
            {job.phase === "uploading" && (
              <span className="font-mono text-[10px] tabular-nums text-muted-foreground">
                {t("upload.lot", { current: job.progress.current, total: job.progress.total })}
              </span>
            )}
            {job.phase === "queued" && queuePosition != null && (
              <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                {queuePosition === 1 ? t("upload.firstInQueue") : t("upload.nInQueue", { n: queuePosition })}
              </span>
            )}
          </div>
          <span className="truncate text-sm font-medium text-foreground" title={job.filename}>
            {job.filename}
          </span>
        </div>
      </button>

      {job.phase === "uploading" && (
        <div className="space-y-2 px-4 pb-3 pt-2">
          <div className="h-1.5 overflow-hidden rounded-full bg-surface-subtle">
            <span
              className="block h-full rounded-full transition-[width] duration-300"
              style={{ width: `${pct}%`, background: tint }}
            />
          </div>
          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
            <span>
              {pct}% · {formatQty(job.progress.inserted)} {t("upload.inserted")}
            </span>
            <button
              type="button"
              onClick={onCancel}
              className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-destructive/30 px-2 py-0.5 font-semibold text-destructive hover:bg-destructive/5"
            >
              <Ban className="size-3" />
              {t("common.cancel")}
            </button>
          </div>
        </div>
      )}

      {job.phase === "queued" && (
        <div className="flex items-center justify-between px-4 pb-3 pt-1 text-[11px] text-muted-foreground">
          <span>{t("upload.waiting")}</span>
          <button
            type="button"
            onClick={onCancel}
            aria-label={t("upload.removeFromQueue")}
            className="cursor-pointer text-muted-foreground hover:text-foreground"
          >
            <X className="size-3.5" />
          </button>
        </div>
      )}

      {job.phase === "success" && (
        <p className="px-4 pb-3 text-xs text-muted-foreground">
          {formatQty(job.progress.inserted)} {t("upload.linesImported")}
          {job.progress.skipped > 0 ? (
            <>
              {" "}
              · {formatQty(job.progress.skipped)} {t("upload.skipped")}
            </>
          ) : null}
        </p>
      )}

      {job.phase === "cancelled" && (
        <div className="flex items-center justify-between px-4 pb-3 text-xs">
          <span className="text-warning">{t("upload.cancelled")}</span>
          <button
            type="button"
            onClick={onDismiss}
            aria-label={t("common.close")}
            className="cursor-pointer text-muted-foreground hover:text-foreground"
          >
            <X className="size-3.5" />
          </button>
        </div>
      )}

      {job.phase === "error" && (
        <div className="flex items-start justify-between gap-2 px-4 pb-3 text-xs">
          <span className="text-error">{job.error ?? t("upload.importError")}</span>
          <button
            type="button"
            onClick={onDismiss}
            aria-label={t("common.close")}
            className="shrink-0 cursor-pointer text-muted-foreground hover:text-foreground"
          >
            <X className="size-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}

const COLLAPSE_KEY = "pg-sidebar-collapsed";

export function AppLayout() {
  const { me, isLoading, isError } = useMe();
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem(COLLAPSE_KEY) === "1");
  const [mobileOpen, setMobileOpen] = useState(false);

  if (isLoading) return null;
  if (isError || !me) return <Navigate to={ROUTES.LOGIN} replace />;
  // « Connexion Sobrus » (an access the admin gives): owners with it see its problems (banner) and runs (corner card).
  const sobrusOwner = me.role === ROLES.OWNER && me.permissions.includes("sobrus");

  const toggleCollapse = () => {
    setCollapsed((c) => {
      const next = !c;
      localStorage.setItem(COLLAPSE_KEY, next ? "1" : "0");
      return next;
    });
  };

  return (
    <div className="flex h-screen bg-background">
      <Sidebar
        role={me.role}
        permissions={me.permissions}
        pending={me.status === STATUSES.PENDING}
        collapsed={collapsed}
        onToggleCollapse={toggleCollapse}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <Header onOpenMobile={() => setMobileOpen(true)} />
        <main className="flex-1 overflow-auto p-7">
          {/* « Connexion Sobrus » stopped working: owners with that access see it on every page. */}
          {sobrusOwner && <SobrusBanner />}
          {/* Pages load on first visit (App.tsx lazy): sidebar + header stay meanwhile. */}
          <Suspense fallback={<PageLoading />}>
            <Outlet />
          </Suspense>
        </main>
      </div>
      {/* Bottom-right, on every page: the Sobrus robot's run, then the files being imported. */}
      <div className="fixed bottom-4 right-4 z-50 flex w-[320px] flex-col gap-2">
        {sobrusOwner && <SobrusRunCard />}
        <UploadProgressWidget />
      </div>
    </div>
  );
}

/** Placeholder while a page's code downloads (first visit only): page title + body. */
function PageLoading() {
  return (
    <div className="flex flex-col gap-5">
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-28 w-full" />
      <Skeleton className="h-72 w-full" />
    </div>
  );
}
