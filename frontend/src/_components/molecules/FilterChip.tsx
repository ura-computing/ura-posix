/** A small removable chip: one active filter (« Fournisseur : X ✕ »). */
import { type ReactNode } from "react";
import { X } from "lucide-react";

import { useT } from "@/i18n/I18nProvider";

export function FilterChip({ children, onRemove }: { children: ReactNode; onRemove: () => void }) {
  const t = useT();
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-2.5 py-0.5 text-xs">
      <span>{children}</span>
      <button
        type="button"
        onClick={onRemove}
        aria-label={t("shared.removeFilter")}
        className="cursor-pointer rounded-full p-0.5 hover:bg-muted"
      >
        <X className="size-3" />
      </button>
    </span>
  );
}
