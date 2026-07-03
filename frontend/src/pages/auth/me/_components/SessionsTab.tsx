import { useState } from "react";
import { Loader2, Monitor } from "lucide-react";

import { AsyncButton } from "@/components/shared/AsyncButton";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { useLogout } from "@/hooks/useLogout";
import type { Me, Session } from "@/types";

// Inline FR relative time. Avoids pulling date-fns in just for one label.
function frRelative(iso: string): string {
  const diffSec = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (diffSec < 60)     return "à l'instant";
  if (diffSec < 3600)   return `il y a ${Math.floor(diffSec / 60)} min`;
  if (diffSec < 86400)  return `il y a ${Math.floor(diffSec / 3600)} h`;
  return `il y a ${Math.floor(diffSec / 86400)} j`;
}

import { useKillSession } from "../_hooks/useKillSession";
import { useRevokeOtherSessions } from "../_hooks/useRevokeOtherSessions";
import { useSessions } from "../_hooks/useSessions";

export function SessionsTab({ me }: { me: Me }) {
  const { sessions, isLoading, isError }                = useSessions(me.id);
  const { handleKill,         pendingId }               = useKillSession(me.id);
  const { handleRevokeOthers, isPending: isRevoking }   = useRevokeOtherSessions(me.id);
  const { handleLogout,       isPending: isLoggingOut } = useLogout();
  const [confirmRevokeOpen, setConfirmRevokeOpen] = useState(false);

  const otherCount = sessions.filter((s) => !s.is_current).length;

  return (
    <div className="flex max-w-[640px] flex-col gap-5">
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Mes sessions actives
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Vous êtes connecté(e) sur ces appareils.
        </p>
      </div>

      {isLoading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Chargement…
        </div>
      )}

      {isError && (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          Impossible de charger les sessions. Réessayez plus tard.
        </p>
      )}

      {!isLoading && !isError && sessions.length === 0 && (
        <p className="rounded-md border border-dashed border-border bg-surface-subtle px-4 py-6 text-sm text-muted-foreground">
          Aucune session active.
        </p>
      )}

      <ul className="flex flex-col gap-2">
        {sessions.map((s) => (
          <SessionRow
            key={s.id}
            s={s}
            isWorking={pendingId === s.id || (s.is_current && isLoggingOut)}
            onLogoutCurrent={handleLogout}
            onKillOther={handleKill}
          />
        ))}
      </ul>

      {otherCount > 0 && (
        <div className="mt-2 flex justify-end">
          <AsyncButton
            variant="destructive"
            isLoading={isRevoking}
            loadingText="Déconnexion…"
            onClick={() => setConfirmRevokeOpen(true)}
          >
            Déconnecter toutes les autres sessions ({otherCount})
          </AsyncButton>
        </div>
      )}

      <ConfirmDialog
        open={confirmRevokeOpen}
        onClose={() => setConfirmRevokeOpen(false)}
        title="Déconnecter toutes les autres sessions ?"
        description="Vous resterez connecté(e) sur cet appareil. Les autres appareils devront se reconnecter."
        confirmLabel="Déconnecter"
        loadingLabel="Déconnexion…"
        variant="destructive"
        isLoading={isRevoking}
        onConfirm={() => { handleRevokeOthers(); setConfirmRevokeOpen(false); }}
      />
    </div>
  );
}

function SessionRow({
  s,
  isWorking,
  onLogoutCurrent,
  onKillOther,
}: {
  s: Session;
  isWorking: boolean;
  onLogoutCurrent: () => void;
  onKillOther:     (id: string) => void;
}) {
  const lastActive = frRelative(s.last_active_at);
  return (
    <li className="flex items-center justify-between gap-3 rounded-md border border-border bg-card px-4 py-3">
      <div className="flex items-center gap-3">
        <Monitor className="size-5 text-muted-foreground" aria-hidden />
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-foreground">{s.device_label}</span>
            {s.is_current && (
              <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[11px] font-semibold text-primary">
                cette session
              </span>
            )}
          </div>
          <span className="text-xs text-muted-foreground">
            {s.ip} · Dernière activité {lastActive}
          </span>
        </div>
      </div>
      <AsyncButton
        variant={s.is_current ? "secondary" : "destructive"}
        isLoading={isWorking}
        loadingText="…"
        onClick={() => (s.is_current ? onLogoutCurrent() : onKillOther(s.id))}
      >
        {s.is_current ? "Se déconnecter" : "Déconnecter"}
      </AsyncButton>
    </li>
  );
}