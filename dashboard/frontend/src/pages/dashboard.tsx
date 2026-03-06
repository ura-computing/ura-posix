import { useState } from "react";
import { format, subDays, startOfMonth } from "date-fns";
import { fr } from "date-fns/locale";
import type { DateRange } from "react-day-picker";

import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import {
  MOCK_KPIS,
  MOCK_INVOICE_ROWS,
  formatCurrency,
} from "@/data/mock-dashboard";
import { CalendarIcon, Pencil, ShoppingCart, Package, TriangleAlert, TrendingUp, UploadCloud, X } from "lucide-react";
import { Link } from "react-router";
import { cn } from "@/lib/utils";

const Dashboard = () => {
  const kpis = MOCK_KPIS;
  const rows = MOCK_INVOICE_ROWS;
  const today = new Date();

  const [range, setRange] = useState<DateRange | undefined>();
  const [calOpen, setCalOpen] = useState(false);

  const applyPreset = (preset: "today" | "7d" | "month") => {
    if (preset === "today") setRange({ from: today, to: today });
    else if (preset === "7d") setRange({ from: subDays(today, 6), to: today });
    else setRange({ from: startOfMonth(today), to: today });
    setCalOpen(false);
  };

  const rangeLabel = range?.from
    ? range.to && range.to.getTime() !== range.from.getTime()
      ? `${format(range.from, "d MMM", { locale: fr })} – ${format(range.to, "d MMM yyyy", { locale: fr })}`
      : format(range.from, "d MMMM yyyy", { locale: fr })
    : "Sélectionner une période";

  const hasRange = !!range?.from;

  return (
    <div className="space-y-6">
      {/* Date range filter */}
      <div className="flex items-center gap-3 flex-wrap rounded-xl border border-border bg-card px-4 py-3">
        <span className="text-sm font-medium text-muted-foreground whitespace-nowrap">Période :</span>

        <Popover open={calOpen} onOpenChange={setCalOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                "h-9 gap-2 text-sm font-normal min-w-[200px] justify-start",
                hasRange && "border-primary text-primary"
              )}
            >
              <CalendarIcon className="h-4 w-4 shrink-0 opacity-60" />
              <span className="truncate">{rangeLabel}</span>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start" sideOffset={6}>
            <div className="flex items-center gap-1 px-3 py-2 border-b">
              <Button size="sm" variant="ghost" className="h-7 text-xs rounded-md" onClick={() => applyPreset("today")}>
                Aujourd'hui
              </Button>
              <Button size="sm" variant="ghost" className="h-7 text-xs rounded-md" onClick={() => applyPreset("7d")}>
                7 derniers jours
              </Button>
              <Button size="sm" variant="ghost" className="h-7 text-xs rounded-md" onClick={() => applyPreset("month")}>
                Ce mois
              </Button>
            </div>
            <Calendar
              mode="range"
              selected={range}
              onSelect={(r) => { setRange(r); if (r?.to) setCalOpen(false); }}
              numberOfMonths={2}
              locale={fr}
              disabled={{ after: today }}
              initialFocus
            />
          </PopoverContent>
        </Popover>

        {hasRange && (
          <>
            <Separator orientation="vertical" className="h-5" />
            <Button
              variant="ghost"
              size="sm"
              className="h-9 gap-1.5 text-muted-foreground hover:text-foreground"
              onClick={() => setRange(undefined)}
            >
              <X className="h-3.5 w-3.5" />
              Effacer
            </Button>
          </>
        )}
      </div>

      <section>
        <h2 className="text-lg font-semibold text-foreground">Aperçu Rapide</h2>
        <p className="text-sm text-muted-foreground mb-4">Résumé de l'activité du jour</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="bg-teal-500 text-white border-0 overflow-hidden">
            <CardContent className="p-6">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-[11px] font-medium text-white/85">Ventes du Jour</p>
                  <p className="text-3xl font-bold mt-1 leading-tight">
                    {formatCurrency(kpis.salesToday.amount).replace(" MAD", "")}
                  </p>
                  <p className="text-[11px] text-white/75">MAD</p>
                  <p className="text-[11px] text-white/70 mt-2 flex items-center gap-1">
                    <TrendingUp className="h-3 w-3" />
                    {kpis.salesToday.trend.comparison}
                  </p>
                </div>
                <TrendingUp className="h-8 w-8 text-white/60 shrink-0" />
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-xl border border-border">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-medium text-muted-foreground">produit para</p>
                  <p className="text-3xl font-bold mt-1 leading-tight">{kpis.productPara.value}</p>
                  <p className="text-[11px] text-teal-600 flex items-center gap-1 mt-1">
                    <TrendingUp className="h-3 w-3" />
                    {kpis.productPara.trend.value}% {kpis.productPara.trend.comparison}
                  </p>
                </div>
                <ShoppingCart className="h-8 w-8 text-teal-500" />
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-xl border border-border">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-medium text-muted-foreground">Produits pharma</p>
                  <p className="text-3xl font-bold mt-1 leading-tight">{kpis.productPharma.value}</p>
                </div>
                <Package className="h-8 w-8 text-teal-500" />
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-xl border border-border">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-medium text-muted-foreground">pahrama sspec</p>
                  <p className="text-3xl font-bold mt-1 leading-tight">{kpis.pharmaSpec.value}</p>
                  {kpis.pharmaSpec.subtitle && (
                    <p className="text-[11px] text-muted-foreground mt-1">{kpis.pharmaSpec.subtitle}</p>
                  )}
                </div>
                <TriangleAlert className="h-8 w-8 text-teal-500" />
              </div>
            </CardContent>
          </Card>
        </div>
        <Link
          to="/dashboard/upload-file"
          className="inline-flex items-center gap-2 mt-4 text-sm font-medium text-primary hover:underline"
        >
          <UploadCloud className="h-4 w-4" />
          Upload your file
        </Link>
      </section>

      <section>
        <Card className="rounded-xl border border-border">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                <TableHead className="w-12">
                  <Checkbox aria-label="Tout sélectionner" />
                </TableHead>
                <TableHead>Avatar & Text</TableHead>
                <TableHead>facture number</TableHead>
                <TableHead className="w-24">Tag</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>
                    <Checkbox aria-label={`Sélectionner ${row.invoiceNumber}`} />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className={`text-xs text-white ${row.avatarColor}`}>{row.username.slice(0, 2)}</AvatarFallback>
                      </Avatar>
                      <span className="text-sm font-medium">{row.username}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{row.invoiceNumber}</TableCell>
                  <TableCell>
                    {row.status === "new" && (
                      <Badge className="bg-violet-100 text-violet-600 hover:bg-violet-100 border-0">New tag</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <button
                      type="button"
                      className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground"
                      aria-label="Modifier"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </section>
    </div>
  );
};

export default Dashboard;
