import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export type ExportColumn = {
  key: string;
  header: string;
  /** Optional cell coercion to a plain string/number — defaults to row[key]. */
  value?: (row: Record<string, unknown>) => string | number | null | undefined;
  align?: "left" | "right";
};

export type ExportRow = Record<string, unknown>;

function cellValue(col: ExportColumn, row: ExportRow): string | number | null | undefined {
  const v = col.value ? col.value(row) : (row[col.key] as string | number | null | undefined);
  if (v == null) return "";
  return v;
}

/** Build a `.xlsx` and trigger a browser download. */
export function exportToXlsx(filename: string, columns: ExportColumn[], rows: ExportRow[]): void {
  const header = columns.map((c) => c.header);
  const body = rows.map((r) => columns.map((c) => cellValue(c, r) ?? ""));
  const ws = XLSX.utils.aoa_to_sheet([header, ...body]);

  // Auto-size columns based on the longest visible value.
  ws["!cols"] = columns.map((c, i) => {
    const max = Math.max(
      c.header.length,
      ...body.map((row) => String(row[i] ?? "").length),
    );
    return { wch: Math.min(Math.max(max + 2, 8), 60) };
  });

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Export");
  XLSX.writeFile(wb, filename.endsWith(".xlsx") ? filename : `${filename}.xlsx`);
}

/** Build a landscape A4 `.pdf` table and trigger a download. */
export function exportToPdf(
  filename: string,
  title: string,
  columns: ExportColumn[],
  rows: ExportRow[],
): void {
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });

  doc.setFontSize(14);
  doc.text(title, 40, 30);
  doc.setFontSize(9);
  doc.setTextColor(120);
  doc.text(`${rows.length} ligne${rows.length > 1 ? "s" : ""}`, 40, 46);
  doc.setTextColor(0);

  autoTable(doc, {
    head: [columns.map((c) => c.header)],
    body: rows.map((r) =>
      columns.map((c) => {
        const v = cellValue(c, r);
        return v === "" || v == null ? "—" : String(v);
      }),
    ),
    startY: 56,
    styles: { fontSize: 8, cellPadding: 4 },
    headStyles: { fillColor: [20, 184, 166], textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: Object.fromEntries(
      columns.map((c, i) => [i, { halign: c.align === "right" ? "right" : "left" }]),
    ),
  });

  doc.save(filename.endsWith(".pdf") ? filename : `${filename}.pdf`);
}
