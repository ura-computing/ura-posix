export function getPharmacySuffix(
  category: string | null,
  suffixes: { category: string; suffix: string }[],
): string {
  if (!category || suffixes.length === 0) return "";
  const normalized = category.replace(/\s*\([\d.]+%\)/, "").trim().toLowerCase();
  const match = suffixes.find((s) => normalized === s.category.toLowerCase());
  return match?.suffix ?? "";
}

export function downloadCSV(
  rows: Record<string, unknown>[],
  rowToCSV: (r: Record<string, unknown>) => string[],
  headers: string[],
  filename: string,
) {
  const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const lines = [headers, ...rows.map(rowToCSV)]
    .map((row) => row.map(escape).join(";"))
    .join("\n");
  const blob = new Blob(["\ufeff" + lines], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
