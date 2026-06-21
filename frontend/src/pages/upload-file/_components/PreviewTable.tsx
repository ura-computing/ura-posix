import { formatQty } from "@/utils/format";


interface PreviewTableProps {
  headers:    string[];
  rows:       Record<string, string>[];      // up to 8
  totalRows:  number;
  filename:   string;
  fileDates:  { from: string; to: string } | null;
}


/**
 * Step-3 preview. Shows the parsed Sobrus CSV's header + first 8 rows so the
 * user can sanity-check before clicking Import. Date range from the filename
 * is shown in a Calendar pill above the table.
 */

export function PreviewTable({ headers, rows, totalRows, filename, fileDates }: PreviewTableProps) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <h2 className="text-sm font-semibold text-foreground">
            Aperçu — {Math.min(rows.length, 8)} lignes affichées sur {formatQty(totalRows)}
          </h2>
          <span className="rounded-md bg-surface-subtle px-2 py-0.5 font-mono text-[11px] text-muted-foreground self-start">
            {filename}
          </span>
        </div>
        {fileDates && (
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs text-foreground">
            <CalendarIcon />
            Période : {fmtFR(fileDates.from)} → {fmtFR(fileDates.to)}
          </span>
        )}
      </div>

      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <table className="w-full border-collapse text-sm">
          <thead className="bg-surface-subtle text-muted-foreground">
            <tr>
              {headers.map((h) => (
                <th key={h} className="border-b border-border px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} className={i % 2 === 0 ? "bg-background" : "bg-surface-subtle/40"}>
                {headers.map((h) => (
                  <td key={h} className="max-w-[160px] truncate whitespace-nowrap border-b border-border px-3 py-1.5 text-foreground">
                    {row[h] || <span className="text-muted-foreground">—</span>}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalRows > 8 && (
        <p className="text-xs text-muted-foreground">
          … et {formatQty(totalRows - 8)} lignes supplémentaires seront importées.
        </p>
      )}
    </div>
  );
}


function CalendarIcon() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}


const FR = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", year: "numeric" });
function fmtFR(iso: string): string {
  try { return FR.format(new Date(iso)); } catch { return iso; }
}