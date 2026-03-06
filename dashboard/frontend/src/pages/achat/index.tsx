import { useEffect, useMemo, useState } from "react";
import { Check, ChevronDown, CalendarIcon, Download, Search, X } from "lucide-react";
import { ColumnDef } from "@tanstack/react-table";
import { useTable } from "@refinedev/react-table";
import { format, subDays, startOfMonth } from "date-fns";
import { fr } from "date-fns/locale";
import type { DateRange } from "react-day-picker";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ListView } from "@/components/refine-ui/views/list-view";
import { Breadcrumb } from "@/components/refine-ui/layout/breadcrumb";
import { DataTable } from "@/components/refine-ui/data-table/data-table";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type AchatRow = {
  id: number;
  delivery_date: string | null;
  delivery_ref: string | null;
  supplier: string | null;
  pid: string | null;
  product: string | null;
  category: string | null;
  tva: string | null;
  quantity: number | null;
  pph: number | null;
  ppv: number | null;
  unit_price: number | null;
  expiry_date: string | null;
  total: number | null;
};

const fmt = (n: number | null) =>
  n != null ? n.toLocaleString("fr-MA", { minimumFractionDigits: 2 }) : "—";

const ACHAT_CSV_HEADERS = [
  "Date BL", "Référence", "Fournisseur", "Produit", "PID",
  "Catégorie", "Qté", "PPH", "PPV", "Prix unitaire", "Péremption", "Total",
];

function rowToCSV(r: Record<string, unknown>): string[] {
  return [
    String(r.delivery_date ?? ""),
    String(r.delivery_ref ?? ""),
    String(r.supplier ?? ""),
    String(r.product ?? ""),
    String(r.pid ?? ""),
    String(r.category ?? ""),
    String(r.quantity ?? ""),
    String(r.pph ?? ""),
    String(r.ppv ?? ""),
    String(r.unit_price ?? ""),
    String(r.expiry_date ?? ""),
    String(r.total ?? ""),
  ];
}

