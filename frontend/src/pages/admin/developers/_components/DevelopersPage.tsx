import { Plus, RefreshCw, UserCog } from "lucide-react";

import { useT } from "@/i18n/I18nProvider";
import { KebabItem, KebabMenu } from "@/_components/molecules/KebabMenu";
import { Button } from "@/_components/atoms/Button";
import { Card } from "@/_components/atoms/Card";
import { SearchInput } from "@/_components/atoms/Input";
import { type DeveloperAccount, type DeveloperStatus } from "@/types/storeWebsite";

import { formatRelative } from "@/pages/store/store-website/_format";
import { EmptyState } from "@/_components/molecules/EmptyState";
import { Callout } from "@/_components/molecules/Callout";
import { Badge } from "@/_components/atoms/Badge";

/** i18n key per developer status — the source enum values ("actif" | …) stay
 *  as logic; only the displayed label is translated. */
const STATUS_KEY: Record<DeveloperStatus, string> = {
  actif: "developers.statusActif",
  en_attente: "developers.statusEnAttente",
  desactive: "developers.statusDesactive",
};

/** /admin/developers — admin user-management page for developer accounts.
 *
 *  UI shape mirrors /imports + /admin/pharmacies: header + filter row +
 *  rounded-2xl card with bg-surface-subtle thead + hover-able rows +
 *  dashed empty state. Page wrapper is the standard `flex flex-col gap-6`
 *  — AppLayout already provides `p-7`. */

export interface DevelopersPageProps {
  developers: DeveloperAccount[];
  isLoading?: boolean;
  isError?: boolean;
  search: string;
  onSearch: (q: string) => void;
  onInvite: () => void;
  onResetPassword: (id: string) => void;
  onToggleActive: (id: string, activate: boolean) => void;
  onRetry?: () => void;
}

export function DevelopersPage(props: DevelopersPageProps) {
  const t = useT();
  const { developers, isLoading, isError, search } = props;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">{t("developers.title")}</h1>
          <p className="text-sm text-muted-foreground">{t("developers.subtitle")}</p>
        </div>
        <Button onClick={props.onInvite}>
          <Plus className="size-4" />
          {t("developers.invite")}
        </Button>
      </header>

      <SearchInput value={search} onValueChange={props.onSearch} placeholder={t("developers.searchPlaceholder")} />

      {isError ? (
        <Callout
          tone="error"
          action={
            <Button variant="secondary" onClick={props.onRetry}>
              <RefreshCw className="size-3.5" />
              {t("common.retry")}
            </Button>
          }
        >
          {t("developers.loadError")}
        </Callout>
      ) : isLoading ? (
        <TableSkeleton />
      ) : developers.length === 0 ? (
        <NoDeveloper onInvite={props.onInvite} />
      ) : (
        <Card as="div" padding="none">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-subtle text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-2.5">{t("developers.colName")}</th>
                <th className="px-4 py-2.5">{t("col.statut")}</th>
                <th className="px-4 py-2.5 text-right">{t("developers.colActiveRequests")}</th>
                <th className="px-4 py-2.5">{t("developers.colLastActive")}</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {developers.map((d) => (
                <tr
                  key={d.id}
                  className="border-b border-border last:border-0 transition-colors hover:bg-surface-subtle/50"
                >
                  <td className="px-4 py-3">
                    <div className="flex flex-col">
                      <span className="font-medium text-foreground">{d.name}</span>
                      <span className="text-xs text-muted-foreground">{d.email}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={d.status} />
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-sm tabular-nums text-foreground">
                    {d.activeRequests}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs tabular-nums text-muted-foreground">
                    {d.lastActiveAt ? formatRelative(d.lastActiveAt) : "—"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <KebabMenu>
                      {(close) => (
                        <>
                          <KebabItem onSelect={() => props.onResetPassword(d.id)} close={close}>
                            {t("developers.resetPassword")}
                          </KebabItem>
                          {d.status === "desactive" ? (
                            <KebabItem onSelect={() => props.onToggleActive(d.id, true)} close={close}>
                              {t("developers.activateAccount")}
                            </KebabItem>
                          ) : (
                            <KebabItem danger onSelect={() => props.onToggleActive(d.id, false)} close={close}>
                              {t("developers.deactivateAccount")}
                            </KebabItem>
                          )}
                        </>
                      )}
                    </KebabMenu>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: DeveloperStatus }) {
  const t = useT();
  const tone = status === "actif" ? "success" : status === "en_attente" ? "warning" : "neutral";
  return (
    <Badge tone={tone} dot>
      {t(STATUS_KEY[status])}
    </Badge>
  );
}

function NoDeveloper({ onInvite }: { onInvite: () => void }) {
  const t = useT();
  return (
    <EmptyState
      icon={<UserCog className="size-6" />}
      title={t("developers.empty")}
      action={
        <Button onClick={onInvite}>
          <Plus className="size-4" />
          {t("developers.invite")}
        </Button>
      }
    />
  );
}

function TableSkeleton() {
  return (
    <Card as="div" padding="none">
      <div className="h-11 border-b border-border bg-surface-subtle" />
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 border-b border-border px-4 py-3.5 last:border-0">
          <div className="h-4 flex-1 animate-pulse rounded bg-muted" />
          <div className="h-4 w-20 animate-pulse rounded bg-muted" />
          <div className="h-4 w-24 animate-pulse rounded bg-muted" />
        </div>
      ))}
    </Card>
  );
}
