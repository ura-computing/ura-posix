import type { ReactNode } from "react";
import { motion } from "framer-motion";

import { cn } from "@/utils/cn";

export interface TabItem<K extends string = string> {
  id:    K;
  label: string;
  icon?: ReactNode;
}

interface TabBarProps<K extends string> {
  tabs:     TabItem<K>[];
  activeId: K;
  onChange: (id: K) => void;
}

/** The one tab strip of the app (underline + sliding indicator). Scrolls
 *  sideways when the tabs don't fit (7 modes on /analyses). */
export function TabBar<K extends string = string>({ tabs, activeId, onChange }: TabBarProps<K>) {
  return (
    <div role="tablist" className="flex gap-1 overflow-x-auto border-b border-border">
      {tabs.map((tab) => {
        const active = tab.id === activeId;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(tab.id)}
            className={cn(
              "relative inline-flex shrink-0 cursor-pointer items-center gap-2 whitespace-nowrap px-4 py-2.5 text-base font-medium transition-colors",
              active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {tab.icon}
            {tab.label}
            {active && (
              <motion.div
                layoutId="tab-indicator"
                className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-primary"
                transition={{ type: "spring", stiffness: 420, damping: 34 }}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}
