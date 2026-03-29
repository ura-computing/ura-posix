import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent } from "@/components/ui/chart";
import { fmt } from "@/utils/format";

function fmtCompact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}k`;
  return String(n);
}

const chartConfig = {
  ventes: { label: "Ventes", color: "#14b8a6" },
  achats: { label: "Achats", color: "#8b5cf6" },
};

type TrendItem = { month: string; ventes: number; achats: number; label: string };

export function MonthlyTrendChart({
  trend,
  isLoading,
  subtitle,
}: {
  trend: TrendItem[];
  isLoading: boolean;
  subtitle?: string;
}) {
  const hasData = trend.some((t) => t.ventes > 0 || t.achats > 0);

  return (
    <Card className="border border-border">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">Évolution mensuelle</CardTitle>
        <p className="text-xs text-muted-foreground">
          {subtitle ?? "Ventes et achats sur les 12 derniers mois"}
        </p>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-64 w-full" />
        ) : trend.length === 0 || !hasData ? (
          <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
            Aucune donnée pour cette période
          </div>
        ) : (
          <ChartContainer config={chartConfig} className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={trend} barGap={4} barCategoryGap="28%">
                <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeDasharray="3 3" />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))", fontWeight: 500 }}
                  axisLine={false}
                  tickLine={false}
                  height={36}
                />
                <YAxis
                  tickFormatter={(v) => fmtCompact(v as number)}
                  tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                  axisLine={false}
                  tickLine={false}
                  width={52}
                />
                <ChartTooltip content={<ChartTooltipContent formatter={(v) => fmt(v as number)} />} />
                <ChartLegend content={<ChartLegendContent />} />
                <Bar dataKey="ventes" fill="#14b8a6" radius={[4, 4, 0, 0]} maxBarSize={20} />
                <Bar dataKey="achats" fill="#8b5cf6" radius={[4, 4, 0, 0]} maxBarSize={20} />
              </BarChart>
            </ResponsiveContainer>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}
