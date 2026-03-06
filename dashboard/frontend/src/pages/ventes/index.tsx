import { useEffect, useMemo, useState } from "react";
import { Check, ChevronDown, Download, Search, X } from "lucide-react";
import { ColumnDef } from "@tanstack/react-table";
import { useTable } from "@refinedev/react-table";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ListView } from "@/components/refine-ui/views/list-view";
import { Breadcrumb } from "@/components/refine-ui/layout/breadcrumb";
import { DataTable } from "@/components/refine-ui/data-table/data-table";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type VenteRow = {
  id: number;
  date: string | null;
  transaction_ref: string | null;
  client: string | null;
  pid: string | null;
  product: string | null;
  category: string | null;
  tva: string | null;
  quantity: number | null;
  discount: number | null;
  ppv: number | null;
  unit_price: number | null;
  total: number | null;
};

const fmt = (n: number | null) =>
  n != null ? n.toLocaleString("fr-MA", { minimumFractionDigits: 2 }) : "—";

const VENTE_CSV_HEADERS = [
  "Date", "N° Transaction", "Client", "Produit", "PID",
  "Catégorie", "Qté", "Remise", "PPV", "Prix unitaire", "Total",
];

function rowToCSV(r: Record<string, unknown>): string[] {
  return [
    String(r.date ?? ""),
    String(r.transaction_ref ?? ""),
    String(r.client ?? ""),
    String(r.product ?? ""),
    String(r.pid ?? ""),
    String(r.category ?? ""),
    String(r.quantity ?? ""),
    String(r.discount ?? ""),
    String(r.ppv ?? ""),
    String(r.unit_price ?? ""),
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

const VentesList = () => {
  const [searchQuery, setSearchQuery]       = useState("");
  const [selectedCats, setSelectedCats]     = useState<string[]>([]);
  const [allCategories, setAllCategories]   = useState<string[]>([]);
  const [catOpen, setCatOpen]               = useState(false);
  const [exporting, setExporting]           = useState(false);

  useEffect(() => {
    api.tables.venteCategories().then(setAllCategories).catch(() => {});
  }, []);

  const toggleCat = (cat: string) =>
    setSelectedCats((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    );

  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await api.tables.exportVente(searchQuery, selectedCats);
      downloadCSV(res.data, VENTE_CSV_HEADERS, `ventes_export_${Date.now()}.csv`);
      toast.success(`${res.data.length} lignes exportées`);
    } catch {
      toast.error("Erreur lors de l'export");
    } finally {
      setExporting(false);
    }
  };

  const columns = useMemo<ColumnDef<VenteRow>[]>(
    () => [
      {
        id: "date",
        accessorKey: "date",
        size: 110,
        header: () => <p className="column-title">Date</p>,
        cell: ({ getValue }) => (
          <span className="text-sm tabular-nums">{getValue<string>() ?? "—"}</span>
        ),
      },
      {
        id: "transaction_ref",
        accessorKey: "transaction_ref",
        size: 130,
        header: () => <p className="column-title">N° Transaction</p>,
        cell: ({ getValue }) =>
          getValue<string>() ? (
            <Badge variant="outline" className="font-mono text-xs">{getValue<string>()}</Badge>
          ) : (
            <span className="text-muted-foreground">—</span>
          ),
      },
      {
        id: "client",
        accessorKey: "client",
        size: 170,
        header: () => <p className="column-title">Client</p>,
        cell: ({ getValue }) => {
          const v = getValue<string>();
          return v
            ? <span className="text-sm">{v}</span>
            : <span className="text-muted-foreground text-xs italic">Anonyme</span>;
        },
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
        size: 170,
        header: () => <p className="column-title">Catégorie</p>,
        cell: ({ getValue }) => {
          const cat = getValue<string>();
          if (!cat) return <span className="text-muted-foreground">—</span>;
          const label = cat.replace(/\s*\([\d.]+%\)/, "").trim();
          return <Badge variant="secondary" className="text-xs max-w-[150px] truncate">{label}</Badge>;
        },
      },
      {
        id: "quantity",
        accessorKey: "quantity",
        size: 70,
        header: () => <p className="column-title">Qté</p>,
        cell: ({ getValue }) => (
          <span className="tabular-nums font-medium">{getValue<number>() ?? "—"}</span>
        ),
      },
      {
        id: "discount",
        accessorKey: "discount",
        size: 90,
        header: () => <p className="column-title">Remise</p>,
        cell: ({ getValue }) => {
          const v = getValue<number | null>();
          if (!v) return <span className="text-muted-foreground">—</span>;
          return <span className="tabular-nums text-sm text-amber-600 dark:text-amber-400">-{fmt(v)}</span>;
        },
      },
      {
        id: "ppv",
        accessorKey: "ppv",
        size: 100,
        header: () => <p className="column-title">PPV</p>,
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

  const table = useTable<VenteRow>({
    columns,
    refineCoreProps: {
      resource: "ventes",
      pagination: { pageSize: 20, mode: "server" },
      sorters: { initial: [{ field: "id", order: "desc" }] },
    },
  });

  useEffect(() => {
    table.refineCore.setFilters(
      [
        ...(searchQuery ? [{ field: "search", operator: "contains" as const, value: searchQuery }] : []),
        ...(selectedCats.length > 0 ? [{ field: "categories", operator: "in" as const, value: selectedCats }] : []),
      ],
      "replace"
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, selectedCats]);

  const catLabel =
    selectedCats.length === 0
      ? "Toutes les catégories"
      : selectedCats.length === 1
      ? stripPct(selectedCats[0])
      : `${selectedCats.length} catégories`;

  return (
    <ListView>
      <Breadcrumb />
      <h1 className="page-title">Ventes</h1>

      <div className="intro-row">
        <p className="text-sm text-muted-foreground">Historique des transactions de vente.</p>
        <div className="actions-row">
          <div className="search-field">
            <Search className="search-icon" />
            <Input
              type="text"
              placeholder="Produit, client, N° transaction…"
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

export default VentesList;
