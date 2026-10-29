import { Sun, Moon, Monitor } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { useT } from "@/i18n/I18nProvider";
import { cn } from "@/utils/cn";
import { useCallback, useEffect, useState } from "react";

const THEME_MODES = { LIGHT: "light", DARK: "dark", SYSTEM: "system" } as const;
type ThemeMode = (typeof THEME_MODES)[keyof typeof THEME_MODES];

const STORAGE_KEY = "pg-theme";

function resolveDark(mode: ThemeMode): boolean {
  if (mode === THEME_MODES.DARK) return true;
  if (mode === THEME_MODES.LIGHT) return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function applyTheme(mode: ThemeMode): void {
  document.documentElement.classList.toggle("dark", resolveDark(mode));
}

function useTheme() {
  const [mode, setModeState] = useState<ThemeMode>(
    () => (localStorage.getItem(STORAGE_KEY) as ThemeMode | null) ?? THEME_MODES.SYSTEM,
  );

  useEffect(() => {
    applyTheme(mode);
    if (mode !== THEME_MODES.SYSTEM) return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyTheme(THEME_MODES.SYSTEM);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [mode]);

  const setMode = useCallback((next: ThemeMode) => {
    localStorage.setItem(STORAGE_KEY, next);
    setModeState(next);
  }, []);

  return { mode, setMode };
}

const OPTIONS: { mode: ThemeMode; key: string; icon: LucideIcon }[] = [
  { mode: THEME_MODES.LIGHT, key: "theme.light", icon: Sun },
  { mode: THEME_MODES.DARK, key: "theme.dark", icon: Moon },
  { mode: THEME_MODES.SYSTEM, key: "theme.system", icon: Monitor },
];

export function ThemeToggle() {
  const { mode, setMode } = useTheme();
  const t = useT();
  return (
    <div className="flex items-center gap-0.5 rounded-[9px] border border-border bg-surface-subtle p-0.5">
      {OPTIONS.map((opt) => {
        const active = mode === opt.mode;
        return (
          <button
            key={opt.mode}
            type="button"
            onClick={() => setMode(opt.mode)}
            aria-label={t(opt.key)}
            aria-pressed={active}
            className={cn(
              "flex h-7 w-[30px] cursor-pointer items-center justify-center rounded-md transition-colors",
              active ? "bg-card text-primary shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <opt.icon className="size-[15px]" aria-hidden />
          </button>
        );
      })}
    </div>
  );
}
