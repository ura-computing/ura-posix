import { Sun, Moon, Monitor } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { useTheme, THEME_MODES, type ThemeMode } from "@/hooks/useTheme";
import { cn } from "@/utils/cn";

const OPTIONS: { mode: ThemeMode; label: string; icon: LucideIcon }[] = [
  { mode: THEME_MODES.LIGHT,  label: "Clair",   icon: Sun },
  { mode: THEME_MODES.DARK,   label: "Sombre",  icon: Moon },
  { mode: THEME_MODES.SYSTEM, label: "Système", icon: Monitor },
];

export function ThemeToggle() {
  const { mode, setMode } = useTheme();
  return (
    <div className="flex items-center gap-0.5 rounded-[9px] border border-border bg-surface-subtle p-0.5">
      {OPTIONS.map((opt) => {
        const active = mode === opt.mode;
        return (
          <button
            key={opt.mode}
            type="button"
            onClick={() => setMode(opt.mode)}
            aria-label={opt.label}
            aria-pressed={active}
            className={cn(
              "flex h-7 w-[30px] cursor-pointer items-center justify-center rounded-md transition-colors",
              active
                ? "bg-card text-primary shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <opt.icon className="size-[15px]" aria-hidden />
          </button>
        );
      })}
    </div>
  );
}