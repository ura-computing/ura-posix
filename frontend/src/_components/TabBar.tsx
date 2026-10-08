import type { ReactNode } from "react";
import { motion } from "framer-motion";

import { cn } from "@/utils/cn";

export interface TabItem<K extends string = string> {
  id: K;
  label: string;
  icon?: ReactNode;
}

interface TabBarProps<K extends string> {
  tabs: TabItem<K>[];
  activeId: K;
  onChange: (id: K) => void;
  /** Right of the tabs, on the same line (e.g. the product's Statistiques period). */
  actions?: ReactNode;
}

/** The one tab strip of the app (underline + sliding indicator). Scrolls
 *  sideways when the tabs don't fit (7 modes on /analyses). */
export function TabBar<K extends string = string>({ tabs, activeId, onChange, actions }: TabBarProps<K>) {
  // Same elements with or without `actions`: buttons appearing on one tab never rebuild the
  // tabs (no jump of the underline); they fit in the tabs' height (no jump of the page).
  return (
    <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2 border-b border-border">
      <div
        role="tablist"
        // Scrolls sideways only on a narrow screen (no visible bar); never vertically. Grows to the
        // line's width (the underline sliding to the last tab stays inside: no scrollbar); when the
        // actions don't fit beside the tabs, they go to the next line.
        className="flex min-w-0 grow gap-1 overflow-x-auto overflow-y-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
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
                  className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-primary"
                  // Critically damped: no bounce past the tab (past the last one = a scrollbar).
                  transition={{ type: "spring", stiffness: 420, damping: 42 }}
                />
              )}
            </button>
          );
        })}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2 pb-1">{actions}</div>}
    </div>
  );
}
