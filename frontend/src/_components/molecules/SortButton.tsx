/** A sortable column title (DataTable, the alert window): click = sort on it, again = the other way.
 *  The arrow shows the column sorted and its direction. */
import type { ReactNode } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";

import { cn } from "@/utils/cn";

export function SortButton({
  active,
  order,
  alignRight,
  onSort,
  children,
}: {
  active: boolean;
  order: "asc" | "desc";
  /** Right-aligned column (numbers): the arrow goes before the title. */
  alignRight?: boolean;
  onSort: () => void;
  children: ReactNode;
}) {
  const Icon = !active ? ArrowUpDown : order === "asc" ? ArrowUp : ArrowDown;
  return (
    <button
      type="button"
      onClick={onSort}
      className={cn(
        "inline-flex cursor-pointer items-center gap-1 hover:text-foreground",
        alignRight && "flex-row-reverse",
      )}
    >
      {children}
      <Icon className={cn("size-3", active ? "text-primary" : "text-muted-foreground/60")} />
    </button>
  );
}
