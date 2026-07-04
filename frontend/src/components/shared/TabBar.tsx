import { motion } from "framer-motion";

import { cn } from "@/utils/cn";

export interface TabItem {
  id:    string;
  label: string;
}

interface TabBarProps {
  tabs:     TabItem[];
  activeId: string;
  onChange: (id: string) => void;
}

export function TabBar({ tabs, activeId, onChange }: TabBarProps) {
  return (
    <div className="flex gap-1 border-b border-border">
      {tabs.map((tab) => {
        const active = tab.id === activeId;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            className={cn(
              "relative cursor-pointer px-4 py-2.5 text-base font-medium transition-colors",
              active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
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