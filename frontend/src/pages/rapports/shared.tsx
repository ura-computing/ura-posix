import { Skeleton } from "@/components/ui/skeleton";

export const CAT_COLORS = [
  "#14b8a6", "#8b5cf6", "#3b82f6", "#f59e0b", "#f43f5e",
  "#06b6d4", "#ec4899", "#84cc16", "#f97316", "#6366f1",
  "#10b981", "#a855f6", "#0ea5e9", "#eab308", "#ef4444",
  "#22d3ee", "#d946ef", "#a3e635", "#fb923c", "#818cf8",
];

const MONTH_LABELS: Record<string, string> = {
  "01": "Jan", "02": "Fév", "03": "Mar", "04": "Avr",
  "05": "Mai", "06": "Jun", "07": "Jul", "08": "Aoû",
  "09": "Sep", "10": "Oct", "11": "Nov", "12": "Déc",
};

export function shortMonth(m: string) {
  const [yy, mm] = m.split("-");
  const monthName = MONTH_LABELS[mm] ?? m;
  return `${monthName} ${yy?.slice(2) ?? ""}`;
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function KpiSkeleton({ primary }: { primary?: boolean }) {
  return <Skeleton className={`h-8 w-28 mt-1 ${primary ? "bg-white/20" : ""}`} />;
}
