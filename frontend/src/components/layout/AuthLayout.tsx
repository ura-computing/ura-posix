import type { ReactNode } from "react";

import { BrandPanel } from "@/components/layout/BrandPanel";
import { ThemeToggle } from "@/components/shared/ThemeToggle";

interface Props {
  children: ReactNode;
}

export function AuthLayout({ children }: Props) {
  return (
    <div className="grid min-h-screen md:grid-cols-[1fr_minmax(360px,520px)]">
      <BrandPanel />
      <main className="relative flex items-center justify-center bg-background p-6 md:p-12">
        <div className="absolute right-5 top-5">
          <ThemeToggle />
        </div>
        <div className="w-full max-w-sm">{children}</div>
      </main>
    </div>
  );
}