function downloadCSV(rows: Record<string, unknown>[], headers: string[], filename: string) {
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

const stripPct = (s: string) => s.replace(/\s*\([\d.]+%\)/, "").trim();

const AchatList = () => {
  const today = new Date();
  const [searchQuery, setSearchQuery]         = useState("");
  const [selectedCats, setSelectedCats]       = useState<string[]>([]);
  const [allCategories, setAllCategories]     = useState<string[]>([]);
  const [catOpen, setCatOpen]                 = useState(false);
  const [dateRange, setDateRange]             = useState<DateRange | undefined>();
  const [dateOpen, setDateOpen]               = useState(false);
  const [exporting, setExporting]             = useState(false);

  useEffect(() => {
    api.tables.achatCategories().then(setAllCategories).catch(() => {});
  }, []);

  const applyDatePreset = (preset: "today" | "7d" | "month") => {
    if (preset === "today") setDateRange({ from: today, to: today });
    else if (preset === "7d") setDateRange({ from: subDays(today, 6), to: today });
    else setDateRange({ from: startOfMonth(today), to: today });
    setDateOpen(false);
  };

  const dateLabel = dateRange?.from
    ? dateRange.to && dateRange.to.getTime() !== dateRange.from.getTime()
      ? `${format(dateRange.from, "d MMM", { locale: fr })} – ${format(dateRange.to, "d MMM yyyy", { locale: fr })}`
      : format(dateRange.from, "d MMM yyyy", { locale: fr })
    : "Période";

  const toggleCat = (cat: string) =>
    setSelectedCats((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    );

  const handleExport = async () => {
    setExporting(true);
    try {
      const dateFrom = dateRange?.from ? format(dateRange.from, "yyyy-MM-dd") : undefined;
      const dateTo = dateRange?.to ? format(dateRange.to, "yyyy-MM-dd") : undefined;
      const res = await api.tables.exportAchat(searchQuery, selectedCats, dateFrom, dateTo);
      downloadCSV(res.data, ACHAT_CSV_HEADERS, `achats_export_${Date.now()}.csv`);
      toast.success(`${res.data.length} lignes exportées`);
    } catch {
      toast.error("Erreur lors de l'export");
    } finally {
      setExporting(false);
    }
  };

  const columns = useMemo<ColumnDef<AchatRow>[]>(
    () => [
      {
        id: "delivery_date",
        accessorKey: "delivery_date",
        size: 110,
        header: () => <p className="column-title">Date BL</p>,
        cell: ({ getValue }) => (
          <span className="text-sm tabular-nums">{getValue<string>() ?? "—"}</span>
        ),
      },
      {
        id: "delivery_ref",
        accessorKey: "delivery_ref",
        size: 100,
        header: () => <p className="column-title">Référence</p>,
        cell: ({ getValue }) =>
          getValue<string>() ? (
            <Badge variant="outline" className="font-mono text-xs">{getValue<string>()}</Badge>
          ) : (
            <span className="text-muted-foreground">—</span>
          ),
      },
      {
        id: "supplier",
        accessorKey: "supplier",
        size: 200,
        header: () => <p className="column-title">Fournisseur</p>,
        cell: ({ getValue }) => (
          <span className="truncate text-sm">{getValue<string>() ?? "—"}</span>
        ),
      },
      {
        id: "product",
        accessorKey: "product",
        size: 260,
        header: () => <p className="column-title">Produit</p>,
        cell: ({ row }) => (
          <div className="flex flex-col min-w-0">
            <span className="truncate text-sm font-medium">{row.original.product ?? "—"}</span>
            {row.original.pid && (
              <span className="text-xs text-muted-foreground font-mono">PID {row.original.pid}</span>
            )}
          </div>
        ),
      },
      {
        id: "category",
        accessorKey: "category",
        size: 180,
        header: () => <p className="column-title">Catégorie</p>,
        cell: ({ getValue }) => {
          const cat = getValue<string>();
          if (!cat) return <span className="text-muted-foreground">—</span>;
          const label = cat.replace(/\s*\([\d.]+%\)/, "").trim();
          return <Badge variant="secondary" className="text-xs max-w-[160px] truncate">{label}</Badge>;
        },
      },
      {
        id: "quantity",
        accessorKey: "quantity",
        size: 80,
        header: () => <p className="column-title">Qté</p>,
        cell: ({ getValue }) => (
          <span className="tabular-nums font-medium">{getValue<number>() ?? "—"}</span>
        ),
      },
      {
        id: "pph",
        accessorKey: "pph",
        size: 100,
        header: () => <p className="column-title">PPH</p>,
        cell: ({ getValue }) => (
          <span className="tabular-nums text-sm">{fmt(getValue<number | null>())}</span>
        ),
      },
      {
        id: "unit_price",
        accessorKey: "unit_price",
        size: 110,
        header: () => <p className="column-title">Prix unitaire</p>,
        cell: ({ getValue }) => (
          <span className="tabular-nums text-sm">{fmt(getValue<number | null>())}</span>
        ),
      },
      {
        id: "expiry_date",
        accessorKey: "expiry_date",
        size: 110,
        header: () => <p className="column-title">Péremption</p>,
        cell: ({ getValue }) => {
          const v = getValue<string>();
          if (!v) return <span className="text-muted-foreground">—</span>;
          return <span className="text-sm tabular-nums">{v}</span>;
        },
      },
      {
        id: "total",
        accessorKey: "total",
        size: 110,
        header: () => <p className="column-title">Total</p>,
        cell: ({ getValue }) => (
          <span className="tabular-nums font-semibold text-sm">
            {fmt(getValue<number | null>())}
          </span>
        ),
      },
    ],
    []
  );

  const table = useTable<AchatRow>({
    columns,
    refineCoreProps: {
      resource: "achat",
      pagination: { pageSize: 20, mode: "server" },
      sorters: { initial: [{ field: "id", order: "desc" }] },
    },
  });

  useEffect(() => {
    const dateFrom = dateRange?.from ? format(dateRange.from, "yyyy-MM-dd") : undefined;
    const dateTo = dateRange?.to ? format(dateRange.to, "yyyy-MM-dd") : undefined;
    table.refineCore.setFilters(
      [
        ...(searchQuery ? [{ field: "search", operator: "contains" as const, value: searchQuery }] : []),
        ...(selectedCats.length > 0 ? [{ field: "categories", operator: "in" as const, value: selectedCats }] : []),
        ...(dateFrom ? [{ field: "date_from", operator: "gte" as const, value: dateFrom }] : []),
        ...(dateTo ? [{ field: "date_to", operator: "lte" as const, value: dateTo }] : []),
      ],
      "replace"
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, selectedCats, dateRange]);

  const catLabel =
    selectedCats.length === 0
      ? "Toutes les catégories"
      : selectedCats.length === 1
      ? stripPct(selectedCats[0])
      : `${selectedCats.length} catégories`;

  return (
    <ListView>
      <Breadcrumb />
      <h1 className="page-title">Achats</h1>

      <div className="intro-row">
        <p className="text-sm text-muted-foreground">Historique des bons de livraison fournisseurs.</p>
        <div className="actions-row">
          <div className="search-field">
            <Search className="search-icon" />
            <Input
              type="text"
              placeholder="Produit, fournisseur, référence…"
              className="pl-10 w-full"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <Popover open={catOpen} onOpenChange={setCatOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "h-9 w-full md:w-52 justify-between text-sm font-normal",
                  selectedCats.length > 0 && "border-primary text-primary"
                )}
              >
                <span className="truncate">{catLabel}</span>
                <ChevronDown className="h-4 w-4 opacity-50 shrink-0" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-56 p-1" align="start">
              {selectedCats.length > 0 && (
                <button
                  className="w-full text-left px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground"
                  onClick={() => setSelectedCats([])}
                >
                  Tout désélectionner
                </button>
              )}
              <ScrollArea className="max-h-64">
                {allCategories.map((cat) => {
                  const checked = selectedCats.includes(cat);
                  return (
                    <div
                      key={cat}
                      className="flex items-center gap-2 px-2 py-1.5 rounded-sm cursor-pointer hover:bg-accent"
                      onClick={() => toggleCat(cat)}
                    >
                      <div className={cn(
                        "h-4 w-4 rounded border flex items-center justify-center shrink-0",
                        checked ? "bg-primary border-primary" : "border-input"
                      )}>
                        {checked && <Check className="h-3 w-3 text-primary-foreground" />}
                      </div>
                      <span className="text-sm truncate">{stripPct(cat)}</span>
                    </div>
                  );
                })}
              </ScrollArea>
            </PopoverContent>
          </Popover>

          {selectedCats.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-9 gap-1 text-muted-foreground"
              onClick={() => setSelectedCats([])}
            >
              <X className="h-3.5 w-3.5" />
              Effacer
            </Button>
          )}

          <Popover open={dateOpen} onOpenChange={setDateOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "h-9 w-full md:w-48 justify-start gap-2 text-sm font-normal",
                  dateRange?.from && "border-primary text-primary"
                )}
              >
                <CalendarIcon className="h-4 w-4 shrink-0 opacity-60" />
                <span className="truncate">{dateLabel}</span>
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start" sideOffset={6}>
              <div className="flex items-center gap-1 px-3 py-2 border-b">
                <Button size="sm" variant="ghost" className="h-7 text-xs rounded-md" onClick={() => applyDatePreset("today")}>
                  Aujourd'hui
                </Button>
                <Button size="sm" variant="ghost" className="h-7 text-xs rounded-md" onClick={() => applyDatePreset("7d")}>
                  7 jours
                </Button>
                <Button size="sm" variant="ghost" className="h-7 text-xs rounded-md" onClick={() => applyDatePreset("month")}>
                  Ce mois
                </Button>
              </div>
              <Calendar
                mode="range"
                selected={dateRange}
                onSelect={(r) => { setDateRange(r); if (r?.to) setDateOpen(false); }}
                numberOfMonths={2}
                locale={fr}
                disabled={{ after: today }}
                initialFocus
              />
              {dateRange?.from && (
                <div className="px-3 py-2 border-t">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full h-7 text-xs text-muted-foreground"
                    onClick={() => { setDateRange(undefined); setDateOpen(false); }}
                  >
                    <X className="h-3 w-3 mr-1" />
                    Effacer la période
                  </Button>
                </div>
              )}
            </PopoverContent>
          </Popover>

          <Button
            variant="outline"
            size="sm"
            className="h-9 gap-2"
            onClick={handleExport}
            disabled={exporting}
          >
            <Download className="h-4 w-4" />
            {exporting ? "Export…" : "Exporter CSV"}
          </Button>
        </div>
      </div>

      <DataTable table={table} />
    </ListView>
  );
};

export default AchatList;
