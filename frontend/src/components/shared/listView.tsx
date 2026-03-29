"use client";

import type { PropsWithChildren } from "react";
import { cn } from "@/utils/cn";

type ListViewProps = PropsWithChildren<{
  className?: string;
}>;

export function ListView({ children, className }: ListViewProps) {
  return (
    <div className={cn("flex flex-col", "gap-4", className)}>{children}</div>
  );
}

ListView.displayName = "ListView";
