/** Every page inside the layout: same title block, same spacing, same width.
 *  - Data pages (tables, KPIs): full width.
 *  - `narrow`: one form / one wizard (Mon compte, Importer un fichier) — reading width.
 *  `above`: e.g. a « Retour » link over the title. `media`: e.g. a photo, left of the title.
 *  `actions`: main buttons, right of the title. */
import type { ReactNode } from "react";

import { cn } from "@/utils/cn";

export interface PageProps {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  above?: ReactNode;
  media?: ReactNode;
  narrow?: boolean;
  children: ReactNode;
}

export function Page({ title, subtitle, actions, above, media, narrow, children }: PageProps) {
  const heading = (
    <div className="flex min-w-0 flex-col gap-1">
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
      {subtitle && <div className="text-sm text-muted-foreground">{subtitle}</div>}
    </div>
  );
  return (
    <div className={cn("mx-auto flex w-full flex-col gap-5", narrow && "max-w-3xl")}>
      {above}
      <header className={cn("flex flex-wrap justify-between gap-4", media ? "items-start" : "items-end")}>
        {media ? (
          <div className="flex min-w-0 flex-wrap items-center gap-5">
            {media}
            {heading}
          </div>
        ) : (
          heading
        )}
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      </header>
      {children}
    </div>
  );
}
