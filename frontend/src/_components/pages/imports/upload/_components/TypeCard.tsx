import { Check } from "lucide-react";
import type { DocType } from "@/types/imports";
import { useT } from "@/i18n/I18nProvider";
import { cn } from "@/utils/cn";
import type { ReactNode } from "react";
import { ChoiceCard } from "@/_components/molecules/ChoiceCard";

interface TypeCardProps {
  type: DocType;
  title: string;
  description: string;
  icon: ReactNode;
  columns: string[]; // first 5 column-name chips
  totalCols: number; // for "+N autres"
  selected: boolean;
  onSelect: () => void;
}

/**
 * Step-1 card. One per doc-type. Tinted with the matching --color-doc-*-bg
 * when selected; bordered card otherwise. Hover lifts a couple of pixels.
 */

export function TypeCard({ type, title, description, icon, columns, totalCols, selected, onSelect }: TypeCardProps) {
  const t = useT();
  const ringColor = `var(--color-doc-${type})`;
  return (
    <ChoiceCard
      selected={selected}
      onSelect={onSelect}
      className={cn(
        "group gap-3 p-5 transition-all",
        selected ? "shadow-md" : "hover:-translate-y-0.5 hover:shadow-md",
      )}
      style={selected ? { borderColor: ringColor, background: `var(--color-doc-${type}-bg)` } : undefined}
    >
      <div className="flex items-center justify-between">
        <div
          className="flex size-11 items-center justify-center rounded-xl"
          style={{ background: `var(--color-doc-${type}-bg)`, color: ringColor }}
        >
          {icon}
        </div>
        {selected && (
          <span
            className="flex size-5 items-center justify-center rounded-full text-white"
            style={{ background: ringColor }}
          >
            <Check className="size-3.5" strokeWidth={3} aria-hidden />
          </span>
        )}
      </div>
      <div className="flex flex-col gap-1">
        <h3 className="text-base font-semibold text-foreground">{title}</h3>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <div className="flex flex-wrap gap-1.5 pt-1">
        {columns.slice(0, 5).map((c) => (
          <span
            key={c}
            className="rounded-full border border-border bg-card px-2 py-0.5 text-[10px] font-medium text-muted-foreground"
          >
            {c}
          </span>
        ))}
        {totalCols > 5 && (
          <span className="rounded-full border border-dashed border-border px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
            +{totalCols - 5} {t("uploadFile.others")}
          </span>
        )}
      </div>
    </ChoiceCard>
  );
}
