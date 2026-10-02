import { Download, Inbox } from "lucide-react";

import { TEMPLATE_LABEL, type ExportRow } from "@/types/storeWebsite";

import { formatRelative } from "../../store-website/_format";


/** /exports — developer's history of past project exports. UI shape mirrors
 *  /imports (rounded-2xl card + bg-surface-subtle thead + border-border row
 *  + dashed empty state). Page wrapper is the standard `flex flex-col gap-6`
 *  — AppLayout already wraps in <main className="p-7"/>. */

function formatSize(bytes: number): string {
  return (bytes / 1_048_576).toFixed(1).replace(".", ",") + " Mo";
}


export interface ExportsTableProps {
  rows:         ExportRow[];
  isLoading?:   boolean;
  onRedownload: (id: string) => void;
}


export function ExportsTable({ rows, isLoading, onRedownload }: ExportsTableProps) {
  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Mes exports</h1>
        <p className="text-sm text-muted-foreground">Historique des projets générés, par pharmacie.</p>
      </header>

      {isLoading ? (
        <ExportsSkeleton />
      ) : rows.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-subtle text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-2.5">Pharmacie</th>
                <th className="px-4 py-2.5">Modèle</th>
                <th className="px-4 py-2.5">Date</th>
                <th className="px-4 py-2.5 text-right">Taille</th>
                <th className="px-4 py-2.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r.id}
                  className="border-b border-border last:border-0 transition-colors hover:bg-surface-subtle/50"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <span
                        className="size-2.5 shrink-0 rounded-full"
                        style={{ background: r.brandColor }}
                        aria-hidden
                      />
                      <span className="font-medium text-foreground">{r.pharmacyName}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{TEMPLATE_LABEL[r.template]}</td>
                  <td className="px-4 py-3 font-mono text-xs tabular-nums text-muted-foreground">
                    {formatRelative(r.exportedAt)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-xs tabular-nums text-muted-foreground">
                    {formatSize(r.sizeBytes)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => onRedownload(r.id)}
                      className="inline-flex cursor-pointer items-center gap-1.5 text-sm font-semibold text-primary transition-colors hover:text-primary-hover"
                    >
                      <Download className="size-3.5" />
                      Re-télécharger
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}


function EmptyState() {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border p-10 text-center">
      <span className="flex size-12 items-center justify-center rounded-xl bg-surface-subtle text-muted-foreground">
        <Inbox className="size-5" />
      </span>
      <p className="text-sm text-muted-foreground">
        Aucun export pour l'instant. Générez un projet depuis l'éditeur.
      </p>
    </div>
  );
}


function ExportsSkeleton() {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card">
      <div className="h-11 border-b border-border bg-surface-subtle" />
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-3 border-b border-border px-4 py-3.5 last:border-0"
        >
          <div className="size-2.5 shrink-0 animate-pulse rounded-full bg-muted" />
          <div className="h-4 flex-1 animate-pulse rounded bg-muted" />
        </div>
      ))}
    </div>
  );
}
