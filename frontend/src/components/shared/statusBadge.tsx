import { Clock, CheckCircle2, XCircle } from "lucide-react";
import { cn } from "@/utils/cn";
import { eUserStatus, eRequestStatus } from "@/types";

// ── User status (active / pending / rejected) ─────────────────────────────────

const USER_STATUS: Record<string, { label: string; className: string }> = {
  [eUserStatus.ACTIVE]:   { label: "Actif",      className: "bg-green-100 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-300 dark:border-green-800" },
  [eUserStatus.PENDING]:  { label: "En attente", className: "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800" },
  [eUserStatus.REJECTED]: { label: "Refusé",    className: "bg-red-100 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-300 dark:border-red-800" },
};

export function UserStatusBadge({ status }: { status: string }) {
  const cfg = USER_STATUS[status] ?? USER_STATUS[eUserStatus.PENDING];
  return (
    <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium", cfg.className)}>
      {cfg.label}
    </span>
  );
}

// ── Request status (pending / approved / rejected) ────────────────────────────

export function RequestStatusBadge({ status }: { status: `${eRequestStatus}` }) {
  if (status === eRequestStatus.APPROVED) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-400">
        <CheckCircle2 className="h-3 w-3" />
        Approuvé
      </span>
    );
  }
  if (status === eRequestStatus.REJECTED) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-400">
        <XCircle className="h-3 w-3" />
        Refusé
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-400">
      <Clock className="h-3 w-3" />
      En attente
    </span>
  );
}
