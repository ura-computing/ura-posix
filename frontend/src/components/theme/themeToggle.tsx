"use client";

import { useTheme } from "@/components/theme/themeProvider";
import { Button } from "@/components/ui/button";
import { cn } from "@/utils/cn";
import { Moon, Sun } from "lucide-react";

type ThemeToggleProps = {
  className?: string;
};

export function ThemeToggle({ className }: ThemeToggleProps) {
  const { theme, setTheme } = useTheme();

  const isDark = theme === "dark";

  return (
    <Button
      variant="outline"
      size="icon"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className={cn("rounded-full bg-transparent h-9 w-9", className)}
      aria-label={isDark ? "Passer en mode clair" : "Passer en mode sombre"}
    >
      <Sun
        className={cn("h-[1.2rem] w-[1.2rem] transition-all duration-200", {
          "-rotate-90 scale-0 opacity-0": isDark,
          "rotate-0 scale-100 opacity-100": !isDark,
        })}
      />
      <Moon
        className={cn("absolute h-[1.2rem] w-[1.2rem] transition-all duration-200", {
          "rotate-0 scale-100 opacity-100": isDark,
          "rotate-90 scale-0 opacity-0": !isDark,
        })}
      />
    </Button>
  );
}

ThemeToggle.displayName = "ThemeToggle";
