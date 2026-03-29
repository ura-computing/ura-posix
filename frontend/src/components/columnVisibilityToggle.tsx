import { useEffect } from "react";
import { Columns3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";

type TableLike = {
  getAllColumns: () => Array<{ id: string; getCanHide: () => boolean; getIsVisible: () => boolean }>;
  getState: () => { columnVisibility: Record<string, boolean> };
  setColumnVisibility: (visibility: Record<string, boolean>) => void;
};

type Props = {
  table: TableLike;
  storageKey: string;
  columnLabels?: Record<string, string>;
};

export function ColumnVisibilityToggle({ table, storageKey, columnLabels = {} }: Props) {
  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) table.setColumnVisibility(JSON.parse(saved) as Record<string, boolean>);
    } catch { /* ignore */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const persist = (columnId: string, visible: boolean) => {
    const next = { ...table.getState().columnVisibility, [columnId]: visible };
    localStorage.setItem(storageKey, JSON.stringify(next));
    table.setColumnVisibility(next);
  };

  const columns = table.getAllColumns().filter((col) => col.getCanHide());

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-9 gap-2 shrink-0">
          <Columns3 className="h-4 w-4" />
          <span className="hidden sm:inline">Colonnes</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-48 p-2">
        <p className="text-xs font-medium text-muted-foreground px-1 pb-1.5">Afficher / Masquer</p>
        <div className="space-y-0.5">
          {columns.map((col) => (
            <label
              key={col.id}
              className="flex items-center gap-2 rounded px-1 py-1 text-sm hover:bg-muted cursor-pointer"
            >
              <Checkbox
                checked={col.getIsVisible()}
                onCheckedChange={(checked) => persist(col.id, !!checked)}
              />
              {columnLabels[col.id] ?? col.id}
            </label>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
