import { BarChart, Bar, XAxis, CartesianGrid, ResponsiveContainer } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { fmt } from "@/lib/table-utils";

const chartConfig = {
  ventes: { label: "Ventes", color: "hsl(var(--primary))" },
  achats: { label: "Achats", color: "hsl(var(--muted-foreground))" },
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
          <Skeleton className="h-48 w-full" />
        ) : trend.length === 0 || !hasData ? (
          <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
            Aucune donnée pour cette période
          </div>
        ) : (
          <ChartContainer config={chartConfig} className="h-48 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={trend} barGap={2}>
                <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeDasharray="3 3" />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                  axisLine={false}
                  tickLine={false}
                />
                <ChartTooltip content={<ChartTooltipContent formatter={(v) => fmt(v as number)} />} />
                <Bar dataKey="ventes" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} maxBarSize={18} />
                <Bar dataKey="achats" fill="hsl(var(--muted-foreground))" radius={[3, 3, 0, 0]} maxBarSize={18} opacity={0.5} />
              </BarChart>
            </ResponsiveContainer>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}
