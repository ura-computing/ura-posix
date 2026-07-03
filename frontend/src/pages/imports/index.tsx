import { useMemo, useState } from "react";
import { Loader2, Trash2, TriangleAlert } from "lucide-react";

import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { TabBar } from "@/components/shared/TabBar";
import type { TabItem } from "@/components/shared/TabBar";
import { formatQty } from "@/utils/format";
import type { DataImport, DocType, ImportBatchStatus } from "@/types";

import { useDeleteImport, useImports } from "./_hooks/useImports";


const TABS: TabItem[] = [{ id: "imports", label: "Imports" }];

const TYPE_LABEL: Record<DocType, string> = { achat: "Achats", vente: "Ventes", stock: "Stock" };

const STATUS_TINT: Record<ImportBatchStatus, { bg: string; fg: string; label: string }> = {
  in_progress: { bg: "bg-info-subtle",    fg: "text-info",    label: "En cours"   },
  success:     { bg: "bg-success-subtle", fg: "text-success", label: "Réussi"     },
  cancelled:   { bg: "bg-warning-subtle", fg: "text-warning", label: "Annulé"     },
  error:       { bg: "bg-error-subtle",   fg: "text-error",   label: "Erreur"     },
};


function relativeDate(iso: string): string {
  const diffSec = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diffSec < 60)     return "à l'instant";
  if (diffSec < 3600)   return `il y a ${Math.floor(diffSec / 60)} min`;
  if (diffSec < 86_400) return `il y a ${Math.floor(diffSec / 3600)} h`;
  return `il y a ${Math.floor(diffSec / 86_400)} j`;
}


export default function ImportsPage() {
  const [active, setActive] = useState("imports");

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Gestion des imports</h1>
        <p className="text-sm text-muted-foreground">Consultez et gérez l'historique de vos imports.</p>
      </header>
      <TabBar tabs={TABS} activeId={active} onChange={setActive} />
      <div>{active === "imports" && <ImportsTab />}</div>
    </div>
  );
}


function ImportsTab() {
  const { imports, isLoading } = useImports();
  const { deleteImport, isPending } = useDeleteImport();
  const [pendingRow, setPendingRow] = useState<DataImport | null>(null);

  const sorted = useMemo(
    () => [...imports].sort((a, b) => b.imported_at.localeCompare(a.imported_at)),
    [imports],
  );

  if (isLoading) {
    return <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Chargement…</div>;
  }
  if (sorted.length === 0) {
    return <div className="rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">Aucun import pour l'instant.</div>;
  }

  const confirmCopy = pendingRow
    ? pendingRow.file_type === "stock"
      ? `Marquer l'import « ${pendingRow.filename ?? "sans nom"} » comme supprimé ? Les niveaux de stock importés resteront en base — un import UPSERT ne peut pas être défait.`
      : `Supprimer définitivement l'import « ${pendingRow.filename ?? "sans nom"} » ? Les ${pendingRow.rows_inserted} ligne(s) importée(s) seront retirées et l'entrée sera marquée comme supprimée.`
    : "";

  return (
    <>
      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-surface-subtle text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <th className="px-4 py-2.5">Date</th>
              <th className="px-4 py-2.5">Type</th>
              <th className="px-4 py-2.5">Fichier</th>
              <th className="px-4 py-2.5">Importé par</th>
              <th className="px-4 py-2.5 text-right">Lignes</th>
              <th className="px-4 py-2.5">Statut</th>
              <th className="px-4 py-2.5"></th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((row) => {
              const isDeleted = row.deleted_at !== null;
              const status = STATUS_TINT[row.status];
              return (
                <tr
                  key={row.id}
                  className={`border-b border-border last:border-0 ${isDeleted ? "bg-surface-subtle/40" : "hover:bg-surface-subtle/50"}`}
                >
                  <td className="px-4 py-3 font-mono text-xs tabular-nums text-muted-foreground">
                    {new Date(row.imported_at).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className="inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium"
                      style={{
                        background: `var(--color-doc-${row.file_type}-bg)`,
                        color:      `var(--color-doc-${row.file_type})`,
                      }}
                    >
                      {TYPE_LABEL[row.file_type]}
                    </span>
                  </td>
                  <td
                    className={`max-w-[280px] truncate px-4 py-3 ${isDeleted ? "text-muted-foreground line-through" : "text-foreground"}`}
                    title={row.filename ?? ""}
                  >
                    {row.filename ?? <span className="italic text-muted-foreground">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    {row.created_by_full_name || row.created_by_email ? (
                      <div className="flex flex-col leading-tight">
                        <span className="text-foreground">{row.created_by_full_name ?? row.created_by_email}</span>
                        {row.created_by_full_name && row.created_by_email && (
                          <span className="text-xs text-muted-foreground">{row.created_by_email}</span>
                        )}
                      </div>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right text-xs tabular-nums">
                    <span className={isDeleted ? "text-muted-foreground" : "text-foreground"}>{formatQty(row.rows_inserted)}</span>
                    {row.rows_skipped > 0 && (
                      <span className="ml-1 text-muted-foreground">· {formatQty(row.rows_skipped)} ignorées</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {isDeleted ? (
                      <span className="inline-flex items-center gap-1 rounded-md bg-warning-subtle px-2 py-0.5 text-xs font-medium text-warning">
                        <TriangleAlert className="size-3" />
                        Supprimé par {row.deleted_by_full_name ?? row.deleted_by_email ?? "—"} · {relativeDate(row.deleted_at!)}
                      </span>
                    ) : (
                      <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${status.bg} ${status.fg}`}>
                        {status.label}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {!isDeleted && (
                      <button
                        type="button"
                        onClick={() => setPendingRow(row)}
                        className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-destructive/30 px-2 py-1 text-xs font-medium text-destructive hover:bg-destructive/5"
                      >
                        <Trash2 className="size-3.5" />
                        Supprimer
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <ConfirmDialog
        open={pendingRow !== null}
        onClose={() => setPendingRow(null)}
        onConfirm={() => {
          if (!pendingRow) return;
          deleteImport(pendingRow.id, { onSuccess: () => setPendingRow(null) });
        }}
        title={pendingRow?.file_type === "stock" ? "Marquer cet import comme supprimé ?" : "Supprimer cet import ?"}
        description={confirmCopy}
        variant="destructive"
        confirmLabel={pendingRow?.file_type === "stock" ? "Marquer supprimé" : "Supprimer"}
        loadingLabel="Suppression…"
        isLoading={isPending}
      />
    </>
  );
}